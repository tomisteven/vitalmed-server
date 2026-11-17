const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const GaleriaItemSchema = new Schema({
  categoria: {
    type: String,
    enum: ["instalaciones", "estudios"],
    default: "estudios",
    required: true,
  },
  titulo: { type: String, required: true, trim: true },
  resumen: { type: String, default: "" },
  indicaciones: { type: String, default: "" },
  portada: { type: String, default: "" },
  fotos: [{ type: String }],
  estudio: {
    type: Schema.Types.ObjectId,
    ref: "Estudio",
    default: null,
  },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("GaleriaItem", GaleriaItemSchema);
