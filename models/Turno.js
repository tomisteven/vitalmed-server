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
  // Para pacientes no registrados (invitados)
  pacienteNoRegistrado: {
    dni: { type: String },
    nombre: { type: String },
    telefono: { type: String },
  },
  // Archivos adjuntos (imágenes/PDF subidos a S3)
  archivosAdjuntos: [
    {
      urlArchivo: { type: String },
      nombreArchivo: { type: String },
      originalFilename: { type: String },
      idArchivo: { type: String },
      tipoArchivo: { type: String }, // 'image' | 'pdf'
      fechaSubida: { type: Date, default: Date.now },
    },
  ],
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
