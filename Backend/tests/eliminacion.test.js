const request = require('supertest');
const User = require('../src/models/User');
const Menor = require('../src/models/Menor');
const Diagnostico = require('../src/models/Diagnostico');
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

// Datos ficticios.
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

// Cuenta creada por el administrador que nunca inició sesión.
async function cuentaSinUso(cambios = {}) {
  const res = await adminAgent.post('/api/users').send({
    nombre: 'Cuenta Ficticia Sin Uso',
    email: 'sin.uso@prueba.cl',
    password: 'ClaveTemporal123',
    rol: ROLES.PSICOPEDAGOGO,
    ...cambios,
  });
  expect(res.status).toBe(201);
  return res.body.usuario;
}

async function menorFicticio() {
  return Menor.create({
    nombre: 'Menor Ficticio Uno',
    rut: '12345678-5',
    fechaNacimiento: new Date('2016-03-12'),
    antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
    profesionalesAsignados: [psico._id],
  });
}

describe('Eliminación de usuarios', () => {
  test('elimina de la base de datos una cuenta sin información asociada', async () => {
    const cuenta = await cuentaSinUso();
    const res = await adminAgent.delete(`/api/users/${cuenta._id}`);
    expect(res.status).toBe(204);
    expect(await User.findById(cuenta._id)).toBeNull();

    const lista = await adminAgent.get('/api/users');
    expect(lista.body.usuarios.map((u) => u._id)).not.toContain(cuenta._id);

    const [auditoria] = await buscarAuditoria({ accion: 'USUARIO_ELIMINADO' });
    expect(auditoria).toMatchObject({
      recursoId: cuenta._id,
      detalle: { nombre: 'Cuenta Ficticia Sin Uso', rol: ROLES.PSICOPEDAGOGO },
    });
  });

  test('no elimina una cuenta con actividad registrada y lo informa', async () => {
    // El psicopedagogo inició sesión: tiene registros de actividad.
    const res = await adminAgent.delete(`/api/users/${psico._id}`);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('USUARIO_CON_DEPENDENCIAS');
    expect(res.body.detalles.dependencias).toContain('registros de actividad');
    expect(res.body.error).toMatch(/Desactívela/);
    expect(await User.findById(psico._id)).not.toBeNull();
    expect(await buscarAuditoria({ accion: 'USUARIO_ELIMINADO' })).toHaveLength(0);
  });

  test('no elimina una cuenta asignada a un menor', async () => {
    const cuenta = await cuentaSinUso();
    const menor = await menorFicticio();
    await Menor.updateOne({ _id: menor._id }, { $push: { profesionalesAsignados: cuenta._id } });

    const res = await adminAgent.delete(`/api/users/${cuenta._id}`);
    expect(res.status).toBe(409);
    expect(res.body.detalles.dependencias).toEqual(['menores registrados o asignados']);
    expect(await User.exists({ _id: cuenta._id })).toBeTruthy();
    // El menor conserva su asignación: nada queda inconsistente.
    const intacto = await Menor.findById(menor._id).lean();
    expect(intacto.profesionalesAsignados.map(String)).toContain(cuenta._id);
  });

  test('desactivar sigue funcionando y no elimina la cuenta', async () => {
    const cuenta = await cuentaSinUso();
    const res = await adminAgent.patch(`/api/users/${cuenta._id}`).send({ activo: false });
    expect(res.status).toBe(200);
    expect(res.body.usuario.activo).toBe(false);
    expect(await User.exists({ _id: cuenta._id })).toBeTruthy();
  });

  test('no permite eliminar la propia cuenta', async () => {
    const res = await adminAgent.delete(`/api/users/${admin._id}`);
    expect(res.status).toBe(400);
    expect(await User.exists({ _id: admin._id })).toBeTruthy();
  });

  test('solo el administrador puede eliminar cuentas', async () => {
    const cuenta = await cuentaSinUso();
    expect((await psicoAgent.delete(`/api/users/${cuenta._id}`)).status).toBe(403);
    expect((await request(app).delete(`/api/users/${cuenta._id}`)).status).toBe(401);
    expect(await User.exists({ _id: cuenta._id })).toBeTruthy();
    expect((await adminAgent.delete('/api/users/000000000000000000000000')).status).toBe(404);
  });
});

