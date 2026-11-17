const express = require("express");
const multipart = require("connect-multiparty");
const { asureAuth } = require("../middlewares/authenticated");
const GaleriaController = require("../controllers/Galeria.controller");

const router = express.Router();
const md_upload = multipart({ uploadDir: "./uploads" });

// Público: listado de la galería
router.get("/galeria", GaleriaController.obtenerGaleria);

// Administración
router.post(
  "/galeria/subir",
  asureAuth,
  md_upload,
  GaleriaController.subirImagenes
);
router.post("/galeria", asureAuth, GaleriaController.crearItem);
router.patch("/galeria/:id", asureAuth, GaleriaController.actualizarItem);
router.delete("/galeria/:id", asureAuth, GaleriaController.eliminarItem);

module.exports = router;
