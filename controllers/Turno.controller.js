const Turno = require("../models/Turno");
const Doctor = require("../models/Doctor");
const Paciente = require("../models/Paciente");
const Estudio = require("../models/Estudio");
const {
    enviarCorreoConfirmacion,
    enviarCorreoInformeListo,
} = require("../utils/emailService");
const { getEmailConfig } = require("../utils/emailConfig");
const { prepararAdjuntos, esPdf } = require("../utils/archivosAdjuntos");
const path = require("path");
const mime = require("mime-types");
const HistorialTurno = require("../models/HistorialTurno");
const fs = require("fs");

const {
    S3Client,
    DeleteObjectCommand,
    PutObjectCommand,
} = require("@aws-sdk/client-s3");

// Configuración S3
const miRegion = process.env.AWS_REGION;
const s3 = new S3Client({
    region: miRegion,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const BUCKET_NAME = "dicom-medical";

const ESTADOS_ATENCION = [
    "agendado",
    "en_consulta",
    "pendiente_informe",
    "informe_completado",
];

// Crear disponibilidad (Admin/Secretaria)
// Recibe: doctorId, fecha (Date), horaInicio (HH:mm), horaFin (HH:mm), intervalo (minutos)
// O simplemente una lista de fechas/horas específicas.
// Para simplificar según el requerimiento "cargar por dia que horarios disponible hay":
// Vamos a asumir que envían un array de fechas/horas exactas para crear los slots.

exports.crearDisponibilidad = async (req, res) => {
    try {
        const { doctorId, horarios } = req.body; // horarios es un array de ISO Dates
        // Nota: El estudio ya NO se especifica al crear el turno.
        // El paciente elegirá el estudio al momento de reservar.

        if (!doctorId || !horarios || !Array.isArray(horarios)) {
            return res.status(400).send({ message: "Datos faltantes o incorrectos." });
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).send({ message: "Doctor no encontrado." });
        }

        const turnosCreados = [];
        for (const fecha of horarios) {
            const nuevoTurno = new Turno({
                fecha: new Date(fecha),
                doctor: doctorId,
                especialidad: doctor.especialidad,
                // estudio: null - El estudio se asignará al reservar
                estado: "disponible",
            });
            await nuevoTurno.save();
            turnosCreados.push(nuevoTurno);
        }

        res.status(201).send({ message: "Disponibilidad creada exitosamente.", turnos: turnosCreados });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al crear disponibilidad." });
    }
};

// Reservar turno (Paciente Registrado)
exports.reservarTurno = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const { pacienteId, motivoConsulta, estudioId, telefono } = req.body;

        // Validar que se especifique el estudio (obligatorio al reservar)
        if (!estudioId) {
            return res.status(400).send({ message: "Debe seleccionar un estudio para reservar el turno." });
        }

        if (!pacienteId) {
            return res.status(400).send({ message: "Se requiere el ID del paciente." });
        }

        if (!telefono) {
            return res.status(400).send({ message: "El teléfono es obligatorio para registrar el turno." });
        }

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        if (turno.estado !== "disponible") {
            return res.status(400).send({ message: "El turno no está disponible." });
        }

        const paciente = await Paciente.findById(pacienteId);
        if (!paciente) {
            return res.status(404).send({ message: "Paciente no encontrado." });
        }

        // Actualizar el teléfono del paciente si se proveyó uno nuevo
        if (telefono && paciente.telefono !== telefono) {
            paciente.telefono = telefono;
            await paciente.save();
        }

        turno.paciente = pacienteId;
        turno.estado = "reservado";
        turno.motivoConsulta = motivoConsulta;
        turno.updated_at = Date.now();
        turno.estudio = estudioId; // El estudio lo elige el paciente al reservar
        turno.estadoAtencion = "agendado";
        turno.enConsultaAt = null;
        turno.pendienteInformeAt = null;
        turno.informeCompletadoAt = null;

        await turno.save();

        const doctor = await Doctor.findById(turno.doctor);

        // Guardar en el Historial
        const historial = new HistorialTurno({
            turnoId: turno._id,
            pacienteId: paciente._id,
            nombreCompleto: paciente.nombre,
            telefono: telefono || paciente.telefono,
            dni: paciente.dni || "",
            doctor: doctor ? doctor.nombre : "Desconocido",
            especialidad: turno.especialidad || (doctor ? doctor.especialidad : "Desconocida"),
            fechaTurno: turno.fecha,
            creadoPor: "paciente_registrado"
        });
        await historial.save();

        // Enviar email
        await enviarCorreoConfirmacion(turno, paciente);

        res.status(200).send({ message: "Turno reservado exitosamente.", turno });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al reservar turno." });
    }
};

