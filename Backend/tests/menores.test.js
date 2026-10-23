const request = require('supertest');
const Menor = require('../src/models/Menor');
const { ROLES } = require('../src/config/roles');
const { normalizarRut, validarRut } = require('../src/utils/validators');
const {
  app,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

// Datos ficticios: el RUT es válido según el dígito verificador pero no corresponde a nadie.
function datosMenor(cambios = {}) {
  return {
    nombre: 'Menor Ficticio Uno',
    rut: '12.345.678-5',
    fechaNacimiento: '2016-03-12',
    establecimiento: 'Colegio de Prueba',
    curso: '4° básico',
    fechaIngreso: '2026-03-04',
    apoderado: { nombre: 'Apoderado Ficticio', parentesco: 'Madre', telefono: '+56 9 1234 5678' },
    antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
    ...cambios,
  };
}

let admin;
let psico;
let otroPsico;
let adminAgent;
let psicoAgent;
let otroAgent;

beforeEach(async () => {
  admin = await crearUsuario({ rol: ROLES.ADMIN });
  psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
  otroAgent = await iniciarSesion(otroPsico.email);
});

async function registrar(cambios) {
  const res = await psicoAgent.post('/api/menores').send(datosMenor(cambios));
  expect(res.status).toBe(201);
  return res.body.menor;
}

describe('Validación de RUT', () => {
  test.each([
    ['12.345.678-5', null],
    ['12345678-5', null],
    ['7.654.321-6', null],
    ['12.345.678-K', 'El dígito verificador del RUT no es válido'],
    ['abc', 'El RUT no tiene un formato válido'],
  ])('%s', (rut, error) => {
    expect(validarRut(rut)).toBe(error);
  });

  test('normaliza puntos, espacios y mayúsculas', () => {
    expect(normalizarRut(' 20.123.456-k ')).toBe('20123456-K');
  });
});

describe('Registro de menores (T04, T05)', () => {
  test('el psicopedagogo registra un menor que queda guardado y asignado a él', async () => {
    const menor = await registrar();

    expect(menor).toMatchObject({ nombre: 'Menor Ficticio Uno', rut: '12345678-5', activo: true });
    expect(menor.edad).toBeGreaterThanOrEqual(10);
    const guardado = await Menor.findById(menor._id);
    expect(guardado.profesionalesAsignados.map(String)).toEqual([String(psico._id)]);
    expect(guardado.fechaNacimiento.toISOString()).toBe('2016-03-12T00:00:00.000Z');
    expect(await buscarAuditoria({ accion: 'MENOR_CREADO', recursoId: menor._id })).toHaveLength(1);
  });

  test('impide registrar dos menores con el mismo RUT, aunque se escriba distinto', async () => {
    await registrar();
    const res = await psicoAgent.post('/api/menores').send(datosMenor({ rut: '12345678-5' }));

    expect(res.status).toBe(409);
    expect(res.body.detalles).toHaveProperty('rut');
    expect(await Menor.countDocuments()).toBe(1);
  });

  test('valida los campos obligatorios', async () => {
    const res = await psicoAgent.post('/api/menores').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.detalles).sort()).toEqual(
      ['antecedentesRelevantes', 'fechaNacimiento', 'nombre', 'rut'].sort()
    );
  });

  test('valida formatos: RUT, fechas, teléfono y datos del apoderado', async () => {
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await psicoAgent.post('/api/menores').send(
      datosMenor({
        rut: '12.345.678-K',
        fechaNacimiento: manana,
        fechaIngreso: '2026-02-30',
        apoderado: { nombre: '', parentesco: 'Padre', telefono: 'abc' },
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.detalles).toMatchObject({
      rut: expect.any(String),
      fechaNacimiento: 'La fecha de nacimiento no puede ser futura',
      fechaIngreso: expect.any(String),
      'apoderado.nombre': expect.any(String),
      'apoderado.telefono': expect.any(String),
    });
  });

  test('exige apoderado a una persona menor de 18 años', async () => {
    const { apoderado, ...sinApoderado } = datosMenor();
    const res = await psicoAgent.post('/api/menores').send(sinApoderado);
    expect(res.status).toBe(400);
    expect(res.body.detalles.apoderado).toBe(
      'Los datos del apoderado son obligatorios para menores de 18 años'
    );
  });

  test('registra a una persona de exactamente 18 años sin apoderado', async () => {
    const hoy = new Date();
    const hace18 = new Date(Date.UTC(hoy.getUTCFullYear() - 18, hoy.getUTCMonth(), hoy.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    const { apoderado, ...sinApoderado } = datosMenor({ fechaNacimiento: hace18 });

    const res = await psicoAgent.post('/api/menores').send(sinApoderado);

    expect(res.status).toBe(201);
    expect(res.body.menor.edad).toBe(18);
    expect(res.body.menor).not.toHaveProperty('apoderado');
  });

  test('registra a un adulto sin apoderado y aparece en el listado', async () => {
    const { apoderado, ...sinApoderado } = datosMenor({
      nombre: 'Adulto Ficticio',
      rut: '21.291.454-1',
      fechaNacimiento: '1990-06-15',
    });
    expect((await psicoAgent.post('/api/menores').send(sinApoderado)).status).toBe(201);

    const lista = await psicoAgent.get('/api/menores');
    expect(lista.body.menores[0]).toMatchObject({ nombre: 'Adulto Ficticio', apoderado: null });
    expect(lista.body.menores[0].edad).toBeGreaterThanOrEqual(36);
  });

  test('a un adulto con datos de apoderado incompletos se le validan todos', async () => {
    const res = await psicoAgent.post('/api/menores').send(
      datosMenor({
        fechaNacimiento: '1990-06-15',
        apoderado: { nombre: 'Familiar Ficticio', parentesco: '', telefono: '' },
      })
    );
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty(['apoderado.parentesco']);
    expect(res.body.detalles).toHaveProperty(['apoderado.telefono']);
  });

  test('trata como duplicado el mismo RUT escrito con y sin puntos', async () => {
    await registrar({ rut: '21291454-1' });
    const res = await psicoAgent.post('/api/menores').send(datosMenor({ rut: '21.291.454-1' }));
    expect(res.status).toBe(409);
    expect((await Menor.findOne()).rut).toBe('21291454-1');
  });

  test('rechaza campos no previstos, como la asignación de profesionales', async () => {
    const res = await psicoAgent
      .post('/api/menores')
      .send(datosMenor({ profesionalesAsignados: [String(otroPsico._id)] }));
    expect(res.status).toBe(400);
  });

  test('el administrador no puede registrar menores', async () => {
    const res = await adminAgent.post('/api/menores').send(datosMenor());
    expect(res.status).toBe(403);
  });
});

describe('Listado', () => {
  test('el menor registrado aparece en el listado con datos mínimos', async () => {
    await registrar();
    const res = await psicoAgent.get('/api/menores');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.menores[0]).toEqual({
      _id: expect.any(String),
      nombre: 'Menor Ficticio Uno',
      edad: expect.any(Number),
      apoderado: { nombre: 'Apoderado Ficticio' },
      activo: true,
    });
  });

  test('cada psicopedagogo ve solo sus menores; el administrador ve todos', async () => {
    await registrar();
    await otroAgent.post('/api/menores').send(datosMenor({ nombre: 'Menor Ficticio Dos', rut: '7.654.321-6' }));

    const propios = await psicoAgent.get('/api/menores');
    const todos = await adminAgent.get('/api/menores');

    expect(propios.body.menores.map((m) => m.nombre)).toEqual(['Menor Ficticio Uno']);
    expect(todos.body.menores.map((m) => m.nombre)).toEqual(['Menor Ficticio Dos', 'Menor Ficticio Uno']);
  });

  test('busca por nombre o por RUT con o sin formato, y filtra por estado', async () => {
    const menor = await registrar();
    await registrar({ nombre: 'Otro Ficticio', rut: '7.654.321-6' });
    await psicoAgent.patch(`/api/menores/${menor._id}/estado`).send({ activo: false });

    const porNombre = await psicoAgent.get('/api/menores').query({ q: 'otro' });
    const porRut = await psicoAgent.get('/api/menores').query({ q: '12.345.678' });
    const porRutLimpio = await psicoAgent.get('/api/menores').query({ q: '123456785' });
    const activos = await psicoAgent.get('/api/menores').query({ estado: 'activos' });
    const inyeccion = await psicoAgent.get('/api/menores').query({ q: '.*' });

    expect(porNombre.body.menores.map((m) => m.nombre)).toEqual(['Otro Ficticio']);
    expect(porRut.body.menores.map((m) => m.nombre)).toEqual(['Menor Ficticio Uno']);
    expect(porRutLimpio.body.total).toBe(1);
    expect(activos.body.menores.map((m) => m.nombre)).toEqual(['Otro Ficticio']);
    expect(inyeccion.body.total).toBe(0);
  });
});

describe('Consulta y actualización (T06)', () => {
  test('el psicopedagogo asignado consulta la ficha y queda registrado el acceso', async () => {
    const menor = await registrar();
    const res = await psicoAgent.get(`/api/menores/${menor._id}`);

    expect(res.status).toBe(200);
    expect(res.body.menor).toMatchObject({
      rut: '12345678-5',
      apoderado: { parentesco: 'Madre' },
      antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
    });
    expect(res.body.menor.profesionalesAsignados[0]).toMatchObject({ nombre: psico.nombre });
    expect(res.body.menor.profesionalesAsignados[0]).not.toHaveProperty('passwordHash');
    expect(await buscarAuditoria({ accion: 'MENOR_CONSULTADO' })).toHaveLength(1);
  });

  test('actualiza los datos y registra solo los nombres de los campos modificados', async () => {
    const menor = await registrar();
    const res = await psicoAgent.patch(`/api/menores/${menor._id}`).send({
      curso: '5° básico',
      apoderado: { nombre: 'Apoderado Ficticio', parentesco: 'Madre', telefono: '+56 9 8765 4321' },
    });

    expect(res.status).toBe(200);
    expect(res.body.campos.sort()).toEqual(['apoderado.telefono', 'curso']);
    const guardado = await Menor.findById(menor._id);
    expect(guardado.curso).toBe('5° básico');

    const [registro] = await buscarAuditoria({ accion: 'MENOR_ACTUALIZADO' });
    expect(registro.usuario.equals(psico._id)).toBe(true);
    expect(registro.detalle.campos.sort()).toEqual(['apoderado.telefono', 'curso']);
    expect(JSON.stringify(registro)).not.toMatch(/8765|5° básico/);

    const historial = await psicoAgent.get(`/api/menores/${menor._id}/historial`);
    expect(historial.body.historial.map((h) => h.accion)).toEqual(['MENOR_ACTUALIZADO', 'MENOR_CREADO']);
  });

  test('valida la actualización y el RUT duplicado', async () => {
    const menor = await registrar();
    await registrar({ nombre: 'Otro Ficticio', rut: '7.654.321-6' });

    const invalido = await psicoAgent.patch(`/api/menores/${menor._id}`).send({ nombre: '' });
    const duplicado = await psicoAgent.patch(`/api/menores/${menor._id}`).send({ rut: '7654321-6' });
    const vacio = await psicoAgent.patch(`/api/menores/${menor._id}`).send({});

    expect(invalido.status).toBe(400);
    expect(duplicado.status).toBe(409);
    expect(vacio.status).toBe(400);
  });

  test('no permite quitar el apoderado a un menor, pero sí a un adulto', async () => {
    const menor = await registrar();
    const menorSinApoderado = await psicoAgent.patch(`/api/menores/${menor._id}`).send({ apoderado: null });
    expect(menorSinApoderado.status).toBe(400);

    const adulto = await registrar({ rut: '7.654.321-6', fechaNacimiento: '1990-06-15' });
    const res = await psicoAgent.patch(`/api/menores/${adulto._id}`).send({ apoderado: null });
    expect(res.status).toBe(200);
    expect(res.body.campos).toEqual(['apoderado']);
    expect((await Menor.findById(adulto._id)).apoderado).toBeUndefined();

    // Volver a agregarlo registra sus tres campos.
    const agregar = await psicoAgent.patch(`/api/menores/${adulto._id}`).send({
      apoderado: { nombre: 'Familiar Ficticio', parentesco: 'Hermana', telefono: '+56 9 2222 3333' },
    });
    expect(agregar.status).toBe(200);
    expect(agregar.body.menor.apoderado).toMatchObject({ parentesco: 'Hermana' });
  });

  test('cambiar la fecha de nacimiento a la de un menor exige apoderado', async () => {
    const { apoderado, ...sinApoderado } = datosMenor({ fechaNacimiento: '1990-06-15' });
    const adulto = (await psicoAgent.post('/api/menores').send(sinApoderado)).body.menor;

    const res = await psicoAgent.patch(`/api/menores/${adulto._id}`).send({ fechaNacimiento: '2015-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('apoderado');
  });

  test('desactiva y reactiva un menor sin eliminar sus datos', async () => {
    const menor = await registrar();
    const desactivar = await psicoAgent.patch(`/api/menores/${menor._id}/estado`).send({ activo: false });
    expect(desactivar.body.menor.activo).toBe(false);
    expect(await Menor.countDocuments()).toBe(1);

    const reactivar = await psicoAgent.patch(`/api/menores/${menor._id}/estado`).send({ activo: true });
    expect(reactivar.body.menor.activo).toBe(true);
    expect(await buscarAuditoria({ accion: 'MENOR_ESTADO' })).toHaveLength(2);
  });
});

describe('Restricciones de acceso (T03)', () => {
  test('un usuario no autenticado recibe 401 en todos los endpoints', async () => {
    const menor = await registrar();
    for (const [metodo, ruta] of [
      ['get', '/api/menores'],
      ['post', '/api/menores'],
      ['get', `/api/menores/${menor._id}`],
      ['patch', `/api/menores/${menor._id}`],
      ['get', `/api/menores/${menor._id}/historial`],
    ]) {
      expect((await request(app)[metodo](ruta)).status).toBe(401);
    }
  });

  test('un psicopedagogo no asignado no puede consultar ni modificar, y el intento se registra', async () => {
    const menor = await registrar();

    const consulta = await otroAgent.get(`/api/menores/${menor._id}`);
    const edicion = await otroAgent.patch(`/api/menores/${menor._id}`).send({ curso: 'X' });
    const historial = await otroAgent.get(`/api/menores/${menor._id}/historial`);

    expect([consulta.status, edicion.status, historial.status]).toEqual([403, 403, 403]);
    expect(consulta.body).not.toHaveProperty('menor');
    expect((await Menor.findById(menor._id)).curso).toBe('4° básico');
    const denegados = await buscarAuditoria({ accion: 'ACCESO_DENEGADO', recursoId: String(menor._id) });
    expect(denegados).toHaveLength(3);
  });

  test('el administrador consulta la ficha pero no la edita ni la desactiva', async () => {
    const menor = await registrar();

    expect((await adminAgent.get(`/api/menores/${menor._id}`)).status).toBe(200);
    expect((await adminAgent.patch(`/api/menores/${menor._id}`).send({ curso: 'X' })).status).toBe(403);
    expect(
      (await adminAgent.patch(`/api/menores/${menor._id}/estado`).send({ activo: false })).status
    ).toBe(403);
  });

  test('un identificador inexistente responde 404 y uno inválido 400', async () => {
    expect((await adminAgent.get('/api/menores/000000000000000000000000')).status).toBe(404);
    expect((await adminAgent.get('/api/menores/no-es-id')).status).toBe(400);
  });
});

describe('Asignación de profesionales', () => {
  test('el administrador asigna otro profesional, que pasa a tener acceso', async () => {
    const menor = await registrar();
    expect((await otroAgent.get(`/api/menores/${menor._id}`)).status).toBe(403);

    const res = await adminAgent
      .put(`/api/menores/${menor._id}/profesionales`)
      .send({ profesionales: [String(psico._id), String(otroPsico._id)] });

    expect(res.status).toBe(200);
    expect(res.body.menor.profesionalesAsignados).toHaveLength(2);
    expect((await otroAgent.get(`/api/menores/${menor._id}`)).status).toBe(200);
    expect(await buscarAuditoria({ accion: 'PROFESIONALES_ASIGNADOS' })).toHaveLength(1);
  });

  test('quitar a un profesional le retira el acceso', async () => {
    const menor = await registrar();
    await adminAgent
      .put(`/api/menores/${menor._id}/profesionales`)
      .send({ profesionales: [String(otroPsico._id)] });

    expect((await psicoAgent.get(`/api/menores/${menor._id}`)).status).toBe(403);
  });

  test('solo acepta psicopedagogos activos y al menos uno', async () => {
    const menor = await registrar();
    const inactivo = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO, activo: false });
    const ruta = `/api/menores/${menor._id}/profesionales`;

    expect((await adminAgent.put(ruta).send({ profesionales: [] })).status).toBe(400);
    expect((await adminAgent.put(ruta).send({ profesionales: [String(admin._id)] })).status).toBe(400);
    expect((await adminAgent.put(ruta).send({ profesionales: [String(inactivo._id)] })).status).toBe(400);
    expect((await adminAgent.put(ruta).send({ profesionales: ['abc'] })).status).toBe(400);
  });

  test('el psicopedagogo no puede asignar profesionales', async () => {
    const menor = await registrar();
    const res = await psicoAgent
      .put(`/api/menores/${menor._id}/profesionales`)
      .send({ profesionales: [String(otroPsico._id)] });
    expect(res.status).toBe(403);
  });
});
