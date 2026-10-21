const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const { ROLES } = require('../src/config/roles');
const {
  app,
  PASSWORD,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  cookieDeSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

describe('POST /api/auth/login', () => {
  test('inicia sesión con credenciales válidas y emite una cookie HttpOnly', async () => {
    const user = await crearUsuario();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ email: user.email, rol: ROLES.PSICOPEDAGOGO });
    expect(res.body.usuario.permisos).toEqual(
      expect.arrayContaining(['expedientes:leer'])
    );
    expect(res.body.usuario).not.toHaveProperty('passwordHash');
    expect(res.body.usuario).not.toHaveProperty('versionSesion');

    const cookie = cookieDeSesion(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api/);
    // El token solo viaja en la cookie, nunca en el cuerpo.
    const token = cookie.split(';')[0].split('=')[1];
    expect(JSON.stringify(res.body)).not.toContain(token);

    expect(await buscarAuditoria({ accion: 'LOGIN_EXITOSO', usuario: user._id })).toHaveLength(1);
  });

  test('normaliza el correo antes de buscar la cuenta', async () => {
    const user = await crearUsuario();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `  ${user.email.toUpperCase()} `, password: PASSWORD });
    expect(res.status).toBe(200);
  });

  test('rechaza una contraseña incorrecta con un mensaje genérico y lo registra', async () => {
    const user = await crearUsuario();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'OtraClave999' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
    expect(cookieDeSesion(res)).toBeUndefined();

    const [registro] = await buscarAuditoria({ accion: 'LOGIN_FALLIDO' });
    expect(registro.detalle.motivo).toBe('password_incorrecta');
    expect(JSON.stringify(registro)).not.toContain('OtraClave999');
  });

  test('responde igual cuando la cuenta no existe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inexistente@prueba.cl', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
  });

  test('rechaza una cuenta deshabilitada aunque la contraseña sea correcta', async () => {
    const user = await crearUsuario({ activo: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
    const [registro] = await buscarAuditoria({ accion: 'LOGIN_FALLIDO' });
    expect(registro.detalle.motivo).toBe('cuenta_deshabilitada');
  });

  test('valida los datos obligatorios y rechaza operadores de consulta', async () => {
    await crearUsuario();

    const vacio = await request(app).post('/api/auth/login').send({});
    expect(vacio.status).toBe(400);

    const inyeccion = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(inyeccion.status).toBe(400);
  });

  test('rechaza una contraseña más larga que el límite de bcrypt aunque comparta el prefijo', async () => {
    const password72 = `${'a'.repeat(70)}12`;
    const user = await crearUsuario({ password: password72 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: `${password72}extra` });

    expect(res.status).toBe(401);
  });
});

describe('Sesión', () => {
  test('GET /api/auth/me sin cookie responde 401 sin registrar la comprobación inicial', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(await buscarAuditoria({ accion: 'ACCESO_NO_AUTENTICADO' })).toHaveLength(0);
  });

  test('la sesión persiste entre solicitudes (recarga de la aplicación)', async () => {
    const user = await crearUsuario();
    const agent = await iniciarSesion(user.email);

    const primera = await agent.get('/api/auth/me');
    const segunda = await agent.get('/api/auth/me');

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(segunda.body.usuario.email).toBe(user.email);
    expect(segunda.body.usuario).not.toHaveProperty('passwordHash');
  });

  test('rechaza un token manipulado y lo registra', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'sgp_session=token.manipulado.invalido');

    expect(res.status).toBe(401);
    const [registro] = await buscarAuditoria({ accion: 'ACCESO_NO_AUTENTICADO' });
    expect(registro.detalle.motivo).toBe('token_invalido');
  });

  test('rechaza un token firmado con otro secreto', async () => {
    const user = await crearUsuario();
    const token = jwt.sign({ sv: 0 }, 'otro-secreto-cualquiera-de-al-menos-32-chars', {
      subject: String(user._id),
    });

    const res = await request(app).get('/api/auth/me').set('Cookie', `sgp_session=${token}`);
    expect(res.status).toBe(401);
  });

  test('rechaza un token vencido', async () => {
    const user = await crearUsuario();
    const token = jwt.sign(
      { sv: 0, exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET,
      { subject: String(user._id) }
    );

    const res = await request(app).get('/api/auth/me').set('Cookie', `sgp_session=${token}`);
    expect(res.status).toBe(401);
  });

  test('deshabilitar la cuenta corta la sesión abierta', async () => {
    const user = await crearUsuario();
    const agent = await iniciarSesion(user.email);

    await User.updateOne({ _id: user._id }, { activo: false });
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
    const [registro] = await buscarAuditoria({ accion: 'ACCESO_NO_AUTENTICADO' });
    expect(registro.detalle.motivo).toBe('cuenta_deshabilitada');
  });
});

