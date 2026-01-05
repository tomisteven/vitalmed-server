const express = require("express");
const router = express.Router();
const TurnoController = require("../controllers/Turno.controller");

// Middleware para manejar archivos (multipart/form-data)
const multipart = require("connect-multiparty");
const md_upload = multipart({ uploadDir: "./uploads" });

// Rutas para gestión de turnos

// Crear disponibilidad (Admin/Secretaria)
router.post("/turnos/disponibilidad", TurnoController.crearDisponibilidad);

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

// Obtener turnos (con filtros query params)
router.get("/turnos", TurnoController.obtenerTurnos);

// Obtener mis turnos (Paciente)
router.get("/turnos/mis-turnos/:pacienteId", TurnoController.obtenerMisTurnos);

// Borrar turno (Admin/Secretaria)
router.delete("/turnos/:turnoId", TurnoController.borrarTurno);

// Actualizar turno (cualquier campo)
router.patch("/turnos/:turnoId", TurnoController.actualizarTurno);

module.exports = router;
