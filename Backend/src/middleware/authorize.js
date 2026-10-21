const { hasPermission } = require('../config/roles');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const HttpError = require('../utils/httpError');
const { registrarAuditoria, rutaDe } = require('../utils/audit');

// Exige que el usuario autenticado tenga todos los permisos indicados.
// Debe usarse después de authenticate().
function authorize(...permisos) {
  return async (req, res, next) => {
    if (req.user.debeCambiarPassword) {
      throw new HttpError(403, 'Debe cambiar su contraseña temporal antes de continuar', {
        codigo: 'CAMBIO_PASSWORD_REQUERIDO',
      });
    }

    const autorizado = permisos.every((permiso) => hasPermission(req.user.rol, permiso));
    if (!autorizado) {
      await registrarAuditoria(req, {
        accion: AUDIT_ACTIONS.ACCESO_DENEGADO,
        resultado: 'denegado',
        detalle: { metodo: req.method, ruta: rutaDe(req), permisos },
      });
      throw new HttpError(403, 'No tiene permisos para realizar esta acción');
    }

    next();
  };
}

module.exports = authorize;
