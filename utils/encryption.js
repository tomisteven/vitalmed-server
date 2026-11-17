const crypto = require("crypto");

const secreto =
  process.env.CONFIG_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  process.env.token ||
  "doctoraecos-config";

const key = crypto.createHash("sha256").update(secreto).digest();

const encrypt = (texto) => {
  if (!texto) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encriptado = Buffer.concat([
    cipher.update(String(texto), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encriptado.toString(
    "base64"
  )}`;
};

const decrypt = (payload) => {
  if (!payload) return "";
  try {
    const [ivB64, tagB64, contenidoB64] = String(payload).split(":");
    if (!ivB64 || !tagB64 || !contenidoB64) return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(contenidoB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    console.error("No se pudo descifrar la contraseña de correo:", error.message);
    return "";
  }
};

module.exports = { encrypt, decrypt };
