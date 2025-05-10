const Doctor = require("../models/Doctor");

// Obtener todos los doctores
const getDoctores = async (req, res) => {
  try {
    const doctores = await Doctor.find();
    res.status(200).json(doctores);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al obtener los doctores",
      error: error.message,
    });
  }
};

const getDoctoresList = async (req, res) => {
  try {
    const doctores = await Doctor.find().select("nombre _id");
    res.status(200).json({ ok: true, doctores });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al obtener los doctores",
      error: error.message,
    });
  }
};

// Crear un nuevo doctor
const crearDoctor = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Todos los campos son obligatorios" });
    }

    const doctorExistente = await Doctor.findOne({ usuario });
    if (doctorExistente) {
      return res
        .status(400)
        .json({ ok: false, message: "Ya existe un doctor con ese USUARIO" });
    }

    const doctor = new Doctor(req.body);
    await doctor.save();
    res.status(201).json({
      ok: true,
      message: "Doctor creado exitosamente",
      doctor: doctor,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al crear el doctor",
      error: error.message,
    });
  }
};

// Obtener un doctor por ID
const verDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor no encontrado" });
    }
    res.status(200).json({ ok: true, doctor });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al obtener el doctor",
      error: error.message,
    });
  }
};

// Actualizar un doctor
const updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doctor) {
      return res
        .status(404)
        .json({ ok: false, message: "Doctor no encontrado" });
    }
    res.status(200).json({
      ok: true,
      message: "Doctor actualizado exitosamente",
      data: doctor,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al actualizar el doctor",
      error: error.message,
    });
  }
};

// Eliminar un doctor
const eliminarDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor no encontrado" });
    }
    res
      .status(200)
      .json({ ok: true, message: "Doctor eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al eliminar el doctor",
      error: error.message,
    });
  }
};

module.exports = {
  getDoctores,
  crearDoctor,
  verDoctor,
  updateDoctor,
  eliminarDoctor,
  getDoctoresList,
};
