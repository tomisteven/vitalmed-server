const express = require("express");
const router = express.Router();
const { getLogs, deleteLogs } = require("../controllers/Log.controller");

router.get("/logs", getLogs);
router.delete("/logs", deleteLogs);

module.exports = router;
