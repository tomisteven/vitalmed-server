const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const sistema = require("./Routes/sistema.route");
const paciente = require("./Routes/Paciente.router");
const doctores = require("./Routes/doctor.router");
const secretaria = require("./Routes/Secretaria.router");
const turnos = require("./Routes/Turno.router");
const estudios = require("./Routes/Estudio.router");
const logs = require("./Routes/Log.router");
const historial = require("./Routes/HistorialTurno.router");

const app = express();
const dotenv = require("dotenv");

dotenv.config();

// Settings
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());
app.use(cors());

// Middleware para registrar logs de errores
const Log = require('./models/Log');
app.use((req, res, next) => {
  const originalJson = res.json;
  
  res.json = function (body) {
    if (res.statusCode >= 400) {
      Log.create({
        metodo: req.method,
        ruta: req.originalUrl,
        body: req.body,
        query: req.query,
        params: req.params,
        status: res.statusCode,
        mensajeError: body ? (body.message || JSON.stringify(body)) : "Error desconocido",
        ip: req.ip
      }).catch(err => console.error("Error al guardar log:", err));
    }
    return originalJson.apply(res, arguments);
  };
  next();
});

// Servir archivos estáticos
app.use(express.static(__dirname + "/uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "Servidor corriendo perfectamente",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Rutas
app.use("/api", paciente);
app.use("/api", doctores);
app.use("/api", secretaria);
app.use("/api", turnos);
app.use("/api", estudios);
app.use("/api", logs);
app.use("/api", historial);
app.use("/auth", sistema);

module.exports = app;
