const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EstudioSchema = new Schema({
    tipo: {
        type: String,
        required: true,
        trim: true,
    },
    precio: {
        type: Number,
        min: 0,
    },
    aclaraciones: {
        type: String,
        default: "",
    },
    activo: {
        type: Boolean,
        default: true,
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Estudio", EstudioSchema);