describe('POST /api/auth/logout', () => {
  test('elimina la cookie y revoca el token en el servidor', async () => {
    const user = await crearUsuario();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });
    const cookie = cookieDeSesion(login).split(';')[0];

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(204);
    const eliminada = cookieDeSesion(res);
    expect(eliminada).toMatch(/^sgp_session=;/);
    expect(eliminada).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await buscarAuditoria({ accion: 'LOGOUT', usuario: user._id })).toHaveLength(1);

    // Reutilizar el token anterior ya no es posible.
    const reutilizado = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(reutilizado.status).toBe(401);
    const [registro] = await buscarAuditoria({ accion: 'ACCESO_NO_AUTENTICADO' });
    expect(registro.detalle.motivo).toBe('sesion_revocada');
  });

  test('responde 204 aunque no exista sesión', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});

describe('Protección CSRF por origen', () => {
  test('rechaza solicitudes que modifican datos desde otro origen', async () => {
    const user = await crearUsuario();

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://sitio-malicioso.example')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(await buscarAuditoria({ accion: 'ORIGEN_RECHAZADO' })).toHaveLength(1);
  });

  test('acepta solicitudes desde el origen del frontend', async () => {
    const user = await crearUsuario();

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
  });
});

describe('Contraseña temporal', () => {
  test('exige cambiarla antes de usar funcionalidades protegidas', async () => {
    const admin = await crearUsuario({ rol: ROLES.ADMIN, debeCambiarPassword: true });
    const agent = await iniciarSesion(admin.email);

    const me = await agent.get('/api/auth/me');
    expect(me.body.usuario.debeCambiarPassword).toBe(true);

    const bloqueado = await agent.get('/api/users');
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.codigo).toBe('CAMBIO_PASSWORD_REQUERIDO');

    const incorrecta = await agent
      .post('/api/auth/password')
      .send({ passwordActual: 'NoEsLaClave1', passwordNueva: 'NuevaClave2024' });
    expect(incorrecta.status).toBe(400);

    const debil = await agent
      .post('/api/auth/password')
      .send({ passwordActual: PASSWORD, passwordNueva: 'corta' });
    expect(debil.status).toBe(400);

    const cambio = await agent
      .post('/api/auth/password')
      .send({ passwordActual: PASSWORD, passwordNueva: 'NuevaClave2024' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.usuario.debeCambiarPassword).toBe(false);

    // La sesión se renueva con la nueva cookie y ya puede usar el sistema.
    const permitido = await agent.get('/api/users');
    expect(permitido.status).toBe(200);
    expect(await buscarAuditoria({ accion: 'CAMBIO_PASSWORD', resultado: 'exito' })).toHaveLength(1);
  });
});

describe('Limitación de intentos de inicio de sesión', () => {
  test('bloquea la cuenta tras 5 intentos fallidos desde la misma IP', async () => {
    const user = await crearUsuario();

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: `Incorrecta${i}x` });
      expect(res.status).toBe(401);
    }

    // Incluso con la contraseña correcta, el sexto intento queda bloqueado.
    const bloqueado = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(bloqueado.status).toBe(429);
    expect(await buscarAuditoria({ accion: 'INTENTOS_EXCEDIDOS' })).toHaveLength(1);
  });
});
