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
  MENOR_CREADO: 'MENOR_CREADO',
  MENOR_CONSULTADO: 'MENOR_CONSULTADO',
  MENOR_ACTUALIZADO: 'MENOR_ACTUALIZADO',
  MENOR_ESTADO: 'MENOR_ESTADO',
  PROFESIONALES_ASIGNADOS: 'PROFESIONALES_ASIGNADOS',
  DOCUMENTO_SUBIDO: 'DOCUMENTO_SUBIDO',
  DOCUMENTO_CONSULTADO: 'DOCUMENTO_CONSULTADO',
  DOCUMENTO_DESCARGADO: 'DOCUMENTO_DESCARGADO',
  DOCUMENTO_ELIMINADO: 'DOCUMENTO_ELIMINADO',
});

// Acciones que forman el historial de cambios de un expediente.
const ACCIONES_HISTORIAL = Object.freeze([
  AUDIT_ACTIONS.MENOR_CREADO,
  AUDIT_ACTIONS.MENOR_ACTUALIZADO,
  AUDIT_ACTIONS.MENOR_ESTADO,
  AUDIT_ACTIONS.PROFESIONALES_ASIGNADOS,
  AUDIT_ACTIONS.DOCUMENTO_SUBIDO,
  AUDIT_ACTIONS.DOCUMENTO_ELIMINADO,
]);

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
  recursoId: { type: String, index: true },
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
module.exports.ACCIONES_HISTORIAL = ACCIONES_HISTORIAL;