// Registrar una visita sin turno para un paciente ya registrado.
// Se usa cuando el paciente llega al consultorio sin una cita previa.
exports.crearVisitaSinTurno = async (req, res) => {
    try {
        const {
            pacienteId,
            estudioId,
            doctorId,
            motivoConsulta,
            estadoAtencion = "en_consulta",
        } = req.body;

        if (!pacienteId) {
            return res.status(400).send({
                message: "Se requiere el ID del paciente.",
            });
        }

        if (!ESTADOS_ATENCION.includes(estadoAtencion)) {
            return res.status(400).send({
                message: "Estado de atención inválido.",
            });
        }

        const paciente = await Paciente.findById(pacienteId);
        if (!paciente) {
            return res.status(404).send({ message: "Paciente no encontrado." });
        }

        const doctor = doctorId
            ? await Doctor.findById(doctorId)
            : await Doctor.findOne().sort({ created_at: 1 });

        if (!doctor) {
            return res.status(400).send({
                message: "No hay un doctor disponible para registrar la visita.",
            });
        }

        let estudio = null;
        if (estudioId) {
            estudio = await Estudio.findById(estudioId);
            if (!estudio) {
                return res.status(404).send({ message: "Estudio no encontrado." });
            }
        }

        const ahora = new Date();
        const visitaCompletada = estadoAtencion === "informe_completado";
        const visitaPendiente = ["pendiente_informe", "informe_completado"].includes(
            estadoAtencion
        );

        const turno = new Turno({
            fecha: ahora,
            doctor: doctor._id,
            paciente: paciente._id,
            estudio: estudio?._id || null,
            especialidad: doctor.especialidad,
            estado: visitaCompletada ? "finalizado" : "reservado",
            estadoAtencion,
            esVisitaEspontanea: true,
            motivoConsulta:
                String(motivoConsulta || "").trim() || "Visita sin turno",
            enConsultaAt: estadoAtencion === "agendado" ? null : ahora,
            pendienteInformeAt: visitaPendiente ? ahora : null,
            informeCompletadoAt: visitaCompletada ? ahora : null,
            created_at: ahora,
            updated_at: ahora,
        });

        await turno.save();

        try {
            const historial = new HistorialTurno({
                turnoId: turno._id,
                pacienteId: paciente._id,
                nombreCompleto: paciente.nombre,
                telefono: paciente.telefono || "Sin teléfono",
                dni: paciente.dni || "",
                doctor: doctor.nombre,
                especialidad: turno.especialidad || doctor.especialidad,
                fechaTurno: ahora,
                creadoPor: "admin_secretaria",
            });
            await historial.save();
        } catch (historialError) {
            console.error(
                "No se pudo guardar el historial de la visita sin turno:",
                historialError.message
            );
        }

        res.status(201).send({
            ok: true,
            message: "Visita sin turno registrada correctamente.",
            turno,
        });
    } catch (error) {
        console.error("Error al registrar visita sin turno:", error);
        res.status(500).send({
            message: "Error al registrar la visita sin turno.",
        });
    }
};

