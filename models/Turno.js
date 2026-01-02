const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TurnoSchema = new Schema({
  fecha: { type: Date, required: true },
  doctor: {
    type: Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  paciente: {
    type: Schema.Types.ObjectId,
    ref: "Paciente",
    default: null,
  },
  estudio: {
    type: Schema.Types.ObjectId,
    ref: "Estudio",
    default: null,
  },
  especialidad: { type: String }, // Snapshot of doctor's specialty at time of creation
  estado: {
    type: String,
    enum: ["disponible", "reservado", "cancelado", "finalizado"],
    default: "disponible",
  },
  comentarios: { type: String },
  motivoConsulta: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Turno", TurnoSchema);
