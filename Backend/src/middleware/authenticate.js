const User = require('../models/User');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const HttpError = require('../utils/httpError');
const { registrarAuditoria, rutaDe } = require('../utils/audit');
const { readSessionToken, clearSessionCookie } = require('../utils/session');

function motivoRechazo(user, payload) {
  if (!user) return 'usuario_inexistente';
  if (!user.activo) return 'cuenta_deshabilitada';
  if (user.versionSesion !== payload.sv) return 'sesion_revocada';
  return null;
}

// Verifica la cookie de sesión y carga al usuario desde la base de datos en cada
// solicitud, de modo que una cuenta deshabilitada o un cambio de rol se aplica de inmediato.
// auditarSinSesion: false evita registrar la comprobación de sesión al cargar la aplicación.
function authenticate({ auditarSinSesion = true } = {}) {
  return async (req, res, next) => {
    const { payload, error } = readSessionToken(req);

    if (error) {
      // Una sesión vencida es una situación normal y no se registra.
      const auditar =
        error === 'token_invalido' || (error === 'sin_sesion' && auditarSinSesion);
      if (auditar) {
        await registrarAuditoria(req, {
          accion: AUDIT_ACTIONS.ACCESO_NO_AUTENTICADO,
          resultado: 'denegado',
          detalle: { motivo: error, metodo: req.method, ruta: rutaDe(req) },
        });
      }
      if (error !== 'sin_sesion') clearSessionCookie(res);
      throw new HttpError(401, 'Debe iniciar sesión');
    }

    const user = await User.findById(payload.sub);
    const motivo = motivoRechazo(user, payload);
    if (motivo) {
      await registrarAuditoria(req, {
        accion: AUDIT_ACTIONS.ACCESO_NO_AUTENTICADO,
        resultado: 'denegado',
        usuario: user?._id ?? null,
        detalle: { motivo, metodo: req.method, ruta: rutaDe(req) },
      });
      clearSessionCookie(res);
      throw new HttpError(401, 'Debe iniciar sesión');
    }

    req.user = user;
    next();
  };
}

module.exports = authenticate;