describe('Eliminación de tipos de diagnóstico', () => {
  async function crearTipo(nombre) {
    const res = await adminAgent.post('/api/tipos-diagnostico').send({ nombre });
    expect(res.status).toBe(201);
    return res.body.tipo;
  }

  function diagnostico(menor, cambios = {}) {
    return Diagnostico.create({
      menor: menor._id,
      tipo: 'Categoría ficticia',
      fechaEvaluacion: new Date('2026-10-01'),
      descripcion: 'Hallazgos ficticios.',
      estado: 'vigente',
      version: 1,
      creadoPor: psico._id,
      actualizadoPor: psico._id,
      ...cambios,
    });
  }

  test('elimina de la base de datos una categoría que no se usa', async () => {
    const tipo = await crearTipo('Categoría ficticia');
    const res = await adminAgent.delete(`/api/tipos-diagnostico/${tipo._id}`);
    expect(res.status).toBe(204);
    expect(await TipoDiagnostico.findById(tipo._id)).toBeNull();
    const lista = await adminAgent.get('/api/tipos-diagnostico?incluirInactivas=true');
    expect(lista.body.tipos).toHaveLength(0);
    const [auditoria] = await buscarAuditoria({ accion: 'TIPO_DIAGNOSTICO_ELIMINADO' });
    expect(auditoria.detalle.nombre).toBe('Categoría ficticia');
  });

  test.each([
    ['en un diagnóstico vigente', {}],
    [
      'solo en una versión anterior',
      {
        tipo: 'Otra categoría',
        version: 2,
        versiones: [
          {
            version: 1,
            tipo: 'CATEGORÍA FICTICIA',
            fechaEvaluacion: new Date('2026-09-01'),
            descripcion: 'Versión anterior ficticia.',
            fecha: new Date('2026-09-02'),
          },
        ],
      },
    ],
  ])('no elimina una categoría usada %s', async (_caso, cambios) => {
    const tipo = await crearTipo('Categoría ficticia');
    const menor = await menorFicticio();
    await diagnostico(menor, cambios);

    const res = await adminAgent.delete(`/api/tipos-diagnostico/${tipo._id}`);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('CATEGORIA_EN_USO');
    expect(res.body.error).toMatch(/1 diagnóstico.*Desactívela/);
    expect(await TipoDiagnostico.exists({ _id: tipo._id })).toBeTruthy();
  });

  test('un tipo escrito como «Otro» con el mismo nombre no bloquea la eliminación', async () => {
    const tipo = await crearTipo('Categoría ficticia');
    const menor = await menorFicticio();
    await diagnostico(menor, { tipoPersonalizado: true });
    expect((await adminAgent.delete(`/api/tipos-diagnostico/${tipo._id}`)).status).toBe(204);
    // El diagnóstico no cambia.
    expect(await Diagnostico.countDocuments({ tipo: 'Categoría ficticia' })).toBe(1);
  });

  test('desactivar sigue funcionando y no elimina la categoría', async () => {
    const tipo = await crearTipo('Categoría ficticia');
    const res = await adminAgent
      .patch(`/api/tipos-diagnostico/${tipo._id}`)
      .send({ activo: false });
    expect(res.body.tipo.activo).toBe(false);
    expect(await TipoDiagnostico.exists({ _id: tipo._id })).toBeTruthy();
  });

  test('solo el administrador puede eliminar categorías', async () => {
    const tipo = await crearTipo('Categoría ficticia');
    expect((await psicoAgent.delete(`/api/tipos-diagnostico/${tipo._id}`)).status).toBe(403);
    expect((await request(app).delete(`/api/tipos-diagnostico/${tipo._id}`)).status).toBe(401);
    expect(await TipoDiagnostico.exists({ _id: tipo._id })).toBeTruthy();
    expect(
      (await adminAgent.delete('/api/tipos-diagnostico/000000000000000000000000')).status
    ).toBe(404);
  });
});
