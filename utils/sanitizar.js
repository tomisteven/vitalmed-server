const esDocumentoMongoose = (valor) =>
  Boolean(valor && valor.$__ && typeof valor.toObject === "function");

const sanitizar = (valor, vistos = new WeakSet()) => {
  if (valor === null || typeof valor !== "object") return valor;
  if (valor instanceof Date) return valor;
  if (Buffer.isBuffer(valor)) return valor;
  if (valor._bsontype) return valor;
  if (vistos.has(valor)) return valor;

  vistos.add(valor);

  if (Array.isArray(valor)) {
    return valor.map((item) => sanitizar(item, vistos));
  }

  const base = esDocumentoMongoose(valor) ? valor.toObject() : valor;
  const copia = {};

  for (const [clave, contenido] of Object.entries(base)) {
    if (clave === "password") continue;
    copia[clave] = sanitizar(contenido, vistos);
  }

  return copia;
};

module.exports = { sanitizar };
