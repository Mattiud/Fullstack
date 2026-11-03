const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { listarDiagnosticos } = require('../controller/diagnosticos.controller');

// Listado general. El registro, la consulta y la edición cuelgan del menor
// (/api/menores/:menorId/diagnosticos) para verificar el acceso a su expediente.
const router = express.Router();

router.use(authenticate(), authorize(PERMISSIONS.EXPEDIENTES_LEER));

router.get('/', listarDiagnosticos);

module.exports = router;
