const bcrypt = require('bcrypt');
const config = require('../config/env');

function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

// Se calcula al iniciar para que la primera solicitud no tarde más que las siguientes.
const dummyHashPromise = hashPassword('hash-ficticio-sin-uso');

// Si la cuenta no existe se compara contra un hash ficticio para que el tiempo
// de respuesta no revele qué correos están registrados.
async function verifyPassword(plain, hash) {
  if (!hash) {
    await bcrypt.compare(plain, await dummyHashPromise);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
