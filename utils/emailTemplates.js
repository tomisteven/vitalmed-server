const CLINICA = "DoctoraEcos";
const TELEFONO = "+58 424-466-4961";
const DIRECCION =
  "Centro Policlínico Valencia (Clínica La Viña), Torre C, Piso 1, Consultorio 102.";

const PLANTILLAS_DEFAULT = {
  confirmacionAsunto: "Confirmación de turno - DoctoraEcos",
  confirmacionMensaje: `Hola {{paciente}},

Tu turno fue reservado exitosamente.

Fecha y hora: {{fecha}}
Especialidad: {{especialidad}}

Si necesitás cancelar o modificar tu turno, comunicate con el consultorio.`,
  informeAsunto: "Tu informe médico está disponible - DoctoraEcos",
  informeMensaje: `Hola {{paciente}},

Tu informe médico ya está disponible. Adjuntamos los archivos correspondientes.

Estudio: {{estudio}}
Profesional: {{doctor}}
Fecha del turno: {{fecha}}

{{adjuntos}}

Gracias por confiar en DoctoraEcos.`,
};

const VARIABLES = [
  "{{paciente}}",
  "{{fecha}}",
  "{{especialidad}}",
  "{{estudio}}",
  "{{doctor}}",
  "{{motivo}}",
  "{{adjuntos}}",
  "{{clinica}}",
  "{{telefono}}",
  "{{direccion}}",
];

const ESCAPES_HTML = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escaparHtml = (valor) =>
  String(valor ?? "").replace(/[&<>"']/g, (caracter) => ESCAPES_HTML[caracter]);

const mezclarPlantillas = (plantillas = {}) => ({
  confirmacionAsunto:
    String(plantillas?.confirmacionAsunto || "").trim() ||
    PLANTILLAS_DEFAULT.confirmacionAsunto,
  confirmacionMensaje:
    String(plantillas?.confirmacionMensaje || "").trim() ||
    PLANTILLAS_DEFAULT.confirmacionMensaje,
  informeAsunto:
    String(plantillas?.informeAsunto || "").trim() ||
    PLANTILLAS_DEFAULT.informeAsunto,
  informeMensaje:
    String(plantillas?.informeMensaje || "").trim() ||
    PLANTILLAS_DEFAULT.informeMensaje,
});

const renderPlantilla = (plantilla, variables = {}) => {
  const texto = String(plantilla || "").replace(
    /\{\{\s*([a-zA-Z]+)\s*\}\}/g,
    (coincidencia, clave) => {
      if (clave === "adjuntos") return variables.adjuntos || "";
      return escaparHtml(variables[clave] || "");
    }
  );

  return texto.replace(/\n/g, "<br/>");
};

const renderAsunto = (plantilla, variables = {}) =>
  String(plantilla || "")
    .replace(
      /\{\{\s*([a-zA-Z]+)\s*\}\}/g,
      (coincidencia, clave) =>
        clave === "adjuntos"
          ? ""
          : String(variables[clave] || "").replace(/[\r\n]+/g, " ")
    )
    .replace(/[\r\n]+/g, " ")
    .trim();

module.exports = {
  CLINICA,
  TELEFONO,
  DIRECCION,
  PLANTILLAS_DEFAULT,
  VARIABLES,
  escaparHtml,
  mezclarPlantillas,
  renderPlantilla,
  renderAsunto,
};
