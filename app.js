const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const sistema = require("./Routes/sistema.route");
const paciente = require("./Routes/Paciente.router");
const doctores = require("./Routes/doctor.router");
const secretaria = require("./Routes/Secretaria.router");

const app = express();
const dotenv = require("dotenv");

dotenv.config();

// Settings
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());
app.use(cors());

// Servir archivos estáticos
app.use(express.static(__dirname + "/uploads"));

// Rutas
app.use("/api", paciente);
app.use("/api", doctores);
app.use("/api", secretaria);
app.use("/auth", sistema);

module.exports = app;
