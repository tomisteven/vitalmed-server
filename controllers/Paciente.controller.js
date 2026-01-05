const Doctor = require("../models/Doctor");
const Paciente = require("../models/Paciente");
const Turno = require("../models/Turno");
const mongoose = require("mongoose");

const getPacientes = async (req, res) => {
  try {
    const pacientes = await Paciente.find();
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const eliminarDoctorDePaciente = async (req, res) => {
  try {
    const { id } = req.params; // ID del paciente desde los parámetros de la URL
    const { idDoctor } = req.body; // ID del doctor a eliminar

    // Buscar el paciente por ID
    const paciente = await Paciente.findById(id);
    const doctor = await Doctor.findById(idDoctor);
    // Verificar si el doctor existe
    if (!doctor) {
      return res.status(404).json({ message: "Doctor no encontrado" });
    }

    // Verificar si el paciente existe
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Eliminar el doctor de la lista de doctores asignados al paciente
    paciente.doctoresAsignados = paciente.doctoresAsignados.filter(
      (doctorId) => doctorId.toString() !== idDoctor
    );

    // Eliminar el paciente de la lista de pacientes asignados al doctor
    doctor.pacientes = doctor.pacientes.filter(
      (pacienteId) => pacienteId.toString() !== id
    );

    // Guardar los cambios en la base de datos
    await paciente.save();
    await doctor.save();

    res.json({ message: "Doctor eliminado del paciente", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const eliminarNotasDelPaciente = async (req, res) => {
  try {
    const { id } = req.params; // ID del paciente desde los parámetros de la URL
    const { idNota } = req.body; // ID de la nota a eliminar

    // Buscar el paciente por ID
    const paciente = await Paciente.findById(id);

    // Verificar si el paciente existe
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Eliminar la nota del paciente
    paciente.notas = paciente.notas.filter(
      (nota) => nota._id.toString() !== idNota
    );

    // Guardar los cambios en la base de datos
    await paciente.save();

    res.json({ message: "Nota eliminada del paciente", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const agregarNotasAlPaciente = async (req, res) => {
  try {
    const { id } = req.params; // ID del paciente desde los parámetros de la URL
    const { nota, author } = req.body; // Nota a agregar

    // Buscar el paciente por ID
    const paciente = await Paciente.findById(id);

    // Verificar si el paciente existe
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Agregar la nota al paciente
    paciente.notas.push({ nota, author });

    // Guardar los cambios en la base de datos
    await paciente.save();

    res.json({ message: "Nota agregada al paciente", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const updatePaciente = async (req, res) => {
  try {
    await Paciente.findOneAndUpdate({ _id: req.params.id }, req.body, {
      includeResultMetadata: true,
    });
    res.json({ message: "Paciente actualizado", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const asignarDoctorAPaciente = async (req, res) => {
  try {
    const { id } = req.params; // ID del paciente desde los parámetros de la URL
    const { idDoctores } = req.body;
    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Verificar si el paciente ya tiene doctores asignados
    const doctorYaAsignado = paciente.doctoresAsignados.some((doctorId) =>
      idDoctores.includes(doctorId.toString())
    );
    // Si el paciente ya tiene el doctor asignado, no se puede volver a asignar

    if (doctorYaAsignado) {
      return res.status(400).json({ message: "Doctor ya asignado", ok: false });
    }

    // Asignar el doctor al paciente
    idDoctores.forEach(async (doctorId) => {
      paciente.doctoresAsignados.push(doctorId);
    });

    // Asignar el paciente al doctor
    for (const doctorId of idDoctores) {
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor no encontrado" });
      }

      // Verificar si el paciente ya está asignado al doctor
      const pacienteYaAsignado = doctor.pacientes.some(
        (pacienteId) => pacienteId.toString() === id
      );
      if (pacienteYaAsignado) {
        return res
          .status(400)
          .json({ message: "Paciente ya asignado", ok: false });
      } else {
        doctor.pacientes.push(id);
        await doctor.save();
      }

      // Si el paciente ya está asignado al doctor, no se puede volver a asignar
    }

    // Verificar si la asignación fue exitosa
    const pacienteActualizado = await Paciente.findById(id).populate(
      "doctoresAsignados"
    );

    if (!pacienteActualizado) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Responder con la lista de doctores asignados al paciente
    await paciente.save();

    res.json({
      message: "Doctor asignado al paciente",
      ok: true,
      doctoresPaciente: paciente.doctoresAsignados,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const getDoctoresAsignados = async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id).populate(
      "doctoresAsignados"
    );
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    let doctores = [];

    // Verificar si el paciente tiene doctores asignados
    if (paciente.doctoresAsignados.length === 0) {
      doctores = [];
    } else {
      doctores = paciente.doctoresAsignados;
    }

    res.json({
      message: "Doctores asignados al paciente",
      doctoresAsignados: doctores,
      ok: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPaciente = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const paciente = await Paciente.findById(req.params.id).populate(
      "doctoresAsignados", "nombre"
    );

    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado", ok: false });
    }

    // Buscar turnos asignados al paciente
    const turnosAsignados = await Turno.find({ paciente: req.params.id })
      .populate("doctor", "nombre especialidad telefono email")
      .populate("estudio", "tipo precio aclaraciones")
      .sort({ fecha: 1 });

    // Agrupar documentos por nombre de archivo
    const documents = paciente.documentos.reduce((acc, documento) => {
      // Verificar si ya existe un grupo para este nombre de archivo
      const existingGroup = acc.find(
        (group) => group.nombreArchivo === documento.nombreArchivo
      );

      if (existingGroup) {
        // Si existe, agregar el documento al grupo
        existingGroup.archivos.push(documento);
      } else {
        // Si no existe, crear un nuevo grupo
        acc.push({
          nombreArchivo: documento.nombreArchivo,
          archivos: [documento],
        });
      }

      return acc;
    }, []);

    res.json({
      paciente,
      documentosAgrupados: documents,
      doctoresAsignados: paciente.doctoresAsignados,
      turnosAsignados: turnosAsignados,
      message: "Paciente encontrado",
      ok: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const createPaciente = async (req, res) => {
  try {
    const { dni, password } = req.body;
    const pacienteExistente = await Paciente.findOne({ dni });
    if (pacienteExistente) {
      return res
        .status(400)
        .json({ message: "Ya existe un paciente con ese DNI", ok: false });
    }

    const paciente = new Paciente(req.body);
    if (password) {
      paciente.password = password;
    } else {
      paciente.password = dni;
    }
    await paciente.save();
    res.json({ message: "Paciente creado", paciente, ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const deletePaciente = async (req, res) => {
  try {
    await Paciente.findByIdAndDelete(req.params.id);
    res.json({ message: "Paciente eliminado", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

async function getDocumentsGroupedByName(req, res) {
  try {
    // Obtener el ID del usuario desde los parámetros de la URL
    const { id } = req.params;

    // Buscar el usuario por ID en la base de datos
    const user = await Paciente.findById(id);

    // Verificar si el usuario existe
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Agrupar documentos por nombre de archivo
    const documents = user.documentos.reduce((acc, documento) => {
      // Verificar si ya existe un grupo para este nombre de archivo
      const existingGroup = acc.find(
        (group) => group.nombreArchivo === documento.nombreArchivo
      );

      if (existingGroup) {
        // Si existe, agregar el documento al grupo
        existingGroup.archivos.push(documento);
      } else {
        // Si no existe, crear un nuevo grupo
        acc.push({
          nombreArchivo: documento.nombreArchivo,
          archivos: [documento],
        });
      }

      return acc;
    }, []);

    // Devolver los documentos agrupados
    return res.json(documents);
  } catch (error) {
    console.error("Error al obtener documentos:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

const getPacientesShort = async (req, res) => {
  try {
    const pacientes = await Paciente.find().select("nombre dni");
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPacientes,
  getPaciente,
  createPaciente,
  deletePaciente,
  updatePaciente,
  getDocumentsGroupedByName,
  getDoctoresAsignados,
  asignarDoctorAPaciente,
  agregarNotasAlPaciente,
  eliminarDoctorDePaciente,
  eliminarNotasDelPaciente,
  getPacientesShort,
};
