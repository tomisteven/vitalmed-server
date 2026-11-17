const nodemailer = require("nodemailer");
const { getEmailConfig } = require("./emailConfig");
const {
  CLINICA,
  TELEFONO,
  DIRECCION,
  escaparHtml,
  mezclarPlantillas,
  renderPlantilla,
  renderAsunto,
} = require("./emailTemplates");

const crearTransporter = (config) => {
  if (config.servicio === "smtp") {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort) || 587,
      secure: Boolean(config.smtpSecure),
      auth: {
        user: config.usuario,
        pass: config.password,
      },
    });
  }

  return nodemailer.createTransport({
    service: config.servicio || "gmail",
    auth: {
      user: config.usuario,
      pass: config.password,
    },
  });
};

const formatoFecha = (fecha) => {
  if (!fecha) return "Fecha a confirmar";
  return new Date(fecha).toLocaleString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const layoutCorreo = ({ titulo, subtitulo, contenido }) => `
  <div style="margin:0;padding:0;background:#f6f0f8;font-family:Cambria,Georgia,'Times New Roman',serif;color:#2f2938;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="border-radius:24px;overflow:hidden;background:#ffffff;border:1px solid #eee3f1;box-shadow:0 18px 45px rgba(40,20,45,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#3b1f35 0%,#653057 55%,#a8518a 100%);color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">DoctoraEcos</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;font-weight:700;">${titulo}</h1>
          ${subtitulo ? `<p style="margin:8px 0 0;font-size:14px;opacity:0.8;">${subtitulo}</p>` : ""}
        </div>
        <div style="padding:28px 32px;font-size:15px;line-height:1.7;color:#4a4152;">
          ${contenido}
        </div>
        <div style="padding:18px 32px;background:#fbf7fa;border-top:1px solid #f1e8f4;font-size:12px;line-height:1.6;color:#7b6e86;">
          <strong style="color:#653057;">DoctoraEcos</strong> · Dra. Jeremmy Gutierrez<br/>
          Centro Policlínico Valencia (Clínica La Viña), Torre C, Piso 1, Consultorio 102.<br/>
          Valencia, Carabobo · WhatsApp: +58 424-466-4961
        </div>
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#9b8fa4;">
        Este correo fue generado automáticamente por el sistema de turnos.
      </p>
    </div>
  </div>
`;

const enviarCorreo = async ({
  to,
  subject,
  html,
  attachments = [],
  config,
}) => {
  const configuracion = config || (await getEmailConfig());

  if (!configuracion) {
    console.warn(
      "[EMAIL] Servicio no configurado. Configuralo desde el panel de administración."
    );
    return false;
  }

  try {
    const transporter = crearTransporter(configuracion);
    await transporter.sendMail({
      from: configuracion.remitente,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`[EMAIL] Correo enviado a ${to}`);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error al enviar:", error.message);
    return false;
  }
};

const enviarCorreoConfirmacion = async (turno, paciente) => {
  if (!paciente || !paciente.email) {
    console.log("[EMAIL] No se puede enviar confirmación: paciente sin email.");
    return false;
  }

  const config = await getEmailConfig();

  if (!config) {
    console.warn(
      "[EMAIL] No se puede enviar la confirmación: correo sin configurar."
    );
    return false;
  }

  const plantillas = mezclarPlantillas(config.plantillas);
  const variables = {
    paciente: paciente.nombre || "paciente",
    fecha: formatoFecha(turno?.fecha),
    especialidad: turno?.especialidad || "Ultrasonografía",
    motivo: turno?.motivoConsulta || "",
    clinica: CLINICA,
    telefono: TELEFONO,
    direccion: DIRECCION,
  };
  const contenido = renderPlantilla(plantillas.confirmacionMensaje, variables);

  return enviarCorreo({
    to: paciente.email,
    subject: renderAsunto(plantillas.confirmacionAsunto, variables),
    html: layoutCorreo({
      titulo: "Turno confirmado",
      subtitulo: "Tu cita quedó reservada correctamente",
      contenido,
    }),
    config,
  });
};

const enviarCorreoInformeListo = async ({
  paciente,
  turno,
  archivos = [],
  asunto,
  mensaje,
}) => {
  if (!paciente || !paciente.email) {
    console.log("[EMAIL] No se puede enviar informe: paciente sin email.");
    return false;
  }

  const config = await getEmailConfig();

  if (!config) {
    console.warn(
      "[EMAIL] No se puede enviar el informe: correo sin configurar."
    );
    return false;
  }

  const plantillas = mezclarPlantillas(config.plantillas);
  const nombresAdjuntos = archivos
    .map((archivo) => archivo.filename)
    .filter(Boolean);

  const listaAdjuntos =
    nombresAdjuntos.length > 0
      ? `<p style="margin:0 0 8px;"><strong>Archivos adjuntos:</strong></p>
         <ul style="margin:0 0 18px;padding-left:20px;">
           ${nombresAdjuntos
             .map((nombre) => `<li>${escaparHtml(nombre)}</li>`)
             .join("")}
         </ul>`
      : "";

  const variables = {
    paciente: paciente.nombre || "paciente",
    fecha: turno?.fecha ? formatoFecha(turno.fecha) : "",
    estudio: turno?.estudio?.tipo || "",
    doctor: turno?.doctor?.nombre || "",
    clinica: CLINICA,
    telefono: TELEFONO,
    direccion: DIRECCION,
    adjuntos: listaAdjuntos,
  };
  const contenido = renderPlantilla(
    mensaje || plantillas.informeMensaje,
    variables
  );

  return enviarCorreo({
    to: paciente.email,
    subject: renderAsunto(asunto || plantillas.informeAsunto, variables),
    html: layoutCorreo({
      titulo: "Informe médico disponible",
      subtitulo: "Resultados de tu estudio",
      contenido,
    }),
    attachments: archivos,
    config,
  });
};

module.exports = {
  layoutCorreo,
  enviarCorreo,
  enviarCorreoConfirmacion,
  enviarCorreoInformeListo,
};
