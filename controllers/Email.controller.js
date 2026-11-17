const Paciente = require("../models/Paciente");
const Turno = require("../models/Turno");
const { enviarCorreoInformeListo } = require("../utils/emailService");
const { getEmailConfig } = require("../utils/emailConfig");
const { prepararAdjuntos } = require("../utils/archivosAdjuntos");

const construirUrlsPermitidas = async (paciente, turnoId) => {
  const urls = new Set(
    (paciente.documentos || [])
      .map((documento) => documento.urlArchivo)
      .filter(Boolean)
  );

  const filtroTurnos = { paciente: paciente._id };
  if (turnoId) filtroTurnos._id = turnoId;

  const turnos = await Turno.find(filtroTurnos).select("archivosAdjuntos");

  turnos.forEach((turno) => {
    (turno.archivosAdjuntos || []).forEach((archivo) => {
      if (archivo.urlArchivo) urls.add(archivo.urlArchivo);
    });
  });

  return urls;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.enviarInforme = async (req, res) => {
  try {
    const { pacienteId, turnoId, asunto, mensaje, archivos, email } = req.body;

    if (!pacienteId) {
      return res.status(400).send({ message: "Debe indicar el paciente." });
    }

    const configCorreo = await getEmailConfig();
    if (!configCorreo) {
      return res.status(400).send({
        message:
          "El servicio de correo no está configurado. Configuralo desde el panel de administración.",
      });
    }

    const paciente = await Paciente.findById(pacienteId);
    if (!paciente) {
      return res.status(404).send({ message: "Paciente no encontrado." });
    }

    const emailSolicitado = String(email || "").trim();
    const emailDestino = emailSolicitado || paciente.email;

    if (!emailDestino) {
      return res.status(400).send({
        message:
          "El paciente no tiene un email registrado. Ingresá uno para enviar el informe.",
      });
    }

    if (!EMAIL_REGEX.test(emailDestino)) {
      return res.status(400).send({ message: "El email ingresado no es válido." });
    }

    let turno = null;
    if (turnoId) {
      turno = await Turno.findOne({
        _id: turnoId,
        paciente: paciente._id,
      })
        .populate("doctor", "nombre")
        .populate("estudio", "tipo");

      if (!turno) {
        return res.status(404).send({
          message: "Turno no encontrado o no pertenece al paciente.",
        });
      }
    }

    const urlsPermitidas = await construirUrlsPermitidas(paciente, turnoId);

    const archivosSolicitados = Array.isArray(archivos) ? archivos : [];
    const archivosValidos = archivosSolicitados.filter(
      (archivo) =>
        archivo?.urlArchivo && urlsPermitidas.has(archivo.urlArchivo)
    );

    if (archivosSolicitados.length > 0 && archivosValidos.length === 0) {
      return res.status(400).send({
        message:
          "No se encontraron archivos válidos para enviar. Verificá que pertenezcan al paciente.",
      });
    }

    const { adjuntos, omitidos } = await prepararAdjuntos(archivosValidos);

    if (archivosValidos.length > 0 && adjuntos.length === 0) {
      return res.status(400).send({
        message: "No se pudo adjuntar ningún archivo.",
        omitidos,
      });
    }

    const pacienteParaEnvio = {
      ...paciente.toObject(),
      email: emailDestino,
    };

    const enviado = await enviarCorreoInformeListo({
      paciente: pacienteParaEnvio,
      turno,
      archivos: adjuntos,
      asunto,
      mensaje,
    });

    if (!enviado) {
      return res.status(500).send({
        message:
          "No se pudo enviar el correo. Verificá la configuración de correo en el panel de administración.",
        omitidos,
      });
    }

    res.status(200).send({
      ok: true,
      message: "Correo enviado correctamente.",
      enviados: adjuntos.length,
      omitidos,
      email: emailDestino,
    });
  } catch (error) {
    console.error("Error al enviar informe:", error);
    res.status(500).send({ message: "Error al enviar el correo." });
  }
};

exports.estadoCorreo = async (req, res) => {
  const config = await getEmailConfig();
  res.status(200).send({
    configurado: Boolean(config),
    origen: config?.source || null,
    usuario: config?.usuario || "",
    servicio: config?.servicio || "",
  });
};
