const HistorialTurno = require("../models/HistorialTurno");

exports.obtenerHistorial = async (req, res) => {
    try {
        const historial = await HistorialTurno.find().sort({ fechaReserva: -1 });
        res.status(200).send(historial);
    } catch (error) {
        console.error("Error al obtener historial de turnos:", error);
        res.status(500).send({ message: "Error al obtener historial de turnos" });
    }
};

exports.vaciarHistorial = async (req, res) => {
    try {
        await HistorialTurno.deleteMany({});
        res.status(200).send({ message: "Historial vaciado correctamente" });
    } catch (error) {
        console.error("Error al vaciar historial:", error);
        res.status(500).send({ message: "Error al vaciar historial" });
    }
};
