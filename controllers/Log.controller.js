const Log = require("../models/Log");

const getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ fecha: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteLogs = async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ message: "Logs eliminados correctamente", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLogs,
  deleteLogs
};
