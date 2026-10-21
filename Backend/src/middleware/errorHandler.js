const config = require('../config/env');
const HttpError = require('../utils/httpError');

function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

// Manejador centralizado: nunca devuelve trazas ni mensajes internos al cliente.
// Express lo reconoce como manejador de errores por recibir cuatro parámetros.
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.detalles) body.detalles = err.detalles;
    if (err.codigo) body.codigo = err.codigo;
    return res.status(err.status).json(body);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Identificador inválido' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: Object.fromEntries(
        Object.keys(err.errors).map((campo) => [campo, 'Valor inválido'])
      ),
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'El registro ya existe' });
  }

  // Los mensajes de error de la base de datos pueden contener valores; solo se
  // registra la traza fuera de producción.
  console.error(`[error] ${err.name}${err.code ? ` (${err.code})` : ''}`);
  if (!config.isProduction && !config.isTest) console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
