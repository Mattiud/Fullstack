require('dotenv').config({ quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

const jwtSecret = requireEnv('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
}

// En producción el origen del frontend debe declararse explícitamente.
const clientOrigin = isProduction
  ? requireEnv('CLIENT_ORIGIN')
  : process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

module.exports = {
  env: NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  port: Number(process.env.PORT) || 4000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret,
  sessionDurationMs: SESSION_DURATION_MS,
  clientOrigin,
  // Número de proxies delante del servidor (Render), necesario para obtener la IP real.
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  // Costo reducido solo en pruebas para no ralentizarlas.
  bcryptRounds: NODE_ENV === 'test' ? 4 : 12,
};
