const Estudio = require("../models/Estudio");

// Crear un nuevo estudio
exports.crearEstudio = async (req, res) => {
    try {
        const { tipo, precio, aclaraciones } = req.body;

        if (!tipo || precio === undefined) {
            return res.status(400).send({ message: "El tipo y precio son obligatorios." });
        }

        const nuevoEstudio = new Estudio({
            tipo,
            precio,
            aclaraciones: aclaraciones || "",
        });

        await nuevoEstudio.save();

        res.status(201).send({
            message: "Estudio creado exitosamente.",
            estudio: nuevoEstudio,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al crear el estudio." });
    }
};

// Obtener todos los estudios
exports.obtenerEstudios = async (req, res) => {
    try {
        const { activo } = req.query;
        const filter = {};

        // Por defecto solo mostrar estudios activos
        if (activo === "false") {
            filter.activo = false;
        } else if (activo === "todos") {
            // No aplicar filtro, mostrar todos
        } else {
            filter.activo = true;
        }

        const estudios = await Estudio.find(filter).sort({ tipo: 1 });

        res.status(200).send(estudios);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al obtener los estudios." });
    }
};

// Obtener un estudio por ID
exports.obtenerEstudioPorId = async (req, res) => {
    try {
        const { estudioId } = req.params;

        const estudio = await Estudio.findById(estudioId);

        if (!estudio) {
            return res.status(404).send({ message: "Estudio no encontrado." });
        }

        res.status(200).send(estudio);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al obtener el estudio." });
    }
};

// Editar un estudio
exports.editarEstudio = async (req, res) => {
    try {
        const { estudioId } = req.params;
        const { tipo, precio, aclaraciones, activo } = req.body;

        const estudio = await Estudio.findById(estudioId);

        if (!estudio) {
            return res.status(404).send({ message: "Estudio no encontrado." });
        }

        // Actualizar campos si fueron enviados
        if (tipo !== undefined) estudio.tipo = tipo;
        if (precio !== undefined) estudio.precio = precio;
        if (aclaraciones !== undefined) estudio.aclaraciones = aclaraciones;
        if (activo !== undefined) estudio.activo = activo;
        estudio.updated_at = Date.now();

        await estudio.save();

        res.status(200).send({
            message: "Estudio actualizado exitosamente.",
            estudio,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al actualizar el estudio." });
    }
};

// Eliminar un estudio (soft delete - desactivar)
exports.eliminarEstudio = async (req, res) => {
    try {
        const { estudioId } = req.params;

        const estudio = await Estudio.findById(estudioId);

        if (!estudio) {
            return res.status(404).send({ message: "Estudio no encontrado." });
        }

        estudio.activo = false;
        estudio.updated_at = Date.now();

        await estudio.save();

        res.status(200).send({
            message: "Estudio eliminado exitosamente.",
            estudio,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al eliminar el estudio." });
    }
};

// Eliminar un estudio permanentemente (hard delete)
exports.eliminarEstudioPermanente = async (req, res) => {
    try {
        const { estudioId } = req.params;

        const estudio = await Estudio.findByIdAndDelete(estudioId);

        if (!estudio) {
            return res.status(404).send({ message: "Estudio no encontrado." });
        }

        res.status(200).send({
            message: "Estudio eliminado permanentemente.",
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error al eliminar el estudio permanentemente." });
    }
};
