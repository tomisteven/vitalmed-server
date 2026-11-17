const GaleriaItem = require("../models/GaleriaItem");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const BUCKET_NAME = "dicom-medical";
const miRegion = process.env.AWS_REGION;

const s3 = new S3Client({
  region: miRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const keyDesdeUrl = (url) => {
  try {
    if (!url) return null;
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || null;
  } catch (error) {
    return null;
  }
};

const esUrlLocalGaleria = (url) =>
  typeof url === "string" && url.includes("/uploads/galeria/");

const rutaLocalDesdeUrl = (url) => {
  try {
    const parsed = new URL(url);
    const relative = decodeURIComponent(
      parsed.pathname.replace(/^\/+/, "")
    );
    return path.join(__dirname, "..", relative);
  } catch (error) {
    return null;
  }
};

const eliminarArchivo = async (url) => {
  if (!url) return;

  if (esUrlLocalGaleria(url)) {
    const localPath = rutaLocalDesdeUrl(url);
    if (localPath) {
      try {
        await fs.promises.unlink(localPath);
      } catch (error) {
        console.error("No se pudo eliminar el archivo local:", error.message);
      }
    }
    return;
  }

  const key = keyDesdeUrl(url);
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
};

const eliminarArchivos = async (urls) => {
  const lista = urls.filter(Boolean);
  if (lista.length === 0) return;
  await Promise.allSettled(lista.map(eliminarArchivo));
};

const guardarArchivoLocal = async (rutaTemporal, nombreSeguro) => {
  const directorio = path.join(__dirname, "..", "uploads", "galeria");
  await fs.promises.mkdir(directorio, { recursive: true });
  const nombreLocal = `${Date.now()}-${Math.round(
    Math.random() * 1e6
  )}-${nombreSeguro}`;
  const destino = path.join(directorio, nombreLocal);
  await fs.promises.copyFile(rutaTemporal, destino);
  return nombreLocal;
};

const normalizarCategoria = (categoria) =>
  categoria === "instalaciones" ? "instalaciones" : "estudios";

const normalizarFotos = (fotos) => {
  if (!Array.isArray(fotos)) return [];
  return [...new Set(fotos.filter((foto) => typeof foto === "string" && foto.trim()))];
};

exports.obtenerGaleria = async (req, res) => {
  try {
    const { categoria, activo } = req.query;
    const filtro = {};

    if (categoria && ["instalaciones", "estudios"].includes(categoria)) {
      filtro.categoria = categoria;
    }

    if (activo === "todos") {
      // Sin filtro de estado: incluye activos e inactivos
    } else if (activo === "false") {
      filtro.activo = false;
    } else {
      filtro.activo = true;
    }

    const items = await GaleriaItem.find(filtro)
      .populate("estudio", "tipo precio aclaraciones")
      .sort({ orden: 1, created_at: -1 });

    res.status(200).send(items);
  } catch (error) {
    console.error("Error al obtener la galería:", error);
    res.status(500).send({ message: "Error al obtener la galería." });
  }
};

exports.crearItem = async (req, res) => {
  try {
    const {
      categoria,
      titulo,
      resumen,
      indicaciones,
      portada,
      fotos,
      estudio,
      activo,
      orden,
    } = req.body;

    if (!titulo || !String(titulo).trim()) {
      return res.status(400).send({ message: "El título es obligatorio." });
    }

    const item = new GaleriaItem({
      categoria: normalizarCategoria(categoria),
      titulo: String(titulo).trim(),
      resumen: resumen || "",
      indicaciones: indicaciones || "",
      portada: portada || "",
      fotos: normalizarFotos(fotos),
      estudio: estudio || null,
      activo: activo !== undefined ? Boolean(activo) : true,
      orden: Number.isFinite(Number(orden)) ? Number(orden) : 0,
    });

    await item.save();
    await item.populate("estudio", "tipo precio aclaraciones");

    res.status(201).send({
      ok: true,
      message: "Elemento de galería creado correctamente.",
      item,
    });
  } catch (error) {
    console.error("Error al crear elemento de galería:", error);
    res.status(500).send({ message: "Error al crear el elemento de galería." });
  }
};

exports.actualizarItem = async (req, res) => {
  try {
    const { id } = req.params;
    const existente = await GaleriaItem.findById(id);

    if (!existente) {
      return res.status(404).send({ message: "Elemento de galería no encontrado." });
    }

    const {
      categoria,
      titulo,
      resumen,
      indicaciones,
      portada,
      fotos,
      estudio,
      activo,
      orden,
    } = req.body;

    if (titulo !== undefined && !String(titulo).trim()) {
      return res.status(400).send({ message: "El título es obligatorio." });
    }

    const fotosNuevas = fotos !== undefined ? normalizarFotos(fotos) : existente.fotos;
    const portadaNueva = portada !== undefined ? portada : existente.portada;

    const imagenesAnteriores = [existente.portada, ...(existente.fotos || [])].filter(Boolean);
    const imagenesNuevas = [portadaNueva, ...fotosNuevas].filter(Boolean);
    const imagenesEliminadas = imagenesAnteriores.filter(
      (url) => !imagenesNuevas.includes(url)
    );

    if (categoria !== undefined) existente.categoria = normalizarCategoria(categoria);
    if (titulo !== undefined) existente.titulo = String(titulo).trim();
    if (resumen !== undefined) existente.resumen = resumen;
    if (indicaciones !== undefined) existente.indicaciones = indicaciones;
    existente.portada = portadaNueva || "";
    existente.fotos = fotosNuevas;
    if (estudio !== undefined) existente.estudio = estudio || null;
    if (activo !== undefined) existente.activo = Boolean(activo);
    if (orden !== undefined && Number.isFinite(Number(orden))) {
      existente.orden = Number(orden);
    }
    existente.updated_at = Date.now();

    await existente.save();

    if (imagenesEliminadas.length > 0) {
      await eliminarArchivos(imagenesEliminadas);
    }

    await existente.populate("estudio", "tipo precio aclaraciones");

    res.status(200).send({
      ok: true,
      message: "Elemento de galería actualizado correctamente.",
      item: existente,
    });
  } catch (error) {
    console.error("Error al actualizar elemento de galería:", error);
    res.status(500).send({ message: "Error al actualizar el elemento de galería." });
  }
};

exports.eliminarItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await GaleriaItem.findById(id);

    if (!item) {
      return res.status(404).send({ message: "Elemento de galería no encontrado." });
    }

    await eliminarArchivos([item.portada, ...(item.fotos || [])].filter(Boolean));
    await GaleriaItem.findByIdAndDelete(id);

    res.status(200).send({
      ok: true,
      message: "Elemento de galería eliminado correctamente.",
    });
  } catch (error) {
    console.error("Error al eliminar elemento de galería:", error);
    res.status(500).send({ message: "Error al eliminar el elemento de galería." });
  }
};

