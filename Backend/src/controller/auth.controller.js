const User = require('../models/User');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const { hashPassword, verifyPassword } = require('../utils/password');
const {
  setSessionCookie,
  clearSessionCookie,
  readSessionToken,
  serializeUser,
} = require('../utils/session');
const {
  PASSWORD_MAX_BYTES,
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  normalizeEmail,
  validarPassword,
} = require('../utils/validators');

// Mismo mensaje para cualquier fallo: no revela si la cuenta existe ni qué dato es incorrecto.
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

function motivoFallo(user, passwordValida) {
  if (!user) return 'usuario_inexistente';
  if (!passwordValida) return 'password_incorrecta';
  return 'cuenta_deshabilitada';
}

async function login(req, res) {
  const { email: emailRecibido, password } = cuerpoDe(req);
  const email = normalizeEmail(emailRecibido);
  if (!email || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Debe ingresar correo y contraseña');
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  // Una contraseña más larga que el límite de bcrypt nunca es válida.
  const passwordValida =
    Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES &&
    (await verifyPassword(password, user?.passwordHash));

  if (!user || !passwordValida || !user.activo) {
    await registrarAuditoria(req, {
      accion: AUDIT_ACTIONS.LOGIN_FALLIDO,
      resultado: 'fallo',
      usuario: user?._id ?? null,
      detalle: { email: email.slice(0, 254), motivo: motivoFallo(user, passwordValida) },
    });
    throw new HttpError(401, CREDENCIALES_INVALIDAS);
  }

  user.ultimoAcceso = new Date();
  await user.save();

  setSessionCookie(res, user);
  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.LOGIN_EXITOSO,
    usuario: user._id,
  });
  res.json({ usuario: serializeUser(user) });
}

// No exige una sesión válida: siempre elimina la cookie.
async function logout(req, res) {
  const { payload } = readSessionToken(req);
  if (payload) {
    // Revoca el token en el servidor para que no pueda reutilizarse aunque se haya copiado.
    const user = await User.findOneAndUpdate(
      { _id: payload.sub, versionSesion: payload.sv },
      { $inc: { versionSesion: 1 } }
    );
    if (user) {
      await registrarAuditoria(req, { accion: AUDIT_ACTIONS.LOGOUT, usuario: user._id });
    }
  }
  clearSessionCookie(res);
  res.status(204).end();
}

function me(req, res) {
  res.json({ usuario: serializeUser(req.user) });
}

async function cambiarPassword(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, ['passwordActual', 'passwordNueva']);
  const { passwordActual, passwordNueva } = body;

  const actualValida = typeof passwordActual === 'string' && passwordActual.length > 0;
  exigirSinErrores({
    passwordActual: actualValida ? null : 'La contraseña actual es obligatoria',
    passwordNueva:
      validarPassword(passwordNueva) ||
      (passwordNueva === passwordActual
        ? 'La nueva contraseña debe ser distinta de la actual'
        : null),
  });

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await verifyPassword(passwordActual, user.passwordHash))) {
    await registrarAuditoria(req, {
      accion: AUDIT_ACTIONS.CAMBIO_PASSWORD,
      resultado: 'fallo',
      recurso: 'usuario',
      recursoId: user._id,
    });
    throw new HttpError(400, 'Datos inválidos', {
      detalles: { passwordActual: 'La contraseña actual es incorrecta' },
    });
  }

  user.passwordHash = await hashPassword(passwordNueva);
  user.debeCambiarPassword = false;
  // Cierra las demás sesiones y emite una nueva para la actual.
  user.versionSesion += 1;
  await user.save();

  setSessionCookie(res, user);
  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.CAMBIO_PASSWORD,
    recurso: 'usuario',
    recursoId: user._id,
  });
  res.json({ usuario: serializeUser(user) });
}

module.exports = { login, logout, me, cambiarPassword };
