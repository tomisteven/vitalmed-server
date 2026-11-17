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

const obtenerKeyDesdeDocumento = (documento) => {
  try {
    if (documento.urlArchivo) {
      const url = new URL(documento.urlArchivo);
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (key) return key;
    }
  } catch (error) {
    console.error("No se pudo obtener la Key desde urlArchivo:", error.message);
  }
  return documento.originalFilename;
};

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
      Key: obtenerKeyDesdeDocumento(documento),
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

const renombrarCarpetaDePaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const nombreActual = (req.body.nombreActual || "").trim();
    const nombreNuevo = (req.body.nombreNuevo || "").trim();

    if (!nombreActual || !nombreNuevo) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el nombre actual y el nuevo nombre de la carpeta",
      });
    }

    if (nombreActual === nombreNuevo) {
      return res.status(400).json({
        ok: false,
        message: "El nuevo nombre debe ser diferente al actual",
      });
    }

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({ ok: false, message: "Paciente no encontrado" });
    }

    const archivosCarpeta = paciente.documentos.filter(
      (doc) => doc.nombreArchivo === nombreActual
    );

    if (archivosCarpeta.length === 0) {
      return res.status(404).json({ ok: false, message: "Carpeta no encontrada" });
    }

    const existeNombreNuevo = paciente.documentos.some(
      (doc) => doc.nombreArchivo === nombreNuevo
    );

    if (existeNombreNuevo) {
      return res.status(400).json({
        ok: false,
        message: "Ya existe una carpeta con ese nombre",
      });
    }

    // Solo cambia el nombre de la carpeta. No se tocan urlArchivo,
    // originalFilename ni idArchivo, por lo que los enlaces se mantienen.
    paciente.documentos.forEach((doc) => {
      if (doc.nombreArchivo === nombreActual) {
        doc.nombreArchivo = nombreNuevo;
      }
    });

    paciente.updated_at = Date.now();
    await paciente.save();

    res.json({
      ok: true,
      message: "Carpeta renombrada correctamente",
      nombreActual,
      nombreNuevo,
      archivos: archivosCarpeta.length,
    });
  } catch (error) {
    console.error("Error al renombrar carpeta:", error);
    res.status(500).json({ ok: false, message: "Error al renombrar la carpeta" });
  }
};

const eliminarCarpetaDePaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const nombreCarpeta = (req.body.nombreCarpeta || "").trim();

    if (!nombreCarpeta) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el nombre de la carpeta a eliminar",
      });
    }

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({ ok: false, message: "Paciente no encontrado" });
    }

    const archivosCarpeta = paciente.documentos.filter(
      (doc) => doc.nombreArchivo === nombreCarpeta
    );

    if (archivosCarpeta.length === 0) {
      return res.status(404).json({ ok: false, message: "Carpeta no encontrada" });
    }

    // Eliminar todos los archivos de la carpeta en S3
    const resultados = await Promise.allSettled(
      archivosCarpeta.map(async (doc) => {
        const key = obtenerKeyDesdeDocumento(doc);
        if (!key) {
          throw new Error("No se pudo determinar la Key del archivo");
        }
        await s3.send(
          new DeleteObjectCommand({ Bucket: "dicom-medical", Key: key })
        );
      })
    );

    const erroresS3 = resultados.filter(
      (resultado) => resultado.status === "rejected"
    ).length;

    resultados.forEach((resultado, index) => {
      if (resultado.status === "rejected") {
        console.error(
          `Error al eliminar archivo ${archivosCarpeta[index].originalFilename} de S3:`,
          resultado.reason?.message || resultado.reason
        );
      }
    });

    paciente.documentos = paciente.documentos.filter(
      (doc) => doc.nombreArchivo !== nombreCarpeta
    );
    paciente.updated_at = Date.now();
    await paciente.save();

    res.json({
      ok: true,
      message: "Carpeta eliminada correctamente",
      archivosEliminados: archivosCarpeta.length,
      erroresS3,
    });
  } catch (error) {
    console.error("Error al eliminar carpeta:", error);
    res.status(500).json({ ok: false, message: "Error al eliminar la carpeta" });
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
    const datos = { ...req.body };

    if (!String(datos.password || "").trim()) {
      delete datos.password;
    }

    await Secretaria.findByIdAndUpdate(req.params.id, datos);
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
  renombrarCarpetaDePaciente,
  eliminarCarpetaDePaciente,
};
