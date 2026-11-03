const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { listarSesiones } = require('../controller/sesiones.controller');

// Listado general (agenda). El registro, la consulta y la edición cuelgan del menor
// (/api/menores/:menorId/sesiones) para verificar el acceso a su expediente.
const router = express.Router();

router.use(authenticate(), authorize(PERMISSIONS.EXPEDIENTES_LEER));

router.get('/', listarSesiones);

module.exports = router;
