// Inserta un usuario de prueba por cada rol. Uso: npm run seed
// Credenciales fijas, solo para desarrollo: el seed no se ejecuta en producción.
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const { ROLES } = require('../src/config/roles');
const { hashPassword } = require('../src/utils/password');

const USUARIOS_PRUEBA = [
  {
    nombre: 'Admin Prueba',
    email: 'admin.prueba@sgp.test',
    rol: ROLES.ADMIN,
    password: 'AdminPrueba1',
  },
  {
    nombre: 'Psicopedagogo Prueba',
    email: 'psicopedagogo.prueba@sgp.test',
    rol: ROLES.PSICOPEDAGOGO,
    password: 'PsicoPrueba1',
  },
];

// Devuelve los usuarios insertados; omite los que ya existen.
async function sembrarUsuarios({ entorno = config.env } = {}) {
  if (entorno === 'production') {
    throw new Error('El seed no puede ejecutarse en producción');
  }

  const creados = [];
  for (const { password, ...datos } of USUARIOS_PRUEBA) {
    if (await User.exists({ email: datos.email })) continue;
    await User.create({ ...datos, passwordHash: await hashPassword(password) });
    creados.push({ ...datos, password });
  }
  return creados;
}

async function main() {
  await connectDB(config.mongodbUri);
  const creados = await sembrarUsuarios();
  if (creados.length === 0) {
    console.log('Los usuarios de prueba ya existen; no se insertó nada.');
    return;
  }
  for (const { rol, email, password } of creados) {
    console.log(`${rol.padEnd(14)} ${email.padEnd(32)} ${password}`);
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(`No se pudo ejecutar el seed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => disconnectDB());
}

module.exports = { sembrarUsuarios, USUARIOS_PRUEBA };
