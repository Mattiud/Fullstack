const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const {
  listarTipos,
  crearTipo,
  actualizarTipo,
  eliminarTipo,
} = require('../controller/tiposDiagnostico.controller');

const router = express.Router();
// Solo el administrador mantiene las categorías.
const gestionar = authorize(PERMISSIONS.DIAGNOSTICOS_TIPOS);

router.use(authenticate(), authorize(PERMISSIONS.EXPEDIENTES_LEER));

router.get('/', listarTipos);
router.post('/', gestionar, crearTipo);
router.patch('/:id', gestionar, actualizarTipo);
router.delete('/:id', gestionar, eliminarTipo);

module.exports = router;
