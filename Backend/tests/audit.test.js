const request = require('supertest');
const AuditLog = require('../src/models/AuditLog');
const { ROLES } = require('../src/config/roles');
const {
  app,
  PASSWORD,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  cookieDeSesion,
} = require('./helpers');

usarBaseDeDatosDePrueba();

describe('GET /api/audit-logs', () => {
  test('el administrador consulta los registros y puede filtrarlos por acción', async () => {
    const admin = await crearUsuario({ rol: ROLES.ADMIN });
    const agent = await iniciarSesion(admin.email);

    const res = await agent.get('/api/audit-logs?accion=LOGIN_EXITOSO');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.registros[0]).toMatchObject({
      accion: 'LOGIN_EXITOSO',
      usuario: { email: admin.email, rol: ROLES.ADMIN },
    });
    expect(res.body.registros[0].usuario).not.toHaveProperty('passwordHash');
    expect(res.body.registros[0]).toHaveProperty('fecha');
  });

  test('rechaza filtros inválidos', async () => {
    const admin = await crearUsuario({ rol: ROLES.ADMIN });
    const agent = await iniciarSesion(admin.email);

    expect((await agent.get('/api/audit-logs?accion=INVENTADA')).status).toBe(400);
    expect((await agent.get('/api/audit-logs?usuario=abc')).status).toBe(400);
  });

  test('el psicopedagogo no puede consultar la auditoría', async () => {
    const psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
    const agent = await iniciarSesion(psico.email);

    const res = await agent.get('/api/audit-logs');

    expect(res.status).toBe(403);
    expect(await AuditLog.countDocuments({ accion: 'ACCESO_DENEGADO', usuario: psico._id })).toBe(1);
  });

  test('un usuario no autenticado recibe 401', async () => {
    expect((await request(app).get('/api/audit-logs')).status).toBe(401);
  });
});

describe('Contenido del registro de auditoría', () => {
  test('no almacena contraseñas, hashes ni tokens', async () => {
    const admin = await crearUsuario({ rol: ROLES.ADMIN });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: PASSWORD });
    const token = cookieDeSesion(login).split(';')[0].split('=')[1];
    const agent = await iniciarSesion(admin.email);

    await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'ClaveEquivocada77' });
    await agent.post('/api/users').send({
      nombre: 'Cuenta Ficticia',
      email: 'ficticia@prueba.cl',
      password: 'ClaveSecreta2024',
      rol: ROLES.PSICOPEDAGOGO,
    });

    const contenido = JSON.stringify(await AuditLog.find().lean());
    expect(contenido).not.toContain(PASSWORD);
    expect(contenido).not.toContain('ClaveEquivocada77');
    expect(contenido).not.toContain('ClaveSecreta2024');
    expect(contenido).not.toContain(token);
    expect(contenido).not.toMatch(/\$2b\$/);
  });

  test('los registros no pueden modificarse ni eliminarse', async () => {
    const registro = await AuditLog.create({ accion: 'LOGOUT' });

    await expect(AuditLog.updateOne({ _id: registro._id }, { accion: 'LOGIN_EXITOSO' })).rejects.toThrow();
    await expect(AuditLog.deleteMany({})).rejects.toThrow();
    await expect(AuditLog.findOneAndDelete({ _id: registro._id })).rejects.toThrow();
    registro.accion = 'LOGIN_EXITOSO';
    await expect(registro.save()).rejects.toThrow();

    expect(await AuditLog.countDocuments()).toBe(1);
  });
});
