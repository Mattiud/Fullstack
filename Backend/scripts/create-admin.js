// Crea la primera cuenta de administrador. Uso: npm run create-admin
// Los datos se solicitan por consola; la contraseña no se muestra ni se guarda en el historial.
const readline = require('node:readline');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const { AUDIT_ACTIONS } = require('../src/models/AuditLog');
const { ROLES } = require('../src/config/roles');
const { hashPassword } = require('../src/utils/password');
const { registrarAuditoria } = require('../src/utils/audit');
const {
  normalizeEmail,
  validarEmail,
  validarNombre,
  validarPassword,
} = require('../src/utils/validators');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});

// Mientras se escribe una contraseña no se muestra lo que se teclea.
let ocultarEntrada = false;
const escribirSalida = rl._writeToOutput.bind(rl);
rl._writeToOutput = (salida) => {
  if (!ocultarEntrada) escribirSalida(salida);
};

// Cola de líneas: conserva lo escrito aunque llegue antes de la pregunta.
const lineas = [];
const esperando = [];
rl.on('line', (linea) => {
  const resolver = esperando.shift();
  if (resolver) resolver(linea);
  else lineas.push(linea);
});
rl.on('close', () => {
  while (esperando.length > 0) esperando.shift()(null);
});

async function preguntar(texto, { oculto = false } = {}) {
  process.stdout.write(texto);
  ocultarEntrada = oculto;
  const respuesta = lineas.length > 0
    ? lineas.shift()
    : await new Promise((resolve) => esperando.push(resolve));
  ocultarEntrada = false;
  if (oculto) process.stdout.write('\n');
  if (respuesta === null) {
    throw new Error('Se interrumpió la entrada de datos');
  }
  return respuesta;
}

async function preguntarValido(texto, validar, opciones) {
  for (;;) {
    const valor = await preguntar(texto, opciones);
    const error = validar(valor);
    if (!error) return valor;
    console.log(`  ${error}`);
  }
}

async function main() {
  await connectDB(config.mongodbUri);

  if (await User.exists({ rol: ROLES.ADMIN })) {
    console.log('Ya existe un administrador. Cree las demás cuentas desde la aplicación.');
    process.exitCode = 1;
    return;
  }

  const nombre = await preguntarValido('Nombre: ', validarNombre);
  const email = normalizeEmail(await preguntarValido('Correo: ', validarEmail));
  if (await User.exists({ email })) {
    console.log('Ya existe un usuario con ese correo.');
    process.exitCode = 1;
    return;
  }

  let password;
  for (;;) {
    password = await preguntarValido('Contraseña: ', validarPassword, { oculto: true });
    const confirmacion = await preguntar('Repita la contraseña: ', { oculto: true });
    if (password === confirmacion) break;
    console.log('  Las contraseñas no coinciden.');
  }

  const admin = await User.create({
    nombre: nombre.trim(),
    email,
    passwordHash: await hashPassword(password),
    rol: ROLES.ADMIN,
  });
  await registrarAuditoria(null, {
    accion: AUDIT_ACTIONS.USUARIO_CREADO,
    usuario: null,
    recurso: 'usuario',
    recursoId: admin._id,
    detalle: { rol: admin.rol, origen: 'script_inicializacion' },
  });

  console.log(`Administrador creado: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(`No se pudo crear el administrador: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    return disconnectDB();
  });
