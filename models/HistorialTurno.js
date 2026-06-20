const mongoose = require("mongoose");

const historialTurnoSchema = new mongoose.Schema({
  fechaReserva: {
    type: Date,
    default: Date.now,
  },
  turnoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Turno",
  },
  pacienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Paciente",
  },
  nombreCompleto: {
    type: String,
    required: true,
  },
  telefono: {
    type: String,
    required: true,
  },
  dni: {
    type: String,
  },
  doctor: {
    type: String,
  },
  especialidad: {
    type: String,
  },
  fechaTurno: {
    type: Date,
  },
  creadoPor: {
    type: String,
    enum: ["paciente_registrado", "paciente_invitado", "admin_secretaria"],
  }
});

module.exports = mongoose.model("HistorialTurno", historialTurnoSchema);
