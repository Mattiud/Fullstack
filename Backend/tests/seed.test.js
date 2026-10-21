const request = require('supertest');
const User = require('../src/models/User');
const { ROLES } = require('../src/config/roles');
const { sembrarUsuarios } = require('../scripts/seed-usuarios');
const { app, usarBaseDeDatosDePrueba } = require('./helpers');

usarBaseDeDatosDePrueba();

describe('Seed de usuarios de prueba', () => {
  test('inserta un usuario por rol y ambos pueden iniciar sesión', async () => {
    const creados = await sembrarUsuarios();

    expect(creados.map((u) => u.rol).sort()).toEqual([ROLES.ADMIN, ROLES.PSICOPEDAGOGO]);
    for (const { email, password, rol } of creados) {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.usuario.rol).toBe(rol);
    }
  });

  test('usa las credenciales fijas de prueba', async () => {
    await sembrarUsuarios();

    for (const [email, password] of [
      ['admin.prueba@sgp.test', 'AdminPrueba1'],
      ['psicopedagogo.prueba@sgp.test', 'PsicoPrueba1'],
    ]) {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
    }
  });

  test('no duplica usuarios si se ejecuta de nuevo', async () => {
    await sembrarUsuarios();
    const segunda = await sembrarUsuarios();

    expect(segunda).toHaveLength(0);
    expect(await User.countDocuments()).toBe(2);
  });

  test('se niega a ejecutarse en producción', async () => {
    await expect(sembrarUsuarios({ entorno: 'production' })).rejects.toThrow('producción');
    expect(await User.countDocuments()).toBe(0);
  });
});
