const Router = require("express");
const { asureAuth } = require("../middlewares/authenticated");

const { login, getDashboardStats } = require("../controllers/sistema.controller.js");

const router = Router();


router.post("/login", login)

// Dashboard de estadísticas y reportes
router.get("/dashboard/stats", asureAuth, getDashboardStats);

module.exports = router;
