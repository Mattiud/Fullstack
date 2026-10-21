// Verifica la restricción de acceso a expedientes con un modelo de prueba, ya que el
// módulo de perfiles de menores aún no existe. Los datos son ficticios.
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const request = require('supertest');
const authenticate = require('../src/middleware/authenticate');
const authorize = require('../src/middleware/authorize');
const { authorizeMenorAccess, filtroMenoresAccesibles } = require('../src/middleware/menorAccess');
const { errorHandler } = require('../src/middleware/errorHandler');
const { ROLES, PERMISSIONS } = require('../src/config/roles');
const {
  app,
  PASSWORD,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  cookieDeSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

const MenorPrueba = mongoose.model(
  'MenorPrueba',
  new mongoose.Schema({
    alias: String,
    profesionalesAsignados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  })
);

const expedientesApp = express();
expedientesApp.use(cookieParser());
expedientesApp.get(
  '/api/menores',
  authenticate(),
  authorize(PERMISSIONS.EXPEDIENTES_LEER),
  async (req, res) => {
    const menores = await MenorPrueba.find(filtroMenoresAccesibles(req.user)).lean();
    res.json({ menores: menores.map((m) => m.alias) });
  }
);
expedientesApp.get(
  '/api/menores/:menorId',
  authenticate(),
  authorize(PERMISSIONS.EXPEDIENTES_LEER),
  authorizeMenorAccess(MenorPrueba),
  (req, res) => res.json({ id: String(req.menorId) })
);
expedientesApp.post(
  '/api/menores/:menorId/diagnosticos',
  authenticate(),
  authorize(PERMISSIONS.DIAGNOSTICOS_EDITAR),
  authorizeMenorAccess(MenorPrueba),
  (req, res) => res.status(201).json({ id: String(req.menorId) })
);
expedientesApp.use(errorHandler);

async function cookiePara(user) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: PASSWORD });
  return cookieDeSesion(res).split(';')[0];
}

let admin;
let asignado;
let otroPsico;
let menorA;
let menorB;

beforeEach(async () => {
  admin = await crearUsuario({ rol: ROLES.ADMIN });
  asignado = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  menorA = await MenorPrueba.create({ alias: 'Menor A', profesionalesAsignados: [asignado._id] });
  menorB = await MenorPrueba.create({ alias: 'Menor B', profesionalesAsignados: [otroPsico._id] });
});

describe('Acceso a expedientes de menores', () => {
  test('el psicopedagogo asignado accede al expediente', async () => {
    const res = await request(expedientesApp)
      .get(`/api/menores/${menorA._id}`)
      .set('Cookie', await cookiePara(asignado));
    expect(res.status).toBe(200);
  });

  test('un psicopedagogo no asignado recibe 403 y el intento se registra', async () => {
    const res = await request(expedientesApp)
      .get(`/api/menores/${menorA._id}`)
      .set('Cookie', await cookiePara(otroPsico));

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('alias');
    const [registro] = await buscarAuditoria({ accion: 'ACCESO_DENEGADO' });
    expect(registro).toMatchObject({ recurso: 'menor', recursoId: String(menorA._id) });
    expect(registro.usuario.equals(otroPsico._id)).toBe(true);
  });

  test('el administrador accede a todos los expedientes', async () => {
    const cookie = await cookiePara(admin);
    const a = await request(expedientesApp).get(`/api/menores/${menorA._id}`).set('Cookie', cookie);
    const b = await request(expedientesApp).get(`/api/menores/${menorB._id}`).set('Cookie', cookie);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  test('un usuario no autenticado recibe 401', async () => {
    const res = await request(expedientesApp).get(`/api/menores/${menorA._id}`);
    expect(res.status).toBe(401);
  });

  test('responde 404 si el expediente no existe y 400 si el id es inválido', async () => {
    const cookie = await cookiePara(admin);
    const inexistente = await request(expedientesApp)
      .get(`/api/menores/${new mongoose.Types.ObjectId()}`)
      .set('Cookie', cookie);
    const invalido = await request(expedientesApp).get('/api/menores/abc').set('Cookie', cookie);
    expect(inexistente.status).toBe(404);
    expect(invalido.status).toBe(400);
  });

  test('el listado solo incluye los expedientes asignados al psicopedagogo', async () => {
    const psico = await request(expedientesApp)
      .get('/api/menores')
      .set('Cookie', await cookiePara(asignado));
    const todos = await request(expedientesApp)
      .get('/api/menores')
      .set('Cookie', await cookiePara(admin));

    expect(psico.body.menores).toEqual(['Menor A']);
    expect(todos.body.menores.sort()).toEqual(['Menor A', 'Menor B']);
  });

  test('solo el psicopedagogo asignado puede editar diagnósticos; el administrador no', async () => {
    const ruta = `/api/menores/${menorA._id}/diagnosticos`;
    const asignadoRes = await request(expedientesApp)
      .post(ruta)
      .set('Cookie', await cookiePara(asignado));
    const adminRes = await request(expedientesApp)
      .post(ruta)
      .set('Cookie', await cookiePara(admin));
    const otroRes = await request(expedientesApp)
      .post(ruta)
      .set('Cookie', await cookiePara(otroPsico));

    expect(asignadoRes.status).toBe(201);
    expect(adminRes.status).toBe(403);
    expect(otroRes.status).toBe(403);
  });

  test('una cuenta con contraseña temporal no accede a expedientes', async () => {
    const temporal = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO, debeCambiarPassword: true });
    await MenorPrueba.updateOne({ _id: menorA._id }, { $push: { profesionalesAsignados: temporal._id } });

    const res = await request(expedientesApp)
      .get(`/api/menores/${menorA._id}`)
      .set('Cookie', await cookiePara(temporal));
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('CAMBIO_PASSWORD_REQUERIDO');
  });
});
