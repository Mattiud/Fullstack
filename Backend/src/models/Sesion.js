const mongoose = require('mongoose');
const { HORA_RE } = require('../utils/validators');

const ESTADOS_SESION = Object.freeze({
  BORRADOR: 'borrador',
  PLANIFICADA: 'planificada',
});

// Resultado de la sesión, del bloque "Registro post-sesión" del mockup 1h.
const ASISTENCIAS = Object.freeze({
  ASISTIO: 'asistio',
  INASISTENCIA: 'inasistencia',
  REAGENDADA: 'reagendada',
});

const LIMITES = Object.freeze({
  objetivo: 300,
  objetivos: 10,
  actividad: 300,
  actividades: 15,
  observaciones: 5000,
});

function esPlanificada() {
  return this.estado === ESTADOS_SESION.PLANIFICADA;
}

function maximo(limite, etiqueta) {
  return {
    validator: (lista) => lista.length <= limite,
    message: `Se admiten como máximo ${limite} ${etiqueta}`,
  };
}

const objetivoSchema = new mongoose.Schema(
  {
    descripcion: { type: String, required: true, trim: true, maxlength: LIMITES.objetivo },
    // Sin valor hasta que se registra el resultado de la sesión.
    logrado: { type: Boolean },
  },
  { _id: false }
);

// Planificación de una sesión psicopedagógica (mockup 1h, T08). Solo guarda la
// referencia al menor, no sus datos.
const sesionSchema = new mongoose.Schema(
  {
    menor: { type: mongoose.Schema.Types.ObjectId, ref: 'Menor', required: true, index: true },
    // Profesional responsable: quien registró la sesión.
    profesional: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Diagnóstico vigente del mismo menor en que se basa la sesión (opcional), con la
    // versión que tenía al asociarlo.
    diagnostico: { type: mongoose.Schema.Types.ObjectId, ref: 'Diagnostico' },
    diagnosticoVersion: { type: Number },
    estado: {
      type: String,
      enum: Object.values(ESTADOS_SESION),
      default: ESTADOS_SESION.BORRADOR,
    },
    // Medianoche UTC, igual que las demás fechas sin hora del sistema.
    fecha: { type: Date, required: esPlanificada },
    horaInicio: { type: String, required: esPlanificada, match: HORA_RE },
    horaFin: { type: String, required: esPlanificada, match: HORA_RE },
    objetivos: {
      type: [objetivoSchema],
      default: [],
      validate: maximo(LIMITES.objetivos, 'objetivos'),
    },
    // En el orden en que se realizarán.
    actividades: {
      type: [{ type: String, trim: true, maxlength: LIMITES.actividad }],
      default: [],
      validate: maximo(LIMITES.actividades, 'actividades'),
    },
    asistencia: { type: String, enum: Object.values(ASISTENCIAS) },
    observaciones: { type: String, trim: true, maxlength: LIMITES.observaciones },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

sesionSchema.index({ menor: 1, fecha: 1, horaInicio: 1 });
sesionSchema.index({ profesional: 1, fecha: 1 });

// Sin el tercer argumento, Mongoose nombraría la colección "sesions".
module.exports = mongoose.model('Sesion', sesionSchema, 'sesiones');
module.exports.ESTADOS_SESION = ESTADOS_SESION;
module.exports.ASISTENCIAS = ASISTENCIAS;
module.exports.LIMITES = LIMITES;
