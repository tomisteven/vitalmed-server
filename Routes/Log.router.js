const express = require("express");
const router = express.Router();
const { getLogs, deleteLogs } = require("../controllers/Log.controller");
const md_auth = require("../middlewares/authenticated");

router.get("/logs", [md_auth.asureAuth], getLogs);
router.delete("/logs", [md_auth.asureAuth], deleteLogs);

module.exports = router;

