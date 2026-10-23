const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { authorizeMenorAccess } = require('../middleware/menorAccess');
const { PERMISSIONS } = require('../config/roles');
const Menor = require('../models/Menor');
const documentosRoutes = require('./documentos.routes');
const {
  listarMenores,
  crearMenor,
  obtenerMenor,
  actualizarMenor,
  cambiarEstado,
  asignarProfesionales,
  obtenerHistorial,
} = require('../controller/menores.controller');

const router = express.Router();
// El psicopedagogo solo accede a los menores que tiene asignados; el administrador, a todos.
const accesoMenor = authorizeMenorAccess(Menor);
const escribir = authorize(PERMISSIONS.EXPEDIENTES_ESCRIBIR);

router.use(authenticate(), authorize(PERMISSIONS.EXPEDIENTES_LEER));

router.get('/', listarMenores);
router.post('/', escribir, crearMenor);
router.get('/:menorId', accesoMenor, obtenerMenor);
router.patch('/:menorId', escribir, accesoMenor, actualizarMenor);
router.patch('/:menorId/estado', escribir, accesoMenor, cambiarEstado);
router.put(
  '/:menorId/profesionales',
  authorize(PERMISSIONS.EXPEDIENTES_ASIGNAR),
  accesoMenor,
  asignarProfesionales
);
router.get(
  '/:menorId/historial',
  authorize(PERMISSIONS.HISTORIAL_LEER),
  accesoMenor,
  obtenerHistorial
);
router.use('/:menorId/documentos', accesoMenor, documentosRoutes);

module.exports = router;
