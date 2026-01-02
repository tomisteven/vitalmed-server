const express = require("express");
const router = express.Router();
const TurnoController = require("../controllers/Turno.controller");

// Rutas para gestión de turnos

// Crear disponibilidad (Admin/Secretaria)
router.post("/turnos/disponibilidad", TurnoController.crearDisponibilidad);

// Reservar turno
router.post("/turnos/reservar/:turnoId", TurnoController.reservarTurno);

// Cancelar turno
router.put("/turnos/cancelar/:turnoId", TurnoController.cancelarTurno);

// Obtener turnos (con filtros query params)
router.get("/turnos", TurnoController.obtenerTurnos);

// Obtener mis turnos (Paciente)
router.get("/turnos/mis-turnos/:pacienteId", TurnoController.obtenerMisTurnos);

module.exports = router;
