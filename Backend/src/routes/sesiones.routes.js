const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { listarSesiones, calendarioSesiones } = require('../controller/sesiones.controller');

// Listado general (agenda) y calendario. El registro, la consulta y la edición
// cuelgan del menor (/api/menores/:menorId/sesiones) para verificar el acceso a su
// expediente.
const router = express.Router();

router.use(authenticate(), authorize(PERMISSIONS.EXPEDIENTES_LEER));

router.get('/', listarSesiones);
// Calendario semanal y mensual (mockup 1i).
router.get('/calendario', calendarioSesiones);

module.exports = router;
