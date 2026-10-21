const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  asignarPasswordTemporal,
} = require('../controller/users.controller');

const router = express.Router();

// Toda la gestión de cuentas es exclusiva del administrador.
router.use(authenticate(), authorize(PERMISSIONS.USUARIOS_GESTIONAR));

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.get('/:id', obtenerUsuario);
router.patch('/:id', actualizarUsuario);
router.post('/:id/password-temporal', asignarPasswordTemporal);

module.exports = router;
