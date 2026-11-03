const request = require('supertest');
const TipoDiagnostico = require('../src/models/TipoDiagnostico');
const { ROLES } = require('../src/config/roles');
const {
  app,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

let adminAgent;
let psicoAgent;

beforeEach(async () => {
  const admin = await crearUsuario({ rol: ROLES.ADMIN });
  const psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
});

async function crear(nombre) {
  const res = await adminAgent.post('/api/tipos-diagnostico').send({ nombre });
  expect(res.status).toBe(201);
  return res.body.tipo;
}

describe('Categorías de tipo de diagnóstico', () => {
  test('el administrador agrega, renombra y desactiva categorías', async () => {
    const tipo = await crear('  Categoría   de prueba ');
    expect(tipo).toMatchObject({ nombre: 'Categoría de prueba', activo: true });
    expect(tipo).not.toHaveProperty('nombreNormalizado');

    const renombrado = await adminAgent
      .patch(`/api/tipos-diagnostico/${tipo._id}`)
      .send({ nombre: 'Categoría renombrada' });
    expect(renombrado.body.tipo.nombre).toBe('Categoría renombrada');

    const desactivado = await adminAgent
      .patch(`/api/tipos-diagnostico/${tipo._id}`)
      .send({ activo: false });
    expect(desactivado.body.tipo.activo).toBe(false);
    expect(await buscarAuditoria({ accion: 'TIPO_DIAGNOSTICO_CREADO' })).toHaveLength(1);
    expect(await buscarAuditoria({ accion: 'TIPO_DIAGNOSTICO_ACTUALIZADO' })).toHaveLength(2);
  });

  test('impide nombres repetidos aunque cambien las mayúsculas', async () => {
    const tipo = await crear('Categoría A');
    await crear('Categoría B');

    const repetido = await adminAgent.post('/api/tipos-diagnostico').send({ nombre: 'categoría a' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.detalles).toHaveProperty('nombre');

    const renombrado = await adminAgent
      .patch(`/api/tipos-diagnostico/${tipo._id}`)
      .send({ nombre: 'CATEGORÍA B' });
    expect(renombrado.status).toBe(409);
    expect(await TipoDiagnostico.countDocuments()).toBe(2);
  });

  test('valida el nombre', async () => {
    expect((await adminAgent.post('/api/tipos-diagnostico').send({ nombre: ' ' })).status).toBe(400);
    expect(
      (await adminAgent.post('/api/tipos-diagnostico').send({ nombre: 'x'.repeat(151) })).status
    ).toBe(400);
    expect(
      (await adminAgent.post('/api/tipos-diagnostico').send({ nombre: 'A', activo: false })).status
    ).toBe(400);
  });

  test('el psicopedagogo solo ve las categorías activas y no puede gestionarlas', async () => {
    const tipo = await crear('Categoría activa');
    const inactiva = await crear('Categoría inactiva');
    await adminAgent.patch(`/api/tipos-diagnostico/${inactiva._id}`).send({ activo: false });

    const lista = await psicoAgent.get('/api/tipos-diagnostico?incluirInactivas=true');
    expect(lista.body.tipos.map((t) => t.nombre)).toEqual(['Categoría activa']);

    const todas = await adminAgent.get('/api/tipos-diagnostico?incluirInactivas=true');
    expect(todas.body.tipos).toHaveLength(2);

    expect((await psicoAgent.post('/api/tipos-diagnostico').send({ nombre: 'Nueva' })).status).toBe(403);
    expect(
      (await psicoAgent.patch(`/api/tipos-diagnostico/${tipo._id}`).send({ activo: false })).status
    ).toBe(403);
  });

  test('un usuario no autenticado recibe 401', async () => {
    expect((await request(app).get('/api/tipos-diagnostico')).status).toBe(401);
    expect((await request(app).post('/api/tipos-diagnostico')).status).toBe(401);
  });
});
