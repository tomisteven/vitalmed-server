const Configuracion = require("../models/Configuracion");
const { decrypt } = require("./encryption");
const { mezclarPlantillas } = require("./emailTemplates");

const remitentePorDefecto = (usuario) =>
  `"DoctoraEcos" <${usuario || "no-reply@doctoraecos.com"}>`;

const configDesdeEntorno = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  const usaSmtp = Boolean(process.env.SMTP_HOST);
  return {
    source: "entorno",
    activo: true,
    servicio: usaSmtp
      ? "smtp"
      : process.env.EMAIL_SERVICE || "gmail",
    usuario: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    remitente:
      process.env.EMAIL_FROM || remitentePorDefecto(process.env.EMAIL_USER),
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpSecure:
      String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    plantillas: mezclarPlantillas(),
  };
};

const getEmailConfig = async () => {
  let documento = null;

  try {
    documento = await Configuracion.findOne({ clave: "general" }).lean();
  } catch (error) {
    console.error("Error al leer configuración de correo:", error.message);
  }

  const email = documento?.email || {};

  if (email.activo === false) return null;

  const password = email.password ? decrypt(email.password) : "";

  if (email.usuario && password) {
    return {
      source: "base",
      activo: true,
      servicio: email.servicio || "gmail",
      usuario: email.usuario,
      password,
      remitente: email.remitente || remitentePorDefecto(email.usuario),
      smtpHost: email.smtpHost || "",
      smtpPort: Number(email.smtpPort) || 587,
      smtpSecure: Boolean(email.smtpSecure),
      plantillas: mezclarPlantillas(email.plantillas),
    };
  }

  return configDesdeEntorno();
};

module.exports = {
  getEmailConfig,
  remitentePorDefecto,
};
