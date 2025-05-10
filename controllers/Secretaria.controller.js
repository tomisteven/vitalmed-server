const Secretaria = require("../models/Secretaria");
const Paciente = require("../models/Paciente");
const path = require("path");
const mime = require("mime-types");

const {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");

const getSecretarias = async (req, res) => {
  try {
    const secretarias = await Secretaria.find();
    res.json(secretarias);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const crearSecretaria = async (req, res) => {
  try {
    const { email } = req.body;
    const secretariaExistente = await Secretaria.findOne({ email });
    if (secretariaExistente) {
      return res
        .status(400)
        .json({ message: "Ya existe una secretaria con ese email" });
    }
    const secretaria = new Secretaria(req.body);
    await secretaria.save();
    res.json({ message: "Secretaria creada", secretaria });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verSecretaria = async (req, res) => {
  try {
    const secretaria = await Secretaria.findById(req.params.id);
    res.json(secretaria);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const eliminarSecretaria = async (req, res) => {
  try {
    await Secretaria.findByIdAndDelete(req.params.id);
    res.json({ message: "Secretaria eliminada", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

const miRegion = process.env.AWS_REGION;
let s3 = new S3Client({
  region: miRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const eliminarDocumentoDePaciente = async (req, res) => {
  try {
    const { id, idDoc } = req.params;

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    const documento = paciente.documentos.find(
      (doc) => doc._id.toString() === idDoc
    );
    if (!documento) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }
    console.log("Documento a eliminar:", documento);
    console.log("ID del documento:", idDoc);
    console.log("ID del paciente:", id);

    // Eliminar de S3
    const params = {
      Bucket: "dicom-medical",
      Key: documento.originalFilename, // O mejor aún: usa Key real si lo guardás
    };
    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    // Eliminar del array de documentos
    paciente.documentos = paciente.documentos.filter(
      (doc) => doc._id.toString() !== idDoc
    );

    await paciente.save();

    res.json({ message: "Documento eliminado", ok: true });
  } catch (error) {
    console.error("Error al eliminar documento:", error);
    res.status(500).json({ message: "Error al eliminar documento", ok: false });
  }
};

const subirDocumentoAPaciente2 = async (req, res) => {
  try {
    const imagemin = (await import("imagemin")).default;
    const imageminMozjpeg = (await import("imagemin-mozjpeg")).default;
    const imageminPngquant = (await import("imagemin-pngquant")).default;
    const imageminWebp = (await import("imagemin-webp")).default;

    const { id } = req.params;
    const { nombreArchivo } = req.body;
    const paciente = await Paciente.findById(id);

    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    if (!req.files || !req.files.dicoms) {
      return res
        .status(400)
        .json({ message: "No se han subido archivos válidos" });
    }

    const archivos = Array.isArray(req.files.dicoms)
      ? req.files.dicoms
      : [req.files.dicoms];
    const archivosSubidos = [];

    const bucket = "dicom-medical";

    for (const file of archivos) {
      const extension = path.extname(file.originalFilename).toLowerCase();
      const originalFilename = file.originalFilename
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "-");

      const uniqueFilename = `${Date.now()}-${originalFilename}`;
      const urlArchivo = `https://${bucket}.s3.${miRegion}.amazonaws.com/${uniqueFilename}`;

      let fileBuffer = await fs.promises.readFile(file.path);
      let bufferOptimizado = fileBuffer;

      if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
        bufferOptimizado = await imagemin.buffer(fileBuffer, {
          plugins: [
            imageminMozjpeg({ quality: 75 }),
            imageminPngquant({ quality: [0.6, 0.8] }),
            imageminWebp({ quality: 75 }),
          ],
        });
      }

      const mimeType = mime.lookup(extension) || "application/octet-stream";

      const params = {
        Bucket: bucket,
        Key: uniqueFilename,
        Body: bufferOptimizado,
        ContentType: mimeType,
        ACL: "public-read",
      };

      try {
        const subida = await s3.send(new PutObjectCommand(params));

        paciente.documentos.push({
          urlArchivo,
          idArchivo: subida.$metadata.requestId,
          nombreArchivo,
          originalFilename,
        });

        archivosSubidos.push({ urlArchivo, originalFilename });

        await fs.promises.unlink(file.path);
        console.log(`✔ Archivo subido y eliminado: ${originalFilename}`);
      } catch (error) {
        console.error(
          `❌ Error al subir archivo ${originalFilename}:`,
          error.message
        );
      }
    }

    await paciente.save();

    res.json({
      message: "Archivos subidos con éxito",
      archivosSubidos,
      ok: true,
    });
  } catch (error) {
    console.error("❌ Error general:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

const subirDocumentoAPaciente = async (req, res) => {
  try {
    const imagemin = (await import("imagemin")).default;
    const imageminMozjpeg = (await import("imagemin-mozjpeg")).default;
    const imageminPngquant = (await import("imagemin-pngquant")).default;
    const imageminWebp = (await import("imagemin-webp")).default;
    const { id } = req.params;
    const { nombreArchivo } = req.body;
    const paciente = await Paciente.findById(id);

    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    if (!req.files || !req.files.dicoms) {
      return res
        .status(400)
        .json({ message: "No se han subido archivos válidos" });
    }

    const bucket = "dicom-medical";
    const archivosSubidos = [];

    // Convertir a array si es un solo archivo
    const archivos = Array.isArray(req.files.dicoms)
      ? req.files.dicoms
      : [req.files.dicoms];

    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      const originalFilename = file.originalFilename
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "-");

      const urlArchivo = `https://${bucket}.s3.${miRegion}.amazonaws.com/${originalFilename}`;

      console.log("Archivo No comprimido", file.size);

      // Leer archivo y optimizarlo
      const fileBuffer = await fs.promises.readFile(file.path);
      const bufferOptimizado = await imagemin.buffer(fileBuffer, {
        plugins: [
          imageminMozjpeg({ quality: 75 }), // Comprime JPEG
          imageminPngquant({ quality: [0.6, 0.8] }), // Comprime PNG
          imageminWebp({ quality: 75 }), // Comprime WebP
        ],
      });

      console.log("Archivo comprimido", bufferOptimizado.length);

      const params = {
        Bucket: bucket,
        Key: originalFilename,
        Body: bufferOptimizado,
        ContentType: file.type || "application/octet-stream",
        ACL: "public-read",
      };

      try {
        const subida = await s3.send(new PutObjectCommand(params));

        paciente.documentos.push({
          urlArchivo,
          idArchivo: subida.$metadata.requestId,
          nombreArchivo,
          originalFilename,
        });

        archivosSubidos.push({ urlArchivo, originalFilename });

        await fs.promises.unlink(file.path);
        console.log(`Archivo eliminado: ${file.path}`);
      } catch (error) {
        console.error("Error al subir a S3:", error);
      }
    }

    await paciente.save();

    res.json({
      message: "Documentos optimizados y subidos con éxito",
      archivosSubidos,
      ok: true,
    });
  } catch (error) {
    console.error("Error en la solicitud:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
  }
};

const obtenerUrlDescarga = async (req, res) => {
  try {
    const { nombreArchivo } = req.params; // El nombre del archivo en el bucket
    const bucket = "dicom-medical";

    const params = {
      Bucket: bucket,
      Key: nombreArchivo,
    };

    // Generar la URL firmada
    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ url });
  } catch (error) {
    console.error("Error al generar URL de descarga:", error);
    res.status(500).json({ message: "Error al obtener URL de descarga" });
  }
};

const updateSecretaria = async (req, res) => {
  try {
    await Secretaria.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Secretaria actualizada", ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message, ok: false });
  }
};

module.exports = {
  getSecretarias,
  crearSecretaria,
  verSecretaria,
  eliminarSecretaria,
  subirDocumentoAPaciente,
  obtenerUrlDescarga,
  updateSecretaria,
  eliminarDocumentoDePaciente,
  subirDocumentoAPaciente2,
};