// Reservar turno como Invitado (Paciente NO Registrado)
// Requiere: dni, nombre, telefono
exports.reservarTurnoInvitado = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const { dni, nombre, telefono, motivoConsulta, estudioId } = req.body;

        // Validar que se especifique el estudio (obligatorio al reservar)
        if (!estudioId) {
            return res.status(400).send({
                message: "Debe seleccionar un estudio para reservar el turno."
            });
        }

        // Validar datos obligatorios del invitado
        if (!dni || !nombre || !telefono) {
            return res.status(400).send({
                message: "Datos faltantes. Se requiere: dni, nombre y telefono."
            });
        }

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        if (turno.estado !== "disponible") {
            return res.status(400).send({ message: "El turno no está disponible." });
        }

        // Guardar datos del paciente no registrado
        turno.pacienteNoRegistrado = {
            dni: dni.trim(),
            nombre: nombre.trim(),
            telefono: telefono.trim(),
        };
        turno.estado = "reservado";
        turno.motivoConsulta = motivoConsulta;
        turno.updated_at = Date.now();
        turno.estudio = estudioId; // El estudio lo elige el paciente al reservar
        turno.estadoAtencion = "agendado";
        turno.enConsultaAt = null;
        turno.pendienteInformeAt = null;
        turno.informeCompletadoAt = null;

        await turno.save();

        const doctor = await Doctor.findById(turno.doctor);

        // Guardar en el Historial
        const historial = new HistorialTurno({
            turnoId: turno._id,
            nombreCompleto: nombre.trim(),
            telefono: telefono.trim(),
            dni: dni.trim(),
            doctor: doctor ? doctor.nombre : "Desconocido",
            especialidad: turno.especialidad || (doctor ? doctor.especialidad : "Desconocida"),
            fechaTurno: turno.fecha,
            creadoPor: "paciente_invitado" // Se usa invitado para Admin también, ya que asigan como invitado a veces.
        });
        await historial.save();

        // Nota: No se envía email ya que no tenemos el email del invitado
        // Si se desea, se puede agregar campo email opcional

        res.status(200).send({
            message: "Turno reservado exitosamente como invitado.",
            turno
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al reservar turno." });
    }
};

// Subir archivo adjunto a un turno (imagen o PDF)
exports.subirArchivoTurno = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const { nombreArchivo } = req.body;

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        if (!req.files || !req.files.archivo) {
            return res.status(400).send({ message: "No se ha subido ningún archivo." });
        }

        const file = req.files.archivo;
        const extension = path.extname(file.originalFilename).toLowerCase();

        // Validar tipo de archivo (solo imágenes y PDF)
        const extensionesPermitidas = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
        if (!extensionesPermitidas.includes(extension)) {
            return res.status(400).send({
                message: "Tipo de archivo no permitido. Solo se aceptan imágenes (jpg, png, webp, gif) y PDF."
            });
        }

        // Determinar tipo de archivo
        const tipoArchivo = extension === '.pdf' ? 'pdf' : 'image';

        // Preparar nombre único para S3
        const originalFilename = file.originalFilename
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, "-");
        const uniqueFilename = `turnos/${turnoId}/${Date.now()}-${originalFilename}`;
        const urlArchivo = `https://${BUCKET_NAME}.s3.${miRegion}.amazonaws.com/${uniqueFilename}`;

        // Leer archivo
        let fileBuffer = await fs.promises.readFile(file.path);

        // Optimizar imágenes (opcional)
        if (tipoArchivo === 'image' && ['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
            try {
                const imagemin = (await import("imagemin")).default;
                const imageminMozjpeg = (await import("imagemin-mozjpeg")).default;
                const imageminPngquant = (await import("imagemin-pngquant")).default;
                const imageminWebp = (await import("imagemin-webp")).default;

                fileBuffer = await imagemin.buffer(fileBuffer, {
                    plugins: [
                        imageminMozjpeg({ quality: 75 }),
                        imageminPngquant({ quality: [0.6, 0.8] }),
                        imageminWebp({ quality: 75 }),
                    ],
                });
            } catch (err) {
                console.log("Optimización de imagen omitida:", err.message);
            }
        }

        const mimeType = mime.lookup(extension) || "application/octet-stream";

        // Subir a S3
        const params = {
            Bucket: BUCKET_NAME,
            Key: uniqueFilename,
            Body: fileBuffer,
            ContentType: mimeType,
            ACL: "public-read",
        };

        const subida = await s3.send(new PutObjectCommand(params));

        // Agregar al array de archivos del turno
        turno.archivosAdjuntos.push({
            urlArchivo,
            nombreArchivo: nombreArchivo || file.originalFilename,
            originalFilename: uniqueFilename,
            idArchivo: subida.$metadata.requestId,
            tipoArchivo,
            fechaSubida: new Date(),
        });

        turno.updated_at = Date.now();
        await turno.save();

        // Eliminar archivo temporal
        await fs.promises.unlink(file.path);

        res.status(200).send({
            message: "Archivo subido exitosamente.",
            archivo: turno.archivosAdjuntos[turno.archivosAdjuntos.length - 1],
            turno
        });
    } catch (error) {
        console.error("Error al subir archivo:", error);
        res.status(500).send({ message: "Error al subir archivo." });
    }
};

