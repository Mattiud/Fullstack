const express = require('express');
const authenticate = require('../middleware/authenticate');
const {
  loginIpLimiter,
  loginCuentaLimiter,
  cambioPasswordLimiter,
} = require('../middleware/rateLimiters');
const { login, logout, me, cambiarPassword } = require('../controller/auth.controller');

const router = express.Router();

router.post('/login', loginIpLimiter, loginCuentaLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate({ auditarSinSesion: false }), me);
router.post('/password', authenticate(), cambioPasswordLimiter, cambiarPassword);

module.exports = router;
