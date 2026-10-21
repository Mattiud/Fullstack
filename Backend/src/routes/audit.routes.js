const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../config/roles');
const { listarAuditoria } = require('../controller/audit.controller');

const router = express.Router();

router.get('/', authenticate(), authorize(PERMISSIONS.AUDITORIA_LEER), listarAuditoria);

module.exports = router;
