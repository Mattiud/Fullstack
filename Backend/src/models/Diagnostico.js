const mongoose = require('mongoose');

const ESTADOS_DIAGNOSTICO = Object.freeze({
  BORRADOR: 'borrador',
  VIGENTE: 'vigente',
});

// Campos con el contenido del diagnóstico (mockup 1g). Son los que se versionan.
const CAMPOS_CONTENIDO = Object.freeze([
  'tipo',
  'fechaEvaluacion',
  'instrumento',
  'descripcion',
  'areasAfectadas',
]);

// Además del contenido, cada versión conserva si el tipo lo escribió el profesional
// («Otro») o es una categoría del administrador.
const CAMPOS_VERSIONADOS = Object.freeze([...CAMPOS_CONTENIDO, 'tipoPersonalizado']);

const LIMITES = Object.freeze({
  tipo: 150,
  instrumento: 200,
  descripcion: 5000,
  area: 50,
  areas: 10,
});

const areasAfectadas = {
  type: [{ type: String, trim: true, maxlength: LIMITES.area }],
  validate: {
    validator: (areas) => areas.length <= LIMITES.areas,
    message: `Se admiten como máximo ${LIMITES.areas} áreas`,
  },
};

// Versión anterior de un diagnóstico vigente: no se modifica ni se elimina.
const versionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    tipo: { type: String, required: true, trim: true, maxlength: LIMITES.tipo },
    tipoPersonalizado: { type: Boolean, default: false },
    fechaEvaluacion: { type: Date, required: true },
    instrumento: { type: String, trim: true, maxlength: LIMITES.instrumento },
    descripcion: { type: String, required: true, trim: true, maxlength: LIMITES.descripcion },
    areasAfectadas,
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fecha: { type: Date, required: true },
  },
  { _id: false }
);

function esVigente() {
  return this.estado === ESTADOS_DIAGNOSTICO.VIGENTE;
}

// Diagnóstico psicopedagógico de un menor. Solo guarda la referencia al menor, no sus
// datos. Las versiones anteriores van en el mismo documento para que cada guardado sea
// una única escritura (no quedan versiones a medias si se corta la conexión, T11).
const diagnosticoSchema = new mongoose.Schema(
  {
    menor: { type: mongoose.Schema.Types.ObjectId, ref: 'Menor', required: true, index: true },
    // Se guarda el texto (renombrar una categoría no altera los diagnósticos). Es una
    // categoría activa del administrador o, si tipoPersonalizado, uno ingresado en «Otro».
    tipo: { type: String, required: esVigente, trim: true, maxlength: LIMITES.tipo },
    tipoPersonalizado: { type: Boolean, default: false },
    fechaEvaluacion: { type: Date, required: esVigente },
    instrumento: { type: String, trim: true, maxlength: LIMITES.instrumento },
    descripcion: {
      type: String,
      required: esVigente,
      trim: true,
      maxlength: LIMITES.descripcion,
    },
    areasAfectadas,
    estado: {
      type: String,
      enum: Object.values(ESTADOS_DIAGNOSTICO),
      default: ESTADOS_DIAGNOSTICO.BORRADOR,
    },
    // 0 mientras es borrador; 1, 2… desde que queda vigente.
    version: { type: Number, default: 0 },
    versiones: { type: [versionSchema], default: [] },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Autor de la versión actual (o de la última modificación del borrador).
    actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    // Si dos guardados se cruzan, el segundo falla en lugar de pisar al primero.
    optimisticConcurrency: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

diagnosticoSchema.index({ menor: 1, updatedAt: -1 });

module.exports = mongoose.model('Diagnostico', diagnosticoSchema);
module.exports.ESTADOS_DIAGNOSTICO = ESTADOS_DIAGNOSTICO;
module.exports.CAMPOS_CONTENIDO = CAMPOS_CONTENIDO;
module.exports.CAMPOS_VERSIONADOS = CAMPOS_VERSIONADOS;
module.exports.LIMITES = LIMITES;
