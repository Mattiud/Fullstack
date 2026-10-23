const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/server/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { ROLES } = require('../src/config/roles');
const { hashPassword } = require('../src/utils/password');

// Datos ficticios: nunca se usan datos reales en las pruebas.
const PASSWORD = 'ClavePrueba123';
let contador = 0;

// Base de datos en memoria, independiente de cualquier base real.
function usarBaseDeDatosDePrueba() {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await connectDB(mongo.getUri());
    await User.init();
  });
  afterEach(async () => {
    // Incluye las colecciones de GridFS, que no pertenecen a ningún modelo.
    for (const collection of await mongoose.connection.db.collections()) {
      await collection.deleteMany({});
    }
  });
  afterAll(async () => {
    await disconnectDB();
    await mongo.stop();
  });
}

async function crearUsuario({ password = PASSWORD, ...datos } = {}) {
  contador += 1;
  return User.create({
    nombre: `Usuario Prueba ${contador}`,
    email: `usuario${contador}@prueba.cl`,
    rol: ROLES.PSICOPEDAGOGO,
    passwordHash: await hashPassword(password),
    ...datos,
  });
}

// Devuelve un agente de supertest que conserva la cookie de sesión.
async function iniciarSesion(email, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`No se pudo iniciar sesión en la prueba (${res.status})`);
  }
  return agent;
}

function cookieDeSesion(res) {
  return (res.headers['set-cookie'] || []).find((c) => c.startsWith('sgp_session='));
}

function buscarAuditoria(filtro) {
  return AuditLog.find(filtro).lean();
}

module.exports = {
  app,
  PASSWORD,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  cookieDeSesion,
  buscarAuditoria,
};
