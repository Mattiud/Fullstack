const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');
const { LIMITES_DATOS_PROFESIONALES: LIMITES } = require('../config/informes');

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    rol: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    // La contraseña fue asignada por un administrador y debe cambiarse al iniciar sesión.
    debeCambiarPassword: {
      type: Boolean,
      default: false,
    },
    // Se incrementa para invalidar las sesiones emitidas anteriormente.
    versionSesion: {
      type: Number,
      default: 0,
    },
    ultimoAcceso: Date,
    // Datos que el psicopedagogo define para el pie de página de sus informes PDF.
    datosProfesionales: {
      type: new mongoose.Schema(
        {
          tituloProfesional: { type: String, trim: true, maxlength: LIMITES.tituloProfesional },
          registro: { type: String, trim: true, maxlength: LIMITES.registro },
          correo: { type: String, trim: true, lowercase: true, maxlength: LIMITES.correo },
          telefono: { type: String, trim: true, maxlength: LIMITES.telefono },
        },
        { _id: false }
      ),
      default: undefined,
    },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.versionSesion;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