exports.subirImagenes = async (req, res) => {
  try {
    const archivos = req.files?.imagenes
      ? Array.isArray(req.files.imagenes)
        ? req.files.imagenes
        : [req.files.imagenes]
      : [];

    if (archivos.length === 0) {
      return res.status(400).send({ message: "No se recibieron imágenes." });
    }

    const extensionesPermitidas = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const urls = [];
    const errores = [];
    const avisos = [];

    for (const file of archivos) {
      const extension = path.extname(file.originalFilename || "").toLowerCase();
      const rutaTemporal = file.path;

      try {
        if (!extensionesPermitidas.includes(extension)) {
          throw new Error("Formato no permitido.");
        }

        if (file.size > 12 * 1024 * 1024) {
          throw new Error("La imagen supera los 12 MB.");
        }

        const nombreSeguro = (file.originalFilename || "imagen")
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, "-");
        const key = `galeria/${Date.now()}-${Math.round(
          Math.random() * 1e6
        )}-${nombreSeguro}`;

        const buffer = await fs.promises.readFile(rutaTemporal);
        const mimeType = mime.lookup(extension) || "application/octet-stream";

        let url = "";

        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              Body: buffer,
              ContentType: mimeType,
              ACL: "public-read",
            })
          );
          url = `https://${BUCKET_NAME}.s3.${miRegion}.amazonaws.com/${key}`;
        } catch (s3Error) {
          console.error(
            "S3 no disponible, guardando imagen localmente:",
            s3Error.message
          );
          const nombreLocal = await guardarArchivoLocal(
            rutaTemporal,
            nombreSeguro
          );
          const protocolo =
            req.headers["x-forwarded-proto"] || req.protocol || "http";
          url = `${protocolo}://${req.get("host")}/uploads/galeria/${nombreLocal}`;
          avisos.push(
            "Algunas imágenes se guardaron localmente porque S3 no está disponible."
          );
        }

        urls.push(url);
      } catch (error) {
        console.error("Error al subir imagen de galería:", error.message);
        errores.push(error.message);
      } finally {
        if (rutaTemporal) {
          try {
            await fs.promises.unlink(rutaTemporal);
          } catch (error) {
            console.error("No se pudo eliminar el archivo temporal:", error.message);
          }
        }
      }
    }

    if (urls.length === 0) {
      return res.status(400).send({
        message: "No se pudo subir ninguna imagen.",
        errores,
      });
    }

    res.status(200).send({
      ok: true,
      message: "Imágenes subidas correctamente.",
      urls,
      errores,
      avisos,
    });
  } catch (error) {
    console.error("Error general al subir imágenes:", error);
    res.status(500).send({ message: "Error al subir las imágenes." });
  }
};
