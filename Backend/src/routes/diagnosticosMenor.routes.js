const express = require('express');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const {
  listarDiagnosticosMenor,
  crearDiagnostico,
  obtenerDiagnostico,
  actualizarDiagnostico,
} = require('../controller/diagnosticos.controller');

// Montado en /api/menores/:menorId/diagnosticos, después de verificar el acceso al menor.
const router = express.Router({ mergeParams: true });
const editar = authorize(PERMISSIONS.DIAGNOSTICOS_EDITAR);

router.get('/', listarDiagnosticosMenor);
router.post('/', editar, crearDiagnostico);
router.get('/:diagnosticoId', obtenerDiagnostico);
router.patch('/:diagnosticoId', editar, actualizarDiagnostico);

module.exports = router;
