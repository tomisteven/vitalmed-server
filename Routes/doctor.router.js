const Router = require("express");
const { asureAuth } = require("../middlewares/authenticated.js");

const {
  getDoctores,
  crearDoctor,
  verDoctor,
  eliminarDoctor,
  updateDoctor,
  getDoctoresList,
} = require("../controllers/doctor.controller.js");

const app = Router();

app.get("/doctores", asureAuth, getDoctores);
app.post("/doctor", asureAuth, crearDoctor);
app.get("/doctor/:id", asureAuth, verDoctor);
app.delete("/doctor/:id", asureAuth, eliminarDoctor);
app.patch("/doctor/:id", asureAuth, updateDoctor);
app.get("/doctores/list", getDoctoresList)

module.exports = app;
