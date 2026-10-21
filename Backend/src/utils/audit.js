const AuditLog = require('../models/AuditLog');

function rutaDe(req) {
  return req.originalUrl.split('?')[0];
}

// Registra un evento de auditoría. Un fallo al registrar no interrumpe la operación,
// pero se informa en consola sin incluir datos de la solicitud.
async function registrarAuditoria(
  req,
  { accion, resultado = 'exito', usuario, recurso, recursoId, detalle }
) {
  try {
    await AuditLog.create({
      accion,
      resultado,
      usuario: usuario !== undefined ? usuario : req?.user?._id ?? null,
      recurso,
      recursoId: recursoId ? String(recursoId) : undefined,
      ip: req?.ip,
      detalle,
    });
  } catch (err) {
    console.error(`[auditoria] No se pudo registrar ${accion}: ${err.name}`);
  }
}

module.exports = { registrarAuditoria, rutaDe };
