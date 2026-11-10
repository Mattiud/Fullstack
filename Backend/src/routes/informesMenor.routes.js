const express = require('express');
const {
  listarInformesMenor,
  crearInforme,
  obtenerInforme,
  actualizarInforme,
  vistaPrevia,
  generarPdf,
  obtenerPdf,
} = require('../controller/informes.controller');

// Montado en /api/menores/:menorId/informes, después de exigir el permiso de informes
// y verificar el acceso al menor.
const router = express.Router({ mergeParams: true });

router.get('/', listarInformesMenor);
router.post('/', crearInforme);
// Antes de /:informeId para que "vista-previa" no se interprete como un identificador.
router.post('/vista-previa', vistaPrevia);
router.get('/:informeId', obtenerInforme);
router.patch('/:informeId', actualizarInforme);
router.post('/:informeId/vista-previa', vistaPrevia);
router.post('/:informeId/pdf', generarPdf);
router.get('/:informeId/pdfs/:version', obtenerPdf);

module.exports = router;