// Eliminar archivo adjunto de un turno
exports.eliminarArchivoTurno = async (req, res) => {
    try {
        const { turnoId, archivoId } = req.params;

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        const archivo = turno.archivosAdjuntos.find(
            (a) => a._id.toString() === archivoId
        );
        if (!archivo) {
            return res.status(404).send({ message: "Archivo no encontrado." });
        }

        // Eliminar de S3
        const params = {
            Bucket: BUCKET_NAME,
            Key: archivo.originalFilename,
        };
        await s3.send(new DeleteObjectCommand(params));

        // Eliminar del array
        turno.archivosAdjuntos = turno.archivosAdjuntos.filter(
            (a) => a._id.toString() !== archivoId
        );
        turno.updated_at = Date.now();
        await turno.save();

        res.status(200).send({ message: "Archivo eliminado exitosamente." });
    } catch (error) {
        console.error("Error al eliminar archivo:", error);
        res.status(500).send({ message: "Error al eliminar archivo." });
    }
};

// Cancelar turno
exports.cancelarTurno = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const { motivo } = req.body; // Opcional: guardar motivo de cancelación en comentarios

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        // Resetear todos los campos del turno a su estado inicial
        turno.estado = "disponible";
        turno.paciente = null; // Liberar el turno (paciente registrado)
        turno.pacienteNoRegistrado = null; // Limpiar datos de invitado
        turno.motivoConsulta = null; // Limpiar motivo de consulta
        turno.estudio = null; // Limpiar estudio asociado
        turno.estadoAtencion = "agendado";
        turno.enConsultaAt = null;
        turno.pendienteInformeAt = null;
        turno.informeCompletadoAt = null;

        if (motivo) {
            turno.comentarios = (turno.comentarios || "") + ` [Cancelado previa reserva: ${motivo}]`;
        }
        turno.updated_at = Date.now();

        await turno.save();

        res.status(200).send({ message: "Turno cancelado y puesto disponible nuevamente.", turno });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al cancelar turno." });
    }
};

// Obtener turnos (Filtros varios)
exports.obtenerTurnos = async (req, res) => {
    try {
        const { doctorId, especialidad, fecha, estado } = req.query;
        const filter = {};

        console.log("Query params:", req.query);

        if (doctorId) filter.doctor = doctorId;
        if (especialidad) filter.especialidad = especialidad;
        if (estado) filter.estado = estado;

        // Filtro por fecha (día específico)
        // Filtro por fecha (día específico)
        if (fecha) {
            const [anio, mes, dia] = fecha.split('-');
            const start = new Date(anio, mes - 1, dia);
            start.setHours(0, 0, 0, 0);
            const end = new Date(anio, mes - 1, dia);
            end.setHours(23, 59, 59, 999);
            filter.fecha = { $gte: start, $lte: end };
        } else {
            filter.fecha = { $gte: new Date() };
        }

        const turnos = await Turno.find(filter)
            .populate("doctor", "nombre especialidad")
            .populate("paciente", "nombre email")
            .populate("estudio", "tipo precio aclaraciones")
            .sort({ fecha: 1 });
        //console.log(turnos);
        res.status(200).send(turnos);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al obtener turnos." });
    }
};

// Obtener mis turnos (Paciente)
exports.obtenerMisTurnos = async (req, res) => {
    try {
        const { pacienteId } = req.params; // O desde req.user si hay middleware de auth inyectando usuario

        const turnos = await Turno.find({ paciente: pacienteId })
            .populate("doctor", "nombre especialidad")
            .populate("estudio", "tipo precio aclaraciones")
            .sort({ fecha: 1 });

        res.status(200).send(turnos);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al obtener mis turnos." });
    }
};

