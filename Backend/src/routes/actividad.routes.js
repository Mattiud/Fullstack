const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { obtenerActividadReciente } = require('../controller/actividad.controller');

// Actividad reciente del panel de inicio. Cada rol ve solo lo que le corresponde: el
// psicopedagogo, los cambios de sus menores; el administrador, también los cambios
// administrativos (ver el controlador).
const router = express.Router();

router.get('/', authenticate(), authorize(PERMISSIONS.HISTORIAL_LEER), obtenerActividadReciente);

module.exports = router;
