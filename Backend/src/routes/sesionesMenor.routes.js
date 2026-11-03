const express = require('express');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const {
  listarSesionesMenor,
  contextoSesion,
  crearSesion,
  obtenerSesion,
  actualizarSesion,
} = require('../controller/sesiones.controller');

// Montado en /api/menores/:menorId/sesiones, después de verificar el acceso al menor.
const router = express.Router({ mergeParams: true });
const editar = authorize(PERMISSIONS.SESIONES_EDITAR);

router.get('/', listarSesionesMenor);
// Antes de /:sesionId para que "contexto" no se interprete como un identificador.
router.get('/contexto', contextoSesion);
router.post('/', editar, crearSesion);
router.get('/:sesionId', obtenerSesion);
router.patch('/:sesionId', editar, actualizarSesion);

module.exports = router;
