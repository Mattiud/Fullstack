const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const subidaLogo = require('../middleware/subidaLogo');
const { PERMISSIONS } = require('../config/roles');
const {
  obtenerConfiguracion,
  actualizarConfiguracion,
  subirLogo,
  eliminarLogo,
  verLogo,
  vistaPrevia,
} = require('../controller/configuracionInformes.controller');

// Presentación institucional de los informes PDF. Solo el administrador la consulta
// y modifica; la subida se procesa después de verificar el permiso.
const router = express.Router();

router.use(authenticate(), authorize(PERMISSIONS.INFORMES_CONFIGURAR));

router.get('/', obtenerConfiguracion);
router.put('/', actualizarConfiguracion);
router.get('/logo', verLogo);
router.put('/logo', subidaLogo, subirLogo);
router.delete('/logo', eliminarLogo);
router.post('/vista-previa', vistaPrevia);

module.exports = router;
