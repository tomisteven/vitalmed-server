const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DoctorSchema = new Schema({
  nombre: { type: String, required: true },
  especialidad: String,
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
  rol: { type: String, default: "Doctor" },
  pacientes: [
    {
      type: Schema.Types.ObjectId,
      ref: "Paciente",
    },
  ],
});

module.exports = mongoose.model("Doctor", DoctorSchema);
