const nodemailer = require("nodemailer");

// Configuración del transporte (Placeholder - configurar con credenciales reales en .env)
const transporter = nodemailer.createTransport({
    service: "gmail", // O el servicio que use el cliente
    auth: {
        user: process.env.EMAIL_USER || "test@example.com",
        pass: process.env.EMAIL_PASS || "password",
    },
});

const enviarCorreoConfirmacion = async (turno, paciente) => {
    try {
        if (!paciente || !paciente.email) {
            console.log("No se puede enviar correo: Paciente sin email.");
            return;
        }

        const mailOptions = {
            from: '"Vitalmed" <no-reply@vitalmed.com>',
            to: paciente.email,
            subject: "Confirmación de Turno - Vitalmed",
            html: `
        <h1>Turno Confirmado</h1>
        <p>Hola ${paciente.nombre},</p>
        <p>Tu turno ha sido reservado exitosamente.</p>
        <ul>
          <li><strong>Fecha:</strong> ${new Date(turno.fecha).toLocaleString()}</li>
          <li><strong>Especialidad:</strong> ${turno.especialidad}</li>
          <li><strong>Estado:</strong> ${turno.estado}</li>
        </ul>
        <p>Gracias por confiar en Vitalmed.</p>
      `,
        };

        // En un entorno real, descomentar la siguiente línea:
        // await transporter.sendMail(mailOptions);
        console.log(`[SIMULACIÓN] Correo enviado a ${paciente.email} sobre el turno ${turno._id}`);
        return true;
    } catch (error) {
        console.error("Error enviando correo:", error);
        return false;
    }
};

module.exports = {
    enviarCorreoConfirmacion,
};
