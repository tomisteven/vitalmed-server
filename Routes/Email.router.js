const express = require("express");
const { asureAuth } = require("../middlewares/authenticated");
const EmailController = require("../controllers/Email.controller");

const router = express.Router();

router.get("/email/estado", asureAuth, EmailController.estadoCorreo);
router.post("/email/enviar-informe", asureAuth, EmailController.enviarInforme);

module.exports = router;
