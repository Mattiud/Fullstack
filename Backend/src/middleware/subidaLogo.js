const multer = require('multer');
const HttpError = require('../utils/httpError');
const { LOGO_MAX_BYTES } = require('../config/informes');

// Recibe una única imagen en el campo "logo", en memoria y con tamaño limitado.
// Debe usarse después de autenticar y autorizar, para no procesar subidas ajenas.
const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 0, parts: 1 },
}).single('logo');

function subidaLogo(req, res, next) {
  recibir(req, res, (err) => {
    if (err?.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = Math.round((LOGO_MAX_BYTES / 1024 / 1024) * 10) / 10;
        return next(new HttpError(413, `El logo supera el tamaño máximo permitido (${maxMb} MB)`));
      }
      return next(new HttpError(400, 'Envíe una única imagen en el campo "logo"'));
    }
    next(err);
  });
}

module.exports = subidaLogo;
