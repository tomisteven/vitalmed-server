const Paciente = require("../models/Paciente");
const Secretaria = require("../models/Secretaria");
const Doctor = require("../models/Doctor");
const Turno = require("../models/Turno");
const Estudio = require("../models/Estudio");

const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;

    const secretaria = await Secretaria.findOne({ usuario });

    if (secretaria && secretaria.password === password) {
      return res.json({
        message: "Secretaria logueada",
        usuario: secretaria,
        ok: true,
        rol: "secretaria",
      });
    } else {
      const doctor = await Doctor.findOne({ usuario });
      if (doctor && doctor.password === password) {
        return res.json({
          message: "Doctor logueado",
          usuario: doctor,
          ok: true,
          rol: "doctor",
        });
      } else {
        const paciente = await Paciente.findOne({
          usuario
        });
        if (paciente && paciente.password === password) {
          return res.json({
            message: "Paciente logueado",
            usuario: paciente,
            ok: true,
            rol: "paciente",
          });
        } else {
          return res.status(400).json({ message: "Usuario no encontrado" });
        }
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Dashboard de estadísticas y reportes
const getDashboardStats = async (req, res) => {
  try {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo de esta semana
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 7); // Sábado fin de semana
    const hace30Dias = new Date(hoy);
    hace30Dias.setDate(hoy.getDate() - 30);
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hoy.getDate() - 7);

    // ==================== CONTADORES GENERALES ====================
    const [
      totalPacientes,
      totalDoctores,
      totalSecretarias,
      totalEstudios,
      totalTurnos
    ] = await Promise.all([
      Paciente.countDocuments(),
      Doctor.countDocuments(),
      Secretaria.countDocuments(),
      Estudio.countDocuments(),
      Turno.countDocuments()
    ]);

    // ==================== ESTADÍSTICAS DE TURNOS ====================
    const [
      turnosDisponibles,
      turnosReservados,
      turnosCancelados,
      turnosFinalizados,
      turnosHoy,
      turnosSemana,
      turnosMes,
      turnosFuturos
    ] = await Promise.all([
      Turno.countDocuments({ estado: "disponible" }),
      Turno.countDocuments({ estado: "reservado" }),
      Turno.countDocuments({ estado: "cancelado" }),
      Turno.countDocuments({ estado: "finalizado" }),
      Turno.countDocuments({
        fecha: { $gte: ahora, $lt: new Date(hoy.getTime() + 24 * 60 * 60 * 1000) }
      }),
      Turno.countDocuments({ fecha: { $gte: inicioSemana } }),
      Turno.countDocuments({ fecha: { $gte: inicioMes } }),
      Turno.countDocuments({ fecha: { $gte: ahora }, estado: "reservado" })
    ]);

    // TURNOS RESERVADOS PARA ESTA SEMANA (con todos los datos para secretarias)
    const turnosReservadosSemanaActual = await Turno.find({
      fecha: { $gte: hoy, $lt: finSemana },
      estado: "reservado"
    })
      .populate("doctor", "nombre especialidad telefono email")
      .populate("paciente", "nombre telefono email dni obraSocial")
      .populate("estudio", "tipo precio aclaraciones")
      .sort({ fecha: 1 });

    // Turnos de pacientes registrados vs invitados
    const turnosPacientesRegistrados = await Turno.countDocuments({
      paciente: { $ne: null },
      estado: "reservado"
    });
    const turnosPacientesInvitados = await Turno.countDocuments({
      "pacienteNoRegistrado.dni": { $exists: true, $ne: null },
      estado: "reservado"
    });

    // ==================== ESTADÍSTICAS DE PACIENTES ====================
    const pacientesNuevosMes = await Paciente.countDocuments({
      created_at: { $gte: inicioMes }
    });
    const pacientesNuevosSemana = await Paciente.countDocuments({
      created_at: { $gte: hace7Dias }
    });

    // Pacientes con documentos
    const pacientesConDocumentos = await Paciente.countDocuments({
      "documentos.0": { $exists: true }
    });

    // ==================== ESTADÍSTICAS DE DOCTORES ====================
    // Turnos por doctor (top 5)
    const turnosPorDoctor = await Turno.aggregate([
      { $match: { estado: { $in: ["reservado", "finalizado"] } } },
      { $group: { _id: "$doctor", totalTurnos: { $sum: 1 } } },
      { $sort: { totalTurnos: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctorInfo"
        }
      },
      { $unwind: "$doctorInfo" },
      {
        $project: {
          _id: 1,
          totalTurnos: 1,
          nombre: "$doctorInfo.nombre",
          especialidad: "$doctorInfo.especialidad"
        }
      }
    ]);

    // Turnos por especialidad
    const turnosPorEspecialidad = await Turno.aggregate([
      { $match: { especialidad: { $exists: true, $ne: null } } },
      { $group: { _id: "$especialidad", total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // ==================== ESTADÍSTICAS DE ESTUDIOS ====================
    const estudiosActivos = await Estudio.countDocuments({ activo: true });

    // Estudios más solicitados
    const estudiosMasSolicitados = await Turno.aggregate([
      { $match: { estudio: { $exists: true, $ne: null } } },
      { $group: { _id: "$estudio", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "estudios",
          localField: "_id",
          foreignField: "_id",
          as: "estudioInfo"
        }
      },
      { $unwind: { path: "$estudioInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          total: 1,
          tipo: "$estudioInfo.tipo",
          precio: "$estudioInfo.precio"
        }
      }
    ]);

    // ==================== TENDENCIAS (últimos 7 días) ====================
    const turnosPorDia = await Turno.aggregate([
      { $match: { fecha: { $gte: hace7Dias } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$fecha" }
          },
          total: { $sum: 1 },
          reservados: {
            $sum: { $cond: [{ $eq: ["$estado", "reservado"] }, 1, 0] }
          },
          disponibles: {
            $sum: { $cond: [{ $eq: ["$estado", "disponible"] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Nuevos pacientes por día (últimos 7 días)
    const pacientesPorDia = await Paciente.aggregate([
      { $match: { created_at: { $gte: hace7Dias } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // ==================== PRÓXIMOS TURNOS ====================
    const proximosTurnos = await Turno.find({
      fecha: { $gte: ahora },
      estado: "reservado"
    })
      .populate("doctor", "nombre especialidad")
      .populate("paciente", "nombre telefono email")
      .populate("estudio", "tipo precio")
      .sort({ fecha: 1 })
      .limit(10);

    // ==================== OBRAS SOCIALES ====================
    const obrasSociales = await Paciente.aggregate([
      { $match: { obraSocial: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: "$obraSocial", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    // ==================== RESPUESTA ====================
    res.json({
      ok: true,
      timestamp: ahora,

      // Contadores generales
      contadores: {
        pacientes: totalPacientes,
        doctores: totalDoctores,
        secretarias: totalSecretarias,
        estudios: totalEstudios,
        turnos: totalTurnos
      },

      // Estadísticas de turnos
      turnos: {
        porEstado: {
          disponibles: turnosDisponibles,
          reservados: turnosReservados,
          cancelados: turnosCancelados,
          finalizados: turnosFinalizados
        },
        porPeriodo: {
          hoy: turnosHoy,
          estaSemana: turnosSemana,
          esteMes: turnosMes,
          futurosReservados: turnosFuturos,
          reservadosSemanaActual: turnosReservadosSemanaActual // IMPORTANTE para secretarias
        },
        porTipoPaciente: {
          registrados: turnosPacientesRegistrados,
          invitados: turnosPacientesInvitados
        },
        porDoctor: turnosPorDoctor,
        porEspecialidad: turnosPorEspecialidad,
        proximosTurnos
      },

      // Estadísticas de pacientes
      pacientes: {
        total: totalPacientes,
        nuevosMes: pacientesNuevosMes,
        nuevosSemana: pacientesNuevosSemana,
        conDocumentos: pacientesConDocumentos,
        obrasSociales
      },

      // Estadísticas de estudios
      estudios: {
        total: totalEstudios,
        activos: estudiosActivos,
        masSolicitados: estudiosMasSolicitados
      },

      // Tendencias
      tendencias: {
        turnosPorDia,
        pacientesPorDia
      }
    });

  } catch (error) {
    console.error("Error en getDashboardStats:", error);
    res.status(500).json({ message: error.message, ok: false });
  }
};

module.exports = {
  login,
  getDashboardStats,
};
