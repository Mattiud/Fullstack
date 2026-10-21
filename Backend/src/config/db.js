const mongoose = require('mongoose');

// Neutraliza operadores de consulta ($ne, $gt, ...) recibidos dentro de filtros.
mongoose.set('sanitizeFilter', true);

async function connectDB(uri) {
  if (!uri) {
    throw new Error('Falta la variable de entorno MONGODB_URI');
  }
  await mongoose.connect(uri);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