// Borrar turno (Admin/Secretaria)
exports.borrarTurno = async (req, res) => {
    try {
        const { turnoId } = req.params;

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        // Opcional: verificar que el turno no esté reservado antes de borrar
        if (turno.estado === "reservado") {
            return res.status(400).send({
                message: "No se puede eliminar un turno reservado. Primero cancele la reserva."
            });
        }

        // Eliminar archivos adjuntos de S3 si existen
        if (turno.archivosAdjuntos && turno.archivosAdjuntos.length > 0) {
            for (const archivo of turno.archivosAdjuntos) {
                try {
                    const params = {
                        Bucket: BUCKET_NAME,
                        Key: archivo.originalFilename,
                    };
                    await s3.send(new DeleteObjectCommand(params));
                } catch (err) {
                    console.error("Error al eliminar archivo de S3:", err.message);
                }
            }
        }

        await Turno.findByIdAndDelete(turnoId);

        res.status(200).send({ message: "Turno eliminado exitosamente." });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al eliminar turno." });
    }
};

// Actualizar turno (cualquier campo)
exports.actualizarTurno = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const datosActualizar = req.body;

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        // Campos permitidos para actualizar
        const camposPermitidos = [
            'fecha', 'doctor', 'paciente', 'pacienteNoRegistrado',
            'estudio', 'especialidad', 'estado', 'comentarios', 'motivoConsulta'
        ];

        // Actualizar solo los campos que vienen en el body
        for (const campo of camposPermitidos) {
            if (datosActualizar[campo] !== undefined) {
                turno[campo] = datosActualizar[campo];
            }
        }

        // Si el turno se libera o queda sin paciente, se reinicia el flujo de atención
        const sinPaciente =
            turno.paciente == null && turno.pacienteNoRegistrado == null;
        if (turno.estado === "disponible" || sinPaciente) {
            turno.estadoAtencion = "agendado";
            turno.enConsultaAt = null;
            turno.pendienteInformeAt = null;
            turno.informeCompletadoAt = null;
        }

        turno.updated_at = Date.now();
        await turno.save();

        // Populate para devolver datos completos
        await turno.populate("doctor", "nombre especialidad");
        await turno.populate("paciente", "nombre email");
        await turno.populate("estudio", "tipo precio aclaraciones");

        res.status(200).send({ message: "Turno actualizado exitosamente.", turno });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al actualizar turno." });
    }
};

// Eliminar turnos masivos (Admin/Secretaria)
// Recibe un array de ids en el body: { ids: ["id1", "id2", ...] }
exports.borrarTurnosMasivo = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send({ message: "Debe proporcionar un array de IDs." });
        }

        // Primero buscamos los turnos para verificar si tienen archivos en S3
        const turnos = await Turno.find({ _id: { $in: ids } });

        for (const turno of turnos) {
            // Eliminar archivos adjuntos de S3 si existen
            if (turno.archivosAdjuntos && turno.archivosAdjuntos.length > 0) {
                for (const archivo of turno.archivosAdjuntos) {
                    try {
                        const params = {
                            Bucket: BUCKET_NAME,
                            Key: archivo.originalFilename,
                        };
                        await s3.send(new DeleteObjectCommand(params));
                    } catch (err) {
                        console.error(`Error al eliminar archivo ${archivo.originalFilename} de S3:`, err.message);
                    }
                }
            }
        }

        const resultado = await Turno.deleteMany({ _id: { $in: ids } });

        res.status(200).send({
            message: `${resultado.deletedCount} turnos eliminados correctamente.`,
            resultado
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al eliminar turnos masivamente." });
    }
};

// Limpiar/Vaciar turnos masivos (Admin/Secretaria)
// Vuelve los turnos al estado "disponible" y limpia datos del paciente
// Recibe un array de ids en el body: { ids: ["id1", "id2", ...] }
exports.limpiarTurnosMasivo = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send({ message: "Debe proporcionar un array de IDs." });
        }

        const resultado = await Turno.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    estado: "disponible",
                    paciente: null,
                    pacienteNoRegistrado: null,
                    motivoConsulta: null,
                    estudio: null,
                    estadoAtencion: "agendado",
                    enConsultaAt: null,
                    pendienteInformeAt: null,
                    informeCompletadoAt: null,
                    updated_at: Date.now()
                }
            }
        );

        res.status(200).send({
            message: `${resultado.modifiedCount} turnos limpiados correctamente.`,
            resultado
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al limpiar turnos masivamente." });
    }
};

