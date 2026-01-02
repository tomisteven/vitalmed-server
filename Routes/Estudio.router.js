const express = require("express");
const router = express.Router();
const EstudioController = require("../controllers/Estudio.controller");

// Rutas para gestión de estudios

// Crear un nuevo estudio
router.post("/estudios", EstudioController.crearEstudio);

// Obtener todos los estudios (query param: ?activo=true|false|todos)
router.get("/estudios", EstudioController.obtenerEstudios);

// Obtener un estudio por ID
router.get("/estudios/:estudioId", EstudioController.obtenerEstudioPorId);

// Editar un estudio
router.put("/estudios/:estudioId", EstudioController.editarEstudio);

// Eliminar un estudio (soft delete - desactivar)
router.delete("/estudios/:estudioId", EstudioController.eliminarEstudio);

// Eliminar un estudio permanentemente (hard delete)
router.delete("/estudios/:estudioId/permanente", EstudioController.eliminarEstudioPermanente);

module.exports = router;
