const express = require("express");
const { asureAuth } = require("../middlewares/authenticated");
const ConfiguracionController = require("../controllers/Configuracion.controller");

const router = express.Router();

router.get(
  "/configuracion/email",
  asureAuth,
  ConfiguracionController.obtenerEmail
);
router.put(
  "/configuracion/email",
  asureAuth,
  ConfiguracionController.guardarEmail
);
router.post(
  "/configuracion/email/probar",
  asureAuth,
  ConfiguracionController.probarEmail
);

module.exports = router;
