const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  fecha: {
    type: Date,
    default: Date.now,
  },
  metodo: {
    type: String,
    required: true,
  },
  ruta: {
    type: String,
    required: true,
  },
  body: {
    type: Object,
  },
  query: {
    type: Object,
  },
  params: {
    type: Object,
  },
  status: {
    type: Number,
    required: true,
  },
  mensajeError: {
    type: String,
  },
  ip: {
    type: String,
  }
});

module.exports = mongoose.model("Log", logSchema);