const construirTurnosBandeja = async (turnos, inicioDia, finDia) => {
    const idsPacientes = turnos
        .filter((turno) => turno.paciente && turno.paciente._id)
        .map((turno) => turno.paciente._id)
        .filter(
            (id, index, array) =>
                array.findIndex((otro) => otro.toString() === id.toString()) ===
                index
        );

    let primeraFechaPorPaciente = new Map();
    if (idsPacientes.length > 0) {
        const primeras = await Turno.aggregate([
            {
                $match: {
                    paciente: { $in: idsPacientes },
                    estado: { $in: ["reservado", "finalizado"] },
                },
            },
            {
                $group: {
                    _id: "$paciente",
                    primeraFecha: { $min: "$fecha" },
                },
            },
        ]);
        primeraFechaPorPaciente = new Map(
            primeras.map((item) => [
                item._id.toString(),
                new Date(item.primeraFecha).getTime(),
            ])
        );
    }

    return turnos.map((turno) => {
        const estadoAtencion =
            turno.estadoAtencion ||
            (turno.estado === "finalizado"
                ? "informe_completado"
                : "agendado");
        const fechaTurno = new Date(turno.fecha);
        const esDeHoy = fechaTurno >= inicioDia && fechaTurno <= finDia;

        let tipoPaciente = "invitado";
        if (turno.paciente && turno.paciente._id) {
            const primeraFecha = primeraFechaPorPaciente.get(
                turno.paciente._id.toString()
            );
            tipoPaciente =
                primeraFecha !== undefined &&
                fechaTurno.getTime() <= primeraFecha
                    ? "primera_vez"
                    : "control";
        }

        return {
            ...turno,
            estadoAtencion,
            esDeHoy,
            tipoPaciente,
            esPrimeraVez: tipoPaciente === "primera_vez",
        };
    });
};

// Bandeja diaria de pacientes (citas de hoy + informes pendientes de días anteriores)
exports.obtenerBandejaDelDia = async (req, res) => {
    try {
        const ahora = new Date();
        const inicioDia = new Date(
            ahora.getFullYear(),
            ahora.getMonth(),
            ahora.getDate(),
            0, 0, 0, 0
        );
        const finDia = new Date(
            ahora.getFullYear(),
            ahora.getMonth(),
            ahora.getDate(),
            23, 59, 59, 999
        );

        const filtroDelDia = {
            fecha: { $gte: inicioDia, $lte: finDia },
            estado: { $in: ["reservado", "finalizado"] },
        };

        // Persistencia: los pacientes atendidos con informe pendiente
        // siguen en la bandeja aunque la cita sea de un día anterior.
        const filtroPendientes = {
            estadoAtencion: { $in: ["en_consulta", "pendiente_informe"] },
            estado: { $in: ["reservado", "finalizado"] },
        };

        const turnos = await Turno.find({ $or: [filtroDelDia, filtroPendientes] })
            .populate("doctor", "nombre especialidad")
            .populate("paciente", "nombre dni telefono email")
            .populate("estudio", "tipo precio aclaraciones")
            .sort({ fecha: 1 })
            .lean();

        const respuesta = await construirTurnosBandeja(
            turnos,
            inicioDia,
            finDia
        );

        res.status(200).send(respuesta);
    } catch (error) {
        console.error("Error al obtener la bandeja del día:", error);
        res.status(500).send({ message: "Error al obtener la bandeja del día." });
    }
};

// Bandeja paralela: todos los pacientes que concurrieron a una cita,
// sin importar la fecha, para consultar y cambiar su estado de atención.
exports.obtenerBandejaAtendidos = async (req, res) => {
    try {
        const ahora = new Date();
        const inicioDia = new Date(
            ahora.getFullYear(),
            ahora.getMonth(),
            ahora.getDate(),
            0, 0, 0, 0
        );
        const finDia = new Date(
            ahora.getFullYear(),
            ahora.getMonth(),
            ahora.getDate(),
            23, 59, 59, 999
        );

        const turnos = await Turno.find({
            estado: { $in: ["reservado", "finalizado"] },
            $or: [
                {
                    estadoAtencion: {
                        $in: [
                            "en_consulta",
                            "pendiente_informe",
                            "informe_completado",
                        ],
                    },
                },
                { estadoAtencion: { $exists: false }, estado: "finalizado" },
                { estadoAtencion: null, estado: "finalizado" },
            ],
        })
            .populate("doctor", "nombre especialidad")
            .populate("paciente", "nombre dni telefono email")
            .populate("estudio", "tipo precio aclaraciones")
            .sort({ fecha: -1 })
            .lean();

        const respuesta = await construirTurnosBandeja(
            turnos,
            inicioDia,
            finDia
        );

        res.status(200).send(respuesta);
    } catch (error) {
        console.error("Error al obtener la bandeja de atendidos:", error);
        res.status(500).send({
            message: "Error al obtener la bandeja de pacientes atendidos.",
        });
    }
};

