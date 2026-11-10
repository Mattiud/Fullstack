const express = require('express');
const authenticate = require('../middleware/authenticate');
const {
  loginIpLimiter,
  loginCuentaLimiter,
  cambioPasswordLimiter,
} = require('../middleware/rateLimiters');
const { login, logout, me, cambiarPassword } = require('../controller/auth.controller');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { actualizarDatosProfesionales } = require('../controller/datosProfesionales.controller');

const router = express.Router();

router.post('/login', loginIpLimiter, loginCuentaLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate({ auditarSinSesion: false }), me);
router.post('/password', authenticate(), cambioPasswordLimiter, cambiarPassword);
// Datos para el pie de los informes PDF: solo quien emite informes, sobre su propia cuenta.
router.put(
  '/datos-profesionales',
  authenticate(),
  authorize(PERMISSIONS.INFORMES_EMITIR),
  actualizarDatosProfesionales
);

module.exports = router;
