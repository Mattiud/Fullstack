const multer = require('multer');
const config = require('../config/env');

// Recibe un único archivo en el campo "archivo", en memoria y con tamaño limitado.
// Debe usarse después de autenticar y autorizar, para no procesar subidas ajenas.
const subidaDocumento = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.documentosMaxBytes, files: 1, fields: 0, parts: 1 },
}).single('archivo');

module.exports = subidaDocumento;
