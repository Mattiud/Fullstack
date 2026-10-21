const mongoose = require('mongoose');

const AUDIT_ACTIONS = Object.freeze({
  LOGIN_EXITOSO: 'LOGIN_EXITOSO',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  INTENTOS_EXCEDIDOS: 'INTENTOS_EXCEDIDOS',
  LOGOUT: 'LOGOUT',
  CAMBIO_PASSWORD: 'CAMBIO_PASSWORD',
  ACCESO_NO_AUTENTICADO: 'ACCESO_NO_AUTENTICADO',
  ACCESO_DENEGADO: 'ACCESO_DENEGADO',
  ORIGEN_RECHAZADO: 'ORIGEN_RECHAZADO',
  USUARIO_CREADO: 'USUARIO_CREADO',
  USUARIO_ACTUALIZADO: 'USUARIO_ACTUALIZADO',
  PASSWORD_TEMPORAL_ASIGNADA: 'PASSWORD_TEMPORAL_ASIGNADA',
});

// Nunca se almacenan contraseñas, tokens ni contenido de expedientes.
const auditLogSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now, index: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  accion: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
  resultado: {
    type: String,
    enum: ['exito', 'fallo', 'denegado'],
    default: 'exito',
  },
  recurso: String,
  recursoId: String,
  ip: String,
  detalle: mongoose.Schema.Types.Mixed,
});

// El registro de auditoría es de solo inserción.
auditLogSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
    'findOneAndReplace',
  ],
  async function () {
    throw new Error('El registro de auditoría no puede modificarse');
  }
);

auditLogSchema.pre('save', async function () {
  if (!this.isNew) {
    throw new Error('El registro de auditoría no puede modificarse');
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
