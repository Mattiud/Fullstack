const mongoose = require('mongoose');

const MAX_NOMBRE = 150;

// Normaliza un nombre para detectar duplicados sin distinguir mayúsculas ni espacios extra.
function normalizarNombre(nombre) {
  return nombre.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Categoría sugerida para el tipo de diagnóstico, mantenida por el administrador.
// No se eliminan: se desactivan para dejar de sugerirlas.
const tipoDiagnosticoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: MAX_NOMBRE },
    nombreNormalizado: { type: String, required: true, unique: true },
    activo: { type: Boolean, default: true },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.nombreNormalizado;
        delete ret.__v;
        return ret;
      },
    },
  }
);

tipoDiagnosticoSchema.pre('validate', function normalizar() {
  if (typeof this.nombre === 'string') this.nombreNormalizado = normalizarNombre(this.nombre);
});

module.exports = mongoose.model('TipoDiagnostico', tipoDiagnosticoSchema);
module.exports.MAX_NOMBRE = MAX_NOMBRE;
module.exports.normalizarNombre = normalizarNombre;
