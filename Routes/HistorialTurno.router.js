const express = require("express");
const HistorialTurnoController = require("../controllers/HistorialTurno.controller");
const md_auth = require("../middlewares/authenticated");

const api = express.Router();

api.get("/historial-turnos", [md_auth.asureAuth], HistorialTurnoController.obtenerHistorial);
api.delete("/historial-turnos", [md_auth.asureAuth], HistorialTurnoController.vaciarHistorial);

module.exports = api;
