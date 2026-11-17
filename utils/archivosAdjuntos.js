const fs = require("fs");
const path = require("path");
const {
  S3Client,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

let s3Client;

const getS3 = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

const nombreDesdeUrl = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch (error) {
    return "";
  }
};

const esPdf = (archivo) => {
  const url = String(archivo?.urlArchivo || "").toLowerCase();
  const tipo = String(archivo?.tipoArchivo || "").toLowerCase();
  const nombre = String(
    archivo?.nombreArchivo || archivo?.originalFilename || ""
  ).toLowerCase();
  return tipo === "pdf" || url.includes(".pdf") || nombre.endsWith(".pdf");
};

const normalizarNombre = (archivo, contentType) => {
  const candidato =
    archivo.nombreArchivo ||
    archivo.originalFilename ||
    nombreDesdeUrl(archivo.urlArchivo) ||
    "documento";
  const limpio = candidato.replace(/[\\/:*?"<>|]/g, "-").trim() || "documento";
  if (
    contentType === "application/pdf" &&
    !limpio.toLowerCase().endsWith(".pdf")
  ) {
    return `${limpio}.pdf`;
  }
  return limpio;
};

const leerArchivoLocal = async (url) => {
  const parsed = new URL(url);
  const relative = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const ruta = path.join(__dirname, "..", relative);
  const buffer = await fs.promises.readFile(ruta);
  const extension = path.extname(ruta).toLowerCase();
  const contentType =
    extension === ".pdf" ? "application/pdf" : "application/octet-stream";
  return { buffer, contentType };
};

const descargarDesdeS3 = async (url) => {
  const parsed = new URL(url);
  const bucket = process.env.AWS_BUCKET || parsed.hostname.split(".")[0];
  const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (!bucket || !key) {
    throw new Error("URL de S3 inválida.");
  }

  const respuesta = await getS3().send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const bytes = await respuesta.Body.transformToByteArray();

  return {
    buffer: Buffer.from(bytes),
    contentType: respuesta.ContentType || "application/octet-stream",
  };
};

const descargarDesdeHttp = async (url) => {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar el archivo (${respuesta.status}).`);
  }
  const arrayBuffer = await respuesta.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType:
      respuesta.headers.get("content-type") || "application/octet-stream",
  };
};

const descargarArchivo = async (archivo) => {
  const url = archivo?.urlArchivo;
  if (!url) {
    throw new Error("Archivo sin URL.");
  }

  let descarga;

  if (url.startsWith("/uploads/") || url.includes("/uploads/")) {
    descarga = await leerArchivoLocal(url);
  } else if (
    url.includes(".amazonaws.com") ||
    url.includes(".s3.")
  ) {
    descarga = await descargarDesdeS3(url);
  } else if (url.startsWith("http://") || url.startsWith("https://")) {
    descarga = await descargarDesdeHttp(url);
  } else {
    throw new Error("Origen de archivo no soportado.");
  }

  return {
    filename: normalizarNombre(archivo, descarga.contentType),
    content: descarga.buffer,
    contentType: descarga.contentType,
    size: descarga.buffer.length,
  };
};

const prepararAdjuntos = async (archivos, limiteBytes = 20 * 1024 * 1024) => {
  const adjuntos = [];
  const omitidos = [];
  let total = 0;

  for (const archivo of archivos || []) {
    const nombre =
      archivo?.nombreArchivo ||
      archivo?.originalFilename ||
      nombreDesdeUrl(archivo?.urlArchivo || "") ||
      "archivo";

    try {
      const descargado = await descargarArchivo(archivo);

      if (total + descargado.size > limiteBytes) {
        omitidos.push({
          nombre,
          motivo: "Supera el límite total de 20 MB para adjuntos.",
        });
        continue;
      }

      adjuntos.push({
        filename: descargado.filename,
        content: descargado.content,
        contentType: descargado.contentType,
      });
      total += descargado.size;
    } catch (error) {
      omitidos.push({ nombre, motivo: error.message });
    }
  }

  return { adjuntos, omitidos };
};

module.exports = {
  esPdf,
  prepararAdjuntos,
  descargarArchivo,
};
