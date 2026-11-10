const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { listarInformes } = require('../controller/informes.controller');

// Listado general de informes. El registro, la consulta, la edición y los PDF cuelgan
// del menor (/api/menores/:menorId/informes) para verificar el acceso a su expediente.
// Solo el psicopedagogo tiene el permiso de informes: el administrador no accede.
const router = express.Router();

router.use(authenticate(), authorize(PERMISSIONS.INFORMES_EMITIR));

router.get('/', listarInformes);

module.exports = router;