// Actualizar el estado de atención de una cita (por turno/estudio)
exports.actualizarEstadoAtencion = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const { estadoAtencion } = req.body;

        if (!ESTADOS_ATENCION.includes(estadoAtencion)) {
            return res.status(400).send({ message: "Estado de atención inválido." });
        }

        const turno = await Turno.findById(turnoId);
        if (!turno) {
            return res.status(404).send({ message: "Turno no encontrado." });
        }

        if (!["reservado", "finalizado"].includes(turno.estado)) {
            return res.status(400).send({
                message: "El turno no tiene una cita activa para gestionar.",
            });
        }

        const estadoAnterior = turno.estadoAtencion;
        turno.estadoAtencion = estadoAtencion;

        switch (estadoAtencion) {
            case "agendado":
                turno.enConsultaAt = null;
                turno.pendienteInformeAt = null;
                turno.informeCompletadoAt = null;
                break;
            case "en_consulta":
                turno.enConsultaAt = new Date();
                turno.pendienteInformeAt = null;
                turno.informeCompletadoAt = null;
                break;
            case "pendiente_informe":
                turno.enConsultaAt = turno.enConsultaAt || new Date();
                turno.pendienteInformeAt = new Date();
                turno.informeCompletadoAt = null;
                break;
            case "informe_completado":
                turno.enConsultaAt = turno.enConsultaAt || new Date();
                turno.pendienteInformeAt = turno.pendienteInformeAt || new Date();
                turno.informeCompletadoAt = new Date();
                break;
            default:
                break;
        }

        // Sincronizar el estado general de la reserva
        if (estadoAtencion === "informe_completado") {
            turno.estado = "finalizado";
        } else if (turno.estado === "finalizado") {
            turno.estado = "reservado";
        }

        turno.updated_at = Date.now();
        await turno.save();

        await turno.populate("doctor", "nombre especialidad");
        await turno.populate("paciente", "nombre dni telefono email");
        await turno.populate("estudio", "tipo precio aclaraciones");

        let emailEnviado = false;
        let emailMotivo = null;
        let emailOmitidos = [];

        if (
            estadoAtencion === "informe_completado" &&
            estadoAnterior !== "informe_completado"
        ) {
            if (!turno.paciente || !turno.paciente.email) {
                emailMotivo = "El paciente no tiene email registrado.";
            } else {
                const configCorreo = await getEmailConfig();

                if (!configCorreo) {
                    emailMotivo = "El servicio de correo no está configurado.";
                } else {
                    try {
                        const pdfs = (turno.archivosAdjuntos || []).filter(esPdf);
                        const { adjuntos, omitidos } = await prepararAdjuntos(pdfs);
                        emailOmitidos = omitidos;
                        emailEnviado = await enviarCorreoInformeListo({
                            paciente: turno.paciente,
                            turno,
                            archivos: adjuntos,
                        });

                        if (!emailEnviado) {
                            emailMotivo =
                                "No se pudo enviar el correo. Verificá la configuración de correo.";
                        }
                    } catch (error) {
                        console.error("Error al enviar correo de informe:", error);
                        emailMotivo = "Error al preparar o enviar el correo.";
                    }
                }
            }
        }

        res.status(200).send({
            message: "Estado de atención actualizado.",
            turno,
            emailEnviado,
            emailMotivo,
            emailOmitidos,
        });
    } catch (error) {
        console.error("Error al actualizar el estado de atención:", error);
        res.status(500).send({ message: "Error al actualizar el estado de atención." });
    }
};
