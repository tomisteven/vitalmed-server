const express = require("express");
const router = express.Router();
const TurnoController = require("../controllers/Turno.controller");

// Middleware para manejar archivos (multipart/form-data)
const multipart = require("connect-multiparty");
const md_upload = multipart({ uploadDir: "./uploads" });

// Rutas para gestión de turnos

// Crear disponibilidad (Admin/Secretaria)
router.post("/turnos/disponibilidad", TurnoController.crearDisponibilidad);

// Registrar una visita sin turno (paciente registrado que llegó sin cita)
router.post("/turnos/visita-sin-turno", TurnoController.crearVisitaSinTurno);

// Reservar turno (Paciente Registrado)
router.post("/turnos/reservar/:turnoId", TurnoController.reservarTurno);

// Reservar turno como Invitado (Paciente NO Registrado)
// Requiere en body: dni, nombre, telefono
router.post("/turnos/reservar-invitado/:turnoId", TurnoController.reservarTurnoInvitado);

// Subir archivo adjunto al turno (imagen o PDF)
router.post("/turnos/:turnoId/archivo", md_upload, TurnoController.subirArchivoTurno);

// Eliminar archivo del turno
router.delete("/turnos/:turnoId/archivo/:archivoId", TurnoController.eliminarArchivoTurno);

// Cancelar turno
router.put("/turnos/cancelar/:turnoId", TurnoController.cancelarTurno);

// Bandeja diaria de pacientes (citas de hoy + informes pendientes)
router.get("/turnos/bandeja-hoy", TurnoController.obtenerBandejaDelDia);

// Bandeja paralela de pacientes que concurrieron a una cita
router.get("/turnos/bandeja-atendidos", TurnoController.obtenerBandejaAtendidos);

// Actualizar el estado de atención de una cita
router.patch("/turnos/:turnoId/estado-atencion", TurnoController.actualizarEstadoAtencion);

// Obtener turnos (con filtros query params)
router.get("/turnos", TurnoController.obtenerTurnos);

// Obtener mis turnos (Paciente)
router.get("/turnos/mis-turnos/:pacienteId", TurnoController.obtenerMisTurnos);

// Borrar turno (Admin/Secretaria)
router.delete("/turnos/:turnoId", TurnoController.borrarTurno);

// Eliminar turnos masivos (Admin/Secretaria)
router.delete("/turnos-masivo", TurnoController.borrarTurnosMasivo);

// Limpiar/Vaciar turnos masivos (Admin/Secretaria)
router.put("/turnos-masivo/limpiar", TurnoController.limpiarTurnosMasivo);

// Actualizar turno (cualquier campo)
router.patch("/turnos/:turnoId", TurnoController.actualizarTurno);

module.exports = router;
