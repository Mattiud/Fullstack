const mongoose = require('mongoose');
const { edadEn } = require('../utils/validators');

const apoderadoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    parentesco: { type: String, required: true, trim: true, maxlength: 50 },
    telefono: { type: String, required: true, trim: true, maxlength: 20 },
  },
  { _id: false }
);

// Perfil del menor (mockup 1f). Los diagnósticos, sesiones e informes lo referencian.
const menorSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    // Normalizado como 12345678-K; identifica al menor y evita duplicados (T05).
    rut: { type: String, required: true, unique: true, trim: true, maxlength: 10 },
    fechaNacimiento: { type: Date, required: true },
    establecimiento: { type: String, trim: true, maxlength: 150 },
    curso: { type: String, trim: true, maxlength: 50 },
    fechaIngreso: { type: Date, required: true, default: Date.now },
    // Obligatorio para menores de 18 años (se valida en el controlador).
    apoderado: { type: apoderadoSchema },
    antecedentesRelevantes: { type: String, required: true, trim: true, maxlength: 5000 },
    // Profesionales con acceso al expediente (ver middleware/menorAccess.js).
    profesionalesAsignados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // No se eliminan menores: se desactivan y sus datos se conservan.
    activo: { type: Boolean, default: true },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

menorSchema.index({ profesionalesAsignados: 1 });

menorSchema.virtual('edad').get(function edad() {
  return this.fechaNacimiento ? edadEn(this.fechaNacimiento) : null;
});

module.exports = mongoose.model('Menor', menorSchema);
