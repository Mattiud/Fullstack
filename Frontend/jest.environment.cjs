// jsdom no incluye las API Fetch que usa el enrutador de datos de React Router.
// Se toman de Node, junto con AbortController para que Request acepte su señal.
const { TestEnvironment } = require('jest-environment-jsdom');

class EntornoNavegador extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    Object.assign(this.global, {
      Request,
      Response,
      Headers,
      AbortController,
      AbortSignal,
    });
  }
}

module.exports = EntornoNavegador;
