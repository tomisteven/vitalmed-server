const Router = require("express");
const { asureAuth } = require("../middlewares/authenticated");

const {
  getPacientes,
  getPaciente,
  createPaciente,
  deletePaciente,
  updatePaciente,
  getDocumentsGroupedByName,
  getDoctoresAsignados,
  asignarDoctorAPaciente,
  agregarNotasAlPaciente,
  eliminarNotasDelPaciente,
  eliminarDoctorDePaciente,
} = require("../controllers/Paciente.controller.js");

const app = Router();

// Paciente Controller

app.get("/pacientes", asureAuth, getPacientes);
app.get("/paciente/:id", asureAuth, getPaciente);
app.post("/paciente", asureAuth, createPaciente);
app.get("/paciente/:id/doctores", asureAuth, getDoctoresAsignados);
app.patch("/paciente/:id", asureAuth, updatePaciente);
app.post("/paciente/:id/asignar-doctor", asureAuth, asignarDoctorAPaciente);
app.delete("/paciente/:id", asureAuth, deletePaciente);
app.get("/paciente/:id/documentos", asureAuth, getDocumentsGroupedByName);
app.post("/paciente/:id/agregar-nota", asureAuth, agregarNotasAlPaciente);

app.delete("/paciente/:id/eliminar-nota", asureAuth, eliminarNotasDelPaciente);
app.delete(
  "/paciente/:id/eliminar-doctor",
  asureAuth,
  eliminarDoctorDePaciente
);

module.exports = app;
