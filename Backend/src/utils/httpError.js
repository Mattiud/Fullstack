// Error con código HTTP y mensaje seguro para enviar al cliente.
class HttpError extends Error {
  constructor(status, message, { detalles, codigo } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detalles = detalles;
    this.codigo = codigo;
  }
}

module.exports = HttpError;
