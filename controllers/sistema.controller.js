const Paciente = require("../models/Paciente");
const Secretaria = require("../models/Secretaria");
const Doctor = require("../models/Doctor");

const login = async (req, res) => {
  try {
    const { usuario , password } = req.body;

    const secretaria = await Secretaria.findOne({ usuario });

    if (secretaria && secretaria.password === password) {
      return res.json({
        message: "Secretaria logueada",
        usuario: secretaria,
        ok: true,
        rol: "secretaria",
      });
    } else {
      const doctor = await Doctor.findOne({ usuario });
      if (doctor && doctor.password === password) {
        return res.json({
          message: "Doctor logueado",
          usuario: doctor,
          ok: true,
          rol: "doctor",
        });
      } else {
        const paciente = await Paciente.findOne({
          usuario
        });
        if (paciente && paciente.password === password) {
          return res.json({
            message: "Paciente logueado",
            usuario: paciente,
            ok: true,
            rol: "paciente",
          });
        } else {
          return res.status(400).json({ message: "Usuario no encontrado" });
        }
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  login,
};
