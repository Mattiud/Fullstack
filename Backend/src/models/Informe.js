const mongoose = require('mongoose');
const { LIMITES_INFORME } = require('../config/informes');

// Informe psicopedagógico de un menor. Solo guarda la referencia al menor: el nombre y
// la fecha de nacimiento se leen de su perfil. Curso y establecimiento se guardan en el
// informe porque cambian con el tiempo (se proponen desde el perfil al crearlo).
//
// Cada PDF generado se guarda cifrado en GridFS (utils/almacenamiento.js) y se agrega
// como una versión nueva: las versiones anteriores no se modifican ni se eliminan.

const texto = (max) => ({ type: String, trim: true, maxlength: max });

const pdfSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    archivoId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Parámetros del cifrado AES-256-GCM, en base64.
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    tamano: { type: Number, required: true },
    generadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fecha: { type: Date, required: true },
  },
  { _id: false }
);

const sugerenciasSchema = new mongoose.Schema(
  {
    familia: texto(LIMITES_INFORME.sugerencia),
    escuela: texto(LIMITES_INFORME.sugerencia),
    nino: texto(LIMITES_INFORME.sugerencia),
  },
  { _id: false }
);

// Tabla de resultados cuantitativos: columnas y filas libres, definidas por el
// profesional. Las celdas son texto: el sistema no calcula totales ni porcentajes.
const tablaSchema = new mongoose.Schema(
  {
    titulo: texto(LIMITES_INFORME.tituloTabla),
    descripcion: texto(LIMITES_INFORME.descripcionTabla),
    columnas: { type: [String], default: [] },
    filas: { type: [[String]], default: [] },
  },
  { _id: false }
);

// Apartado (subárea) del análisis cualitativo de un área.
const apartadoSchema = new mongoose.Schema(
  {
    titulo: texto(LIMITES_INFORME.tituloApartado),
    texto: texto(LIMITES_INFORME.textoApartado),
  },
  { _id: false }
);

const areaSchema = new mongoose.Schema(
  {
    titulo: texto(LIMITES_INFORME.tituloArea),
    apartados: { type: [apartadoSchema], default: [] },
  },
  { _id: false }
);

const informeSchema = new mongoose.Schema(
  {
    menor: { type: mongoose.Schema.Types.ObjectId, ref: 'Menor', required: true, index: true },
    // Fecha del informe: la edad cronológica se calcula respecto de ella.
    fechaInforme: { type: Date, required: true },
    curso: texto(LIMITES_INFORME.curso),
    establecimiento: texto(LIMITES_INFORME.establecimiento),
    antecedentesRelevantes: texto(LIMITES_INFORME.antecedentesRelevantes),
    // Sección «Derivación y motivo de consulta».
    motivoConsulta: texto(LIMITES_INFORME.motivoConsulta),
    instrumentoEvaluativo: texto(LIMITES_INFORME.instrumentoEvaluativo),
    areasEvaluacion: texto(LIMITES_INFORME.areasEvaluacion),
    // Texto general (opcional) que precede a las tablas cuantitativas.
    analisisCuantitativo: texto(LIMITES_INFORME.analisisCuantitativo),
    tablasCuantitativas: { type: [tablaSchema], default: [] },
    objetivoEvaluacion: texto(LIMITES_INFORME.objetivoEvaluacion),
    // Texto general (opcional) que precede a las áreas del análisis cualitativo.
    analisisCualitativo: texto(LIMITES_INFORME.analisisCualitativo),
    areasCualitativas: { type: [areaSchema], default: [] },
    conclusion: texto(LIMITES_INFORME.conclusion),
    sugerencias: { type: sugerenciasSchema, default: () => ({}) },
    // Última modificación del contenido; si es posterior al último PDF, este quedó
    // desactualizado.
    contenidoActualizadoEn: { type: Date, required: true, default: Date.now },
    pdfs: { type: [pdfSchema], default: [] },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    // Si dos guardados se cruzan, el segundo falla en lugar de pisar al primero.
    optimisticConcurrency: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        // Nunca se exponen la ubicación ni los parámetros de cifrado de los archivos.
        if (Array.isArray(ret.pdfs)) {
          ret.pdfs = ret.pdfs.map(({ version, tamano, generadoPor, fecha }) => ({
            version,
            tamano,
            generadoPor,
            fecha,
          }));
        }
        return ret;
      },
    },
  }
);

informeSchema.index({ menor: 1, updatedAt: -1 });

module.exports = mongoose.model('Informe', informeSchema);
