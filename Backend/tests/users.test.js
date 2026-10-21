const request = require('supertest');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');
const { ROLES } = require('../src/config/roles');
const {
  app,
  PASSWORD,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

const nuevoUsuario = {
  nombre: 'Profesional Ficticio',
  email: 'Profesional.Ficticio@Prueba.cl',
  password: 'ClaveInicial2024',
  rol: ROLES.PSICOPEDAGOGO,
};

let admin;
let psico;
let adminAgent;
let psicoAgent;

beforeEach(async () => {
  admin = await crearUsuario({ rol: ROLES.ADMIN });
  psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
});

describe('Acceso sin autenticación', () => {
  test.each([
    ['get', '/api/users'],
    ['post', '/api/users'],
    ['get', '/api/users/000000000000000000000000'],
    ['patch', '/api/users/000000000000000000000000'],
  ])('%s %s responde 401 y se registra', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).send(nuevoUsuario);
    expect(res.status).toBe(401);
    const [registro] = await buscarAuditoria({ accion: 'ACCESO_NO_AUTENTICADO' });
    expect(registro.detalle.motivo).toBe('sin_sesion');
  });
});

describe('POST /api/users', () => {
  test('el administrador crea un usuario con contraseña cifrada y temporal', async () => {
    const res = await adminAgent.post('/api/users').send(nuevoUsuario);

    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({
      nombre: nuevoUsuario.nombre,
      email: 'profesional.ficticio@prueba.cl',
      rol: ROLES.PSICOPEDAGOGO,
      activo: true,
      debeCambiarPassword: true,
    });
    expect(res.body.usuario).not.toHaveProperty('passwordHash');

    const guardado = await User.findById(res.body.usuario._id).select('+passwordHash');
    expect(guardado.passwordHash).not.toBe(nuevoUsuario.password);
    expect(await bcrypt.compare(nuevoUsuario.password, guardado.passwordHash)).toBe(true);
    expect(guardado.creadoPor.equals(admin._id)).toBe(true);

    const [registro] = await buscarAuditoria({ accion: 'USUARIO_CREADO' });
    expect(registro.usuario.equals(admin._id)).toBe(true);
    expect(registro.recursoId).toBe(res.body.usuario._id);
    expect(JSON.stringify(registro)).not.toContain(nuevoUsuario.password);

    // El nuevo usuario puede iniciar sesión con sus credenciales.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: nuevoUsuario.email, password: nuevoUsuario.password });
    expect(login.status).toBe(200);
  });

  test('el psicopedagogo no puede crear usuarios y el intento se registra', async () => {
    const res = await psicoAgent.post('/api/users').send(nuevoUsuario);

    expect(res.status).toBe(403);
    expect(await User.exists({ email: 'profesional.ficticio@prueba.cl' })).toBeNull();
    const [registro] = await buscarAuditoria({ accion: 'ACCESO_DENEGADO' });
    expect(registro.usuario.equals(psico._id)).toBe(true);
    expect(registro.detalle.ruta).toBe('/api/users');
  });

  test.each([
    ['passwordHash', { passwordHash: 'x' }],
    ['activo', { activo: false }],
    ['debeCambiarPassword', { debeCambiarPassword: false }],
    ['versionSesion', { versionSesion: 5 }],
  ])('rechaza el campo no permitido %s', async (_campo, extra) => {
    const res = await adminAgent.post('/api/users').send({ ...nuevoUsuario, ...extra });
    expect(res.status).toBe(400);
  });

  test('rechaza un rol inexistente', async () => {
    const res = await adminAgent
      .post('/api/users')
      .send({ ...nuevoUsuario, rol: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('rol');
  });

  test('valida los campos obligatorios y sus formatos', async () => {
    const vacio = await adminAgent.post('/api/users').send({});
    expect(vacio.status).toBe(400);
    expect(Object.keys(vacio.body.detalles).sort()).toEqual(['email', 'nombre', 'password', 'rol']);

    const formato = await adminAgent
      .post('/api/users')
      .send({ ...nuevoUsuario, email: 'no-es-correo', password: 'solotexto' });
    expect(formato.status).toBe(400);
    expect(formato.body.detalles).toHaveProperty('email');
    expect(formato.body.detalles).toHaveProperty('password');
  });

  test('rechaza un correo ya registrado sin importar mayúsculas', async () => {
    const res = await adminAgent
      .post('/api/users')
      .send({ ...nuevoUsuario, email: psico.email.toUpperCase() });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/users', () => {
  test('el administrador lista las cuentas sin datos de contraseña', async () => {
    const res = await adminAgent.get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body.usuarios).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|versionSesion|\$2b\$/);
  });

  test('el administrador consulta una cuenta por id', async () => {
    const res = await adminAgent.get(`/api/users/${psico._id}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe(psico.email);

    const invalido = await adminAgent.get('/api/users/no-es-un-id');
    expect(invalido.status).toBe(404);
  });

  test('el psicopedagogo no puede listar cuentas', async () => {
    const res = await psicoAgent.get('/api/users');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id', () => {
  test('el psicopedagogo no puede elevar su propio rol', async () => {
    const res = await psicoAgent.patch(`/api/users/${psico._id}`).send({ rol: ROLES.ADMIN });

    expect(res.status).toBe(403);
    expect((await User.findById(psico._id)).rol).toBe(ROLES.PSICOPEDAGOGO);
  });

  test('el administrador cambia el rol, se registra y se cierran las sesiones del usuario', async () => {
    const res = await adminAgent.patch(`/api/users/${psico._id}`).send({ rol: ROLES.ADMIN });

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe(ROLES.ADMIN);
    const [registro] = await buscarAuditoria({ accion: 'USUARIO_ACTUALIZADO' });
    expect(registro.detalle).toEqual({ campos: ['rol'], rol: ROLES.ADMIN });
    expect((await psicoAgent.get('/api/auth/me')).status).toBe(401);
  });

  test('deshabilitar una cuenta cierra su sesión e impide un nuevo inicio de sesión', async () => {
    const res = await adminAgent.patch(`/api/users/${psico._id}`).send({ activo: false });
    expect(res.status).toBe(200);
    expect(res.body.usuario.activo).toBe(false);

    expect((await psicoAgent.get('/api/auth/me')).status).toBe(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: psico.email, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error).toBe('Credenciales inválidas');
  });

  test('el administrador no puede quitarse su rol ni deshabilitarse', async () => {
    const rol = await adminAgent
      .patch(`/api/users/${admin._id}`)
      .send({ rol: ROLES.PSICOPEDAGOGO });
    const estado = await adminAgent.patch(`/api/users/${admin._id}`).send({ activo: false });

    expect(rol.status).toBe(400);
    expect(estado.status).toBe(400);
    expect((await User.findById(admin._id)).rol).toBe(ROLES.ADMIN);
  });

  test('rechaza campos no permitidos y valores inválidos', async () => {
    const email = await adminAgent.patch(`/api/users/${psico._id}`).send({ email: 'otro@prueba.cl' });
    const activo = await adminAgent.patch(`/api/users/${psico._id}`).send({ activo: 'no' });
    const vacio = await adminAgent.patch(`/api/users/${psico._id}`).send({});

    expect(email.status).toBe(400);
    expect(activo.status).toBe(400);
    expect(vacio.status).toBe(400);
  });
});

describe('POST /api/users/:id/password-temporal', () => {
  test('el administrador asigna una contraseña temporal y se revoca la anterior', async () => {
    const res = await adminAgent
      .post(`/api/users/${psico._id}/password-temporal`)
      .send({ password: 'Temporal2024x' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.debeCambiarPassword).toBe(true);
    expect(await buscarAuditoria({ accion: 'PASSWORD_TEMPORAL_ASIGNADA' })).toHaveLength(1);

    expect((await psicoAgent.get('/api/auth/me')).status).toBe(401);
    const anterior = await request(app)
      .post('/api/auth/login')
      .send({ email: psico.email, password: PASSWORD });
    expect(anterior.status).toBe(401);

    const nueva = await request(app)
      .post('/api/auth/login')
      .send({ email: psico.email, password: 'Temporal2024x' });
    expect(nueva.status).toBe(200);
    expect(nueva.body.usuario.debeCambiarPassword).toBe(true);
  });

  test('el psicopedagogo no puede asignar contraseñas', async () => {
    const res = await psicoAgent
      .post(`/api/users/${admin._id}/password-temporal`)
      .send({ password: 'Temporal2024x' });
    expect(res.status).toBe(403);
  });

  test('valida la política de contraseñas', async () => {
    const res = await adminAgent
      .post(`/api/users/${psico._id}/password-temporal`)
      .send({ password: '123' });
    expect(res.status).toBe(400);
  });
});
