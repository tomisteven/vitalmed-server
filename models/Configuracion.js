const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ConfiguracionSchema = new Schema(
  {
    clave: { type: String, default: "general", unique: true },
    email: {
      activo: { type: Boolean, default: true },
      servicio: {
        type: String,
        enum: ["gmail", "smtp"],
        default: "gmail",
      },
      usuario: { type: String, default: "" },
      password: { type: String, default: "" },
      remitente: { type: String, default: "" },
      smtpHost: { type: String, default: "" },
      smtpPort: { type: Number, default: 587 },
      smtpSecure: { type: Boolean, default: false },
      plantillas: {
        confirmacionAsunto: { type: String, default: "" },
        confirmacionMensaje: { type: String, default: "" },
        informeAsunto: { type: String, default: "" },
        informeMensaje: { type: String, default: "" },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Configuracion", ConfiguracionSchema);
