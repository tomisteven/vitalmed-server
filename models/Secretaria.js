const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SecretariaSchema = new Schema({
  nombre: { type: String, required: true },
  usuario: String,
  email: String,
  password: {
    type: String,
    required: true,
  },
  telefono: String,
  email: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  rol: { type: String, default: "Secretaria" },
});

module.exports = mongoose.model("Secretaria", SecretariaSchema);
