const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { registrarAuditoria } = require('../utils/audit');
const { normalizeEmail } = require('../utils/validators');

const QUINCE_MINUTOS = 15 * 60 * 1000;
const MENSAJE_BLOQUEO = 'Demasiados intentos. Intente nuevamente en unos minutos.';

function crearLimitador({ limit, keyGenerator, skipSuccessfulRequests = true }) {
  return rateLimit({
    windowMs: QUINCE_MINUTOS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator,
    handler: async (req, res) => {
      await registrarAuditoria(req, {
        accion: AUDIT_ACTIONS.INTENTOS_EXCEDIDOS,
        resultado: 'denegado',
        detalle: { ruta: req.originalUrl.split('?')[0] },
      });
      res.status(429).json({ error: MENSAJE_BLOQUEO });
    },
  });
}

// Intentos fallidos por IP y correo: frena ataques de fuerza bruta contra una cuenta.
const loginCuentaLimiter = crearLimitador({
  limit: 5,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${normalizeEmail(req.body?.email)}`,
});

// Intentos fallidos por IP: frena la prueba de muchas cuentas desde un mismo origen.
const loginIpLimiter = crearLimitador({
  limit: 20,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Cambio de contraseña: impide adivinar la contraseña actual con una sesión robada.
const cambioPasswordLimiter = crearLimitador({
  limit: 5,
  keyGenerator: (req) => String(req.user._id),
});

// Límite general de la API.
const apiLimiter = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: MENSAJE_BLOQUEO },
});

module.exports = {
  loginCuentaLimiter,
  loginIpLimiter,
  cambioPasswordLimiter,
  apiLimiter,
};
