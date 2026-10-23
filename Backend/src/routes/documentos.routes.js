const express = require('express');
const authorize = require('../middleware/authorize');
const subidaDocumento = require('../middleware/subidaDocumento');
const { PERMISSIONS } = require('../config/roles');
const {
  listarDocumentos,
  subirDocumento,
  verDocumento,
  descargarDocumento,
  eliminarDocumento,
} = require('../controller/documentos.controller');

// Montado en /api/menores/:menorId/documentos, después de verificar el acceso al menor.
const router = express.Router({ mergeParams: true });

router.get('/', listarDocumentos);
router.post('/', authorize(PERMISSIONS.EXPEDIENTES_ESCRIBIR), subidaDocumento, subirDocumento);
router.get('/:documentoId/vista', verDocumento);
router.get('/:documentoId/descarga', descargarDocumento);
router.delete('/:documentoId', authorize(PERMISSIONS.EXPEDIENTES_ESCRIBIR), eliminarDocumento);

module.exports = router;
