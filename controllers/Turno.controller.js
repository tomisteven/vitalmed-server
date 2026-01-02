const Turno = require("../models/Turno");
const Doctor = require("../models/Doctor");
const Paciente = require("../models/Paciente");
const { enviarCorreoConfirmacion } = require("../utils/emailService");

// Crear disponibilidad (Admin/Secretaria)
// Recibe: doctorId, fecha (Date), horaInicio (HH:mm), horaFin (HH:mm), intervalo (minutos)
// O simplemente una lista de fechas/horas específicas.
// Para simplificar según el requerimiento "cargar por dia que horarios disponible hay":
// Vamos a asumir que envían un array de fechas/horas exactas para crear los slots.

exports.crearDisponibilidad = async (req, res) => {
    try {
        const { doctorId, horarios, estudioId } = req.body; // horarios es un array de ISO Dates

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
                estudio: estudioId,
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

// Reservar turno (Paciente/Secretaria)
exports.reservarTurno = async (req, res) => {
    try {
        const { turnoId } = req.params;
        const { pacienteId, motivoConsulta, estudioId } = req.body;

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

        turno.paciente = pacienteId;
        turno.estado = "reservado";
        turno.motivoConsulta = motivoConsulta;
        turno.updated_at = Date.now();
        turno.estudio = estudioId;

        await turno.save();

        // Enviar email
        await enviarCorreoConfirmacion(turno, paciente);

        res.status(200).send({ message: "Turno reservado exitosamente.", turno });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al reservar turno." });
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

        turno.estado = "disponible";
        turno.paciente = null; // Liberar el turno
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

        if (doctorId) filter.doctor = doctorId;
        if (especialidad) filter.especialidad = especialidad;
        if (estado) filter.estado = estado;

        // Filtro por fecha (día específico)
        if (fecha) {
            const start = new Date(fecha);
            start.setHours(0, 0, 0, 0);
            const end = new Date(fecha);
            end.setHours(23, 59, 59, 999);
            filter.fecha = { $gte: start, $lte: end };
        }

        // Filtrar turnos que ya pasaron (solo mostrar futuros)
        // Si no se especificó un filtro de fecha, agregar filtro de fecha futura
        if (!filter.fecha) {
            filter.fecha = { $gte: new Date() };
        } else {
            // Si ya hay filtro de fecha, asegurarse que también sea >= ahora
            filter.fecha.$gte = new Date();
        }

        const turnos = await Turno.find(filter)
            .populate("doctor", "nombre especialidad")
            .populate("paciente", "nombre email")
            .populate("estudio", "tipo precio aclaraciones")
            .sort({ fecha: 1 });

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
