const Configuracion = require("../models/Configuracion");
const { getEmailConfig, remitentePorDefecto } = require("../utils/emailConfig");
const { encrypt } = require("../utils/encryption");
const { mezclarPlantillas } = require("../utils/emailTemplates");
const { enviarCorreo, layoutCorreo } = require("../utils/emailService");

const sanitizarEmail = async () => {
  const documento = await Configuracion.findOne({ clave: "general" }).lean();
  const email = documento?.email || {};
  const config = await getEmailConfig();

  return {
    activo: email.activo !== false,
    servicio: email.servicio || "gmail",
    usuario: email.usuario || "",
    remitente: email.remitente || "",
    smtpHost: email.smtpHost || "",
    smtpPort: email.smtpPort || 587,
    smtpSecure: Boolean(email.smtpSecure),
    passwordConfigurada:
      Boolean(email.password) || Boolean(process.env.EMAIL_PASS),
    configurado: Boolean(config),
    origen: config?.source || "sin_configurar",
    plantillas: mezclarPlantillas(email.plantillas),
  };
};

exports.obtenerEmail = async (req, res) => {
  try {
    const email = await sanitizarEmail();
    res.status(200).send(email);
  } catch (error) {
    console.error("Error al obtener configuración de correo:", error);
    res.status(500).send({ message: "Error al obtener la configuración." });
  }
};

exports.guardarEmail = async (req, res) => {
  try {
    const {
      activo,
      servicio,
      usuario,
      password,
      remitente,
      smtpHost,
      smtpPort,
      smtpSecure,
      plantillas,
    } = req.body;

    const servicioNormalizado = servicio === "smtp" ? "smtp" : "gmail";
    const usuarioNormalizado = String(usuario || "").trim();

    if (!usuarioNormalizado) {
      return res.status(400).send({
        message: "El usuario o correo electrónico es obligatorio.",
      });
    }

    if (servicioNormalizado === "smtp" && !String(smtpHost || "").trim()) {
      return res.status(400).send({
        message: "El host SMTP es obligatorio para el proveedor SMTP.",
      });
    }

    const documento = await Configuracion.findOne({ clave: "general" });
    const emailActual = documento?.email || {};
    const plantillasActuales = emailActual.plantillas
      ? emailActual.plantillas.toObject?.() || emailActual.plantillas
      : {};

    let passwordEncriptada = emailActual.password || "";
    const passwordLimpia = String(password || "").trim();

    if (passwordLimpia) {
      passwordEncriptada = encrypt(passwordLimpia);
    }

    if (!passwordEncriptada) {
      return res.status(400).send({
        message: "La contraseña es obligatoria la primera vez que configurás el correo.",
      });
    }

    const email = {
      activo: activo !== undefined ? Boolean(activo) : true,
      servicio: servicioNormalizado,
      usuario: usuarioNormalizado,
      password: passwordEncriptada,
      remitente:
        String(remitente || "").trim() ||
        remitentePorDefecto(usuarioNormalizado),
      smtpHost: String(smtpHost || "").trim(),
      smtpPort: Number(smtpPort) || 587,
      smtpSecure: Boolean(smtpSecure),
      plantillas: mezclarPlantillas({
        ...plantillasActuales,
        ...(plantillas || {}),
      }),
    };

    await Configuracion.findOneAndUpdate(
      { clave: "general" },
      { $set: { email } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).send({
      ok: true,
      message: "Configuración de correo guardada correctamente.",
    });
  } catch (error) {
    console.error("Error al guardar configuración de correo:", error);
    res.status(500).send({ message: "Error al guardar la configuración." });
  }
};

exports.probarEmail = async (req, res) => {
  try {
    const { destinatario } = req.body;
    const config = await getEmailConfig();

    if (!config) {
      return res.status(400).send({
        message: "Primero guardá una configuración de correo válida.",
      });
    }

    const to = String(destinatario || "").trim() || config.usuario;

    if (!to) {
      return res.status(400).send({
        message: "Indicá un destinatario para la prueba.",
      });
    }

    const enviado = await enviarCorreo({
      to,
      subject: "Prueba de configuración - DoctoraEcos",
      html: layoutCorreo({
        titulo: "Configuración de correo correcta",
        subtitulo: "Este es un correo de prueba",
        contenido: `
          <p style="margin:0 0 14px;">¡Hola!</p>
          <p style="margin:0 0 14px;">
            La configuración de correo de DoctoraEcos está funcionando correctamente.
          </p>
          <p style="margin:0;">
            Este mensaje se envió desde el panel de administración como prueba.
          </p>
        `,
      }),
    });

    if (!enviado) {
      return res.status(500).send({
        message:
          "No se pudo enviar el correo de prueba. Revisá el usuario, la contraseña y el proveedor.",
      });
    }

    res.status(200).send({
      ok: true,
      message: `Correo de prueba enviado a ${to}.`,
    });
  } catch (error) {
    console.error("Error al probar correo:", error);
    res.status(500).send({ message: "Error al probar el correo." });
  }
};
