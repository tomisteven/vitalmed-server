const dotenv = require("dotenv");
dotenv.config();

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
const galeria = require("./Routes/Galeria.router");
const email = require("./Routes/Email.router");
const configuracion = require("./Routes/Configuracion.router");

const app = express();

// Settings
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());
app.use(cors());

// Middleware para sanitizar respuestas y registrar logs de errores
const Log = require('./models/Log');
const { sanitizar } = require('./utils/sanitizar');

app.use((req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function (body) {
    const respuesta = sanitizar(body);

    if (res.statusCode >= 400) {
      Log.create({
        metodo: req.method,
        ruta: req.originalUrl,
        body: sanitizar(req.body),
        query: sanitizar(req.query),
        params: sanitizar(req.params),
        status: res.statusCode,
        mensajeError: respuesta
          ? respuesta.message || JSON.stringify(respuesta)
          : "Error desconocido",
        ip: req.ip
      }).catch(err => console.error("Error al guardar log:", err));
    }

    return originalJson.call(this, respuesta);
  };

  res.send = function (body) {
    const respuesta =
      body && typeof body === "object" && !Buffer.isBuffer(body)
        ? sanitizar(body)
        : body;

    return originalSend.call(this, respuesta);
  };

  next();
});

// Servir archivos estáticos
app.use(express.static(__dirname + "/uploads"));
app.use("/uploads", express.static(__dirname + "/uploads"));

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
app.use("/api", galeria);
app.use("/api", email);
app.use("/api", configuracion);
app.use("/auth", sistema);

module.exports = app;
