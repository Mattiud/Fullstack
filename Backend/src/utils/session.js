const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/env');
const { permisosDeRol } = require('../config/roles');

const SESSION_COOKIE = 'sgp_session';

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  path: '/api',
};

// Emite (o renueva) la cookie de sesión. El token vence tras el período máximo de
// inactividad; cada renovación lo extiende desde ese momento. Devuelve el vencimiento.
function setSessionCookie(res, user) {
  const token = jwt.sign({ sv: user.versionSesion }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user._id),
    expiresIn: Math.floor(config.inactividadMaximaMs / 1000),
  });
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: config.inactividadMaximaMs,
  });
  const vence = new Date(jwt.decode(token).exp * 1000);
  res.set(ENCABEZADO_VENCIMIENTO, vence.toISOString());
  return vence;
}

// Encabezados del control de inactividad: el de la respuesta informa el vencimiento
// vigente; el de la solicitud marca las comprobaciones automáticas del cliente, que no
// cuentan como actividad.
const ENCABEZADO_VENCIMIENTO = 'X-Sesion-Vence';
const ENCABEZADO_AUTOMATICA = 'x-solicitud-automatica';

function esSolicitudAutomatica(req) {
  return req.get(ENCABEZADO_AUTOMATICA) === '1';
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

// Devuelve { payload } si el token es válido o { error } con el motivo del rechazo.
function readSessionToken(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return { error: 'sin_sesion' };
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    });
    if (!mongoose.isValidObjectId(payload.sub)) {
      return { error: 'token_invalido' };
    }
    return { payload };
  } catch (err) {
    return {
      error: err.name === 'TokenExpiredError' ? 'sesion_expirada' : 'token_invalido',
    };
  }
}

function serializeUser(user) {
  return { ...user.toJSON(), permisos: permisosDeRol(user.rol) };
}

module.exports = {
  SESSION_COOKIE,
  ENCABEZADO_VENCIMIENTO,
  setSessionCookie,
  esSolicitudAutomatica,
  clearSessionCookie,
  readSessionToken,
  serializeUser,
};
