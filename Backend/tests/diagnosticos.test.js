const request = require('supertest');
const Diagnostico = require('../src/models/Diagnostico');
const { ROLES } = require('../src/config/roles');
const {
  app,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

// Datos ficticios: los RUT son válidos según el dígito verificador pero no corresponden a nadie.
function datosMenor(cambios = {}) {
  return {
    nombre: 'Menor Ficticio Uno',
    rut: '12.345.678-5',
    fechaNacimiento: '2016-03-12',
    fechaIngreso: '2026-03-04',
    apoderado: { nombre: 'Apoderado Ficticio', parentesco: 'Madre', telefono: '+56 9 1234 5678' },
    antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
    ...cambios,
  };
}

function datosDiagnostico(cambios = {}) {
  return {
    tipo: 'Tipo de diagnóstico de prueba',
    fechaEvaluacion: '2026-10-01',
    instrumento: 'Instrumento de prueba',
    descripcion: 'Hallazgos ficticios para la prueba.',
    areasAfectadas: ['Lectura', 'Atención'],
    estado: 'vigente',
    ...cambios,
  };
}

let admin;
let adminAgent;
let psicoAgent;
let otroAgent;
let menor;
let otroMenor;

const ruta = (menorId = menor._id) => `/api/menores/${menorId}/diagnosticos`;

beforeEach(async () => {
  admin = await crearUsuario({ rol: ROLES.ADMIN });
  const psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  const otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
  otroAgent = await iniciarSesion(otroPsico.email);

  // Categorías creadas por el administrador, como en el uso real.
  for (const nombre of ['Tipo de diagnóstico de prueba', 'Tipo corregido']) {
    expect((await adminAgent.post('/api/tipos-diagnostico').send({ nombre })).status).toBe(201);
  }

  menor = (await psicoAgent.post('/api/menores').send(datosMenor())).body.menor;
  // Menor asignado solo al otro psicopedagogo.
  otroMenor = (
    await otroAgent
      .post('/api/menores')
      .send(datosMenor({ nombre: 'Menor Ficticio Dos', rut: '7.654.321-6' }))
  ).body.menor;
});

async function registrar(cambios, agent = psicoAgent, menorId = menor._id) {
  const res = await agent.post(ruta(menorId)).send(datosDiagnostico(cambios));
  expect(res.status).toBe(201);
  return res.body.diagnostico;
}

function editar(diagnostico, cambios, agent = psicoAgent) {
  return agent
    .patch(`${ruta()}/${diagnostico._id}`)
    .send({ ultimaActualizacion: diagnostico.updatedAt, ...cambios });
}

describe('Registro de diagnósticos (T07)', () => {
  test('el psicopedagogo asignado registra un diagnóstico vinculado al menor', async () => {
    const diagnostico = await registrar();

    expect(diagnostico).toMatchObject({
      tipo: 'Tipo de diagnóstico de prueba',
      estado: 'vigente',
      version: 1,
      areasAfectadas: ['Lectura', 'Atención'],
      menor: { _id: menor._id, nombre: 'Menor Ficticio Uno' },
    });
    const guardado = await Diagnostico.findById(diagnostico._id).lean();
    expect(String(guardado.menor)).toBe(menor._id);
    expect(guardado.fechaEvaluacion.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    // El diagnóstico no copia datos personales del menor.
    expect(guardado).not.toHaveProperty('rut');
    expect(guardado).not.toHaveProperty('nombre');
  });

  test('exige los campos obligatorios para guardar un diagnóstico vigente', async () => {
    const res = await psicoAgent
      .post(ruta())
      .send(datosDiagnostico({ tipo: '', descripcion: '  ', fechaEvaluacion: undefined }));

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.detalles).sort()).toEqual(['descripcion', 'fechaEvaluacion', 'tipo']);
    expect(await Diagnostico.countDocuments()).toBe(0);
  });

  test('sin estado se guarda como vigente y valida los obligatorios', async () => {
    const res = await psicoAgent.post(ruta()).send({ tipo: 'Tipo corregido' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('descripcion');
  });

  test('un borrador puede guardarse incompleto, pero no vacío', async () => {
    const borrador = await registrar({ estado: 'borrador', descripcion: '', fechaEvaluacion: '' });
    expect(borrador).toMatchObject({ estado: 'borrador', version: 0 });

    const vacio = await psicoAgent.post(ruta()).send({ estado: 'borrador' });
    expect(vacio.status).toBe(400);
  });

  test.each([
    ['fecha futura', { fechaEvaluacion: '2999-01-01' }, 'fechaEvaluacion'],
    ['fecha inexistente', { fechaEvaluacion: '2026-02-30' }, 'fechaEvaluacion'],
    ['tipo demasiado largo', { tipo: 'x'.repeat(151) }, 'tipo'],
    ['áreas que no son lista', { areasAfectadas: 'Lectura' }, 'areasAfectadas'],
    ['demasiadas áreas', { areasAfectadas: Array.from({ length: 11 }, (_, i) => `Área ${i}`) }, 'areasAfectadas'],
    ['estado desconocido', { estado: 'cerrado' }, 'estado'],
  ])('rechaza %s', async (_caso, cambios, campo) => {
    const res = await psicoAgent.post(ruta()).send(datosDiagnostico(cambios));
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty(campo);
  });

  test('elimina las áreas repetidas sin distinguir mayúsculas', async () => {
    const diagnostico = await registrar({ areasAfectadas: ['Lectura', ' lectura ', 'Cálculo'] });
    expect(diagnostico.areasAfectadas).toEqual(['Lectura', 'Cálculo']);
  });

  test('no permite registrar diagnósticos sin un menor válido', async () => {
    expect((await psicoAgent.post(ruta('no-es-un-id')).send(datosDiagnostico())).status).toBe(400);
    expect(
      (await psicoAgent.post(ruta('64b7f0c2a1b2c3d4e5f60718')).send(datosDiagnostico())).status
    ).toBe(404);
    // El menor no puede indicarse en el cuerpo para desviar el registro a otro expediente.
    const desviado = await psicoAgent
      .post(ruta())
      .send(datosDiagnostico({ menor: otroMenor._id }));
    expect(desviado.status).toBe(400);
    expect(await Diagnostico.countDocuments()).toBe(0);
  });

  test('registra la acción en la auditoría sin el contenido clínico', async () => {
    const diagnostico = await registrar();
    const [registro] = await buscarAuditoria({ accion: 'DIAGNOSTICO_CREADO' });

    expect(registro.recursoId).toBe(menor._id);
    expect(registro.detalle).toEqual({ diagnosticoId: diagnostico._id, estado: 'vigente', version: 1 });
    expect(JSON.stringify(registro)).not.toMatch(/Hallazgos|Tipo de diagnóstico de prueba/);
  });
});

describe('Consulta', () => {
  test('aparece en el listado del menor sin la descripción', async () => {
    const diagnostico = await registrar();
    const res = await psicoAgent.get(ruta());

    expect(res.status).toBe(200);
    expect(res.body.diagnosticos).toHaveLength(1);
    expect(res.body.diagnosticos[0]).toMatchObject({ _id: diagnostico._id, tipo: diagnostico.tipo });
    expect(res.body.diagnosticos[0]).not.toHaveProperty('descripcion');
  });

  test('el detalle devuelve toda la información y queda en la auditoría', async () => {
    const diagnostico = await registrar();
    const res = await psicoAgent.get(`${ruta()}/${diagnostico._id}`);

    expect(res.status).toBe(200);
    expect(res.body.diagnostico).toMatchObject({
      descripcion: 'Hallazgos ficticios para la prueba.',
      instrumento: 'Instrumento de prueba',
      versiones: [],
    });
    expect(res.body.diagnostico.actualizadoPor).toHaveProperty('nombre');
    expect(await buscarAuditoria({ accion: 'DIAGNOSTICO_CONSULTADO' })).toHaveLength(1);
  });

  test('los datos siguen disponibles en una nueva sesión', async () => {
    const diagnostico = await registrar();
    const { body } = await (await iniciarSesion(admin.email)).get(`${ruta()}/${diagnostico._id}`);
    expect(body.diagnostico).toMatchObject({ _id: diagnostico._id, tipo: diagnostico.tipo });
  });

  test('un diagnóstico de otro menor no se encuentra a través de este expediente', async () => {
    const ajeno = await registrar({}, otroAgent, otroMenor._id);
    expect((await adminAgent.get(`${ruta()}/${ajeno._id}`)).status).toBe(404);
    expect((await adminAgent.get(`${ruta()}/no-es-un-id`)).status).toBe(404);
  });

  test('el listado general muestra a cada psicopedagogo solo sus menores', async () => {
    await registrar();
    await registrar({ estado: 'borrador' });
    await registrar({}, otroAgent, otroMenor._id);

    const propio = await psicoAgent.get('/api/diagnosticos');
    expect(propio.body.total).toBe(2);
    expect(propio.body.diagnosticos.every((d) => d.menor.nombre === 'Menor Ficticio Uno')).toBe(true);
    expect(propio.body.diagnosticos[0]).not.toHaveProperty('descripcion');

    const todos = await adminAgent.get('/api/diagnosticos');
    expect(todos.body.total).toBe(3);

    const borradores = await psicoAgent.get('/api/diagnosticos?estado=borrador');
    expect(borradores.body.diagnosticos.map((d) => d.estado)).toEqual(['borrador']);
  });
});

describe('Edición y versiones', () => {
  test('editar un diagnóstico vigente crea una versión nueva y conserva la anterior', async () => {
    const diagnostico = await registrar();
    const res = await editar(diagnostico, { tipo: 'Tipo corregido', areasAfectadas: ['Lectura', 'Atención'] });

    expect(res.status).toBe(200);
    expect(res.body.campos).toEqual(['tipo']);
    expect(res.body.diagnostico).toMatchObject({ tipo: 'Tipo corregido', version: 2 });
    expect(res.body.diagnostico.versiones).toHaveLength(1);
    expect(res.body.diagnostico.versiones[0]).toMatchObject({
      version: 1,
      tipo: 'Tipo de diagnóstico de prueba',
      descripcion: 'Hallazgos ficticios para la prueba.',
    });
    expect(res.body.diagnostico.versiones[0].registradoPor).toHaveProperty('nombre');

    const [registro] = await buscarAuditoria({ accion: 'DIAGNOSTICO_ACTUALIZADO' });
    expect(registro.detalle).toMatchObject({ version: 2, campos: ['tipo'] });
    expect(JSON.stringify(registro)).not.toMatch(/Tipo corregido/);
  });

  test('sin cambios reales no crea versión', async () => {
    const diagnostico = await registrar();
    const res = await editar(diagnostico, { tipo: diagnostico.tipo, fechaEvaluacion: '2026-10-01' });

    expect(res.body.campos).toEqual([]);
    expect(res.body.diagnostico.version).toBe(1);
    expect(await buscarAuditoria({ accion: 'DIAGNOSTICO_ACTUALIZADO' })).toHaveLength(0);
  });

  test('el borrador se sobrescribe sin versiones y al publicarlo queda en v1', async () => {
    const borrador = await registrar({ estado: 'borrador', descripcion: '' });

    const editado = await editar(borrador, { instrumento: 'Otro instrumento' });
    expect(editado.body.diagnostico).toMatchObject({ estado: 'borrador', version: 0, versiones: [] });

    const incompleto = await editar(editado.body.diagnostico, { estado: 'vigente' });
    expect(incompleto.status).toBe(400);
    expect(incompleto.body.detalles).toHaveProperty('descripcion');

    const publicado = await editar(editado.body.diagnostico, {
      estado: 'vigente',
      descripcion: 'Hallazgos completos.',
    });
    expect(publicado.status).toBe(200);
    expect(publicado.body.diagnostico).toMatchObject({ estado: 'vigente', version: 1, versiones: [] });
  });

  test('un diagnóstico vigente no vuelve a borrador', async () => {
    const diagnostico = await registrar();
    const res = await editar(diagnostico, { estado: 'borrador' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('estado');
  });

  test('no sobrescribe cambios guardados por otra persona', async () => {
    const diagnostico = await registrar();
    expect((await editar(diagnostico, { instrumento: 'Primero' })).status).toBe(200);

    const tardio = await editar(diagnostico, { instrumento: 'Segundo' });
    expect(tardio.status).toBe(409);
    expect(tardio.body.codigo).toBe('DIAGNOSTICO_DESACTUALIZADO');

    const sinVersion = await psicoAgent
      .patch(`${ruta()}/${diagnostico._id}`)
      .send({ instrumento: 'Tercero' });
    expect(sinVersion.status).toBe(400);
    expect((await Diagnostico.findById(diagnostico._id)).instrumento).toBe('Primero');
  });

  test('valida los datos editados y rechaza campos no permitidos', async () => {
    const diagnostico = await registrar();
    expect((await editar(diagnostico, { descripcion: '' })).status).toBe(400);
    expect((await editar(diagnostico, { menor: otroMenor._id })).status).toBe(400);
    expect((await editar(diagnostico, { version: 9 })).status).toBe(400);
  });

  test('las ediciones aparecen en el historial del menor', async () => {
    const diagnostico = await registrar();
    await editar(diagnostico, { tipo: 'Tipo corregido' });

    const { body } = await psicoAgent.get(`/api/menores/${menor._id}/historial`);
    expect(body.historial.map((h) => h.accion)).toEqual([
      'DIAGNOSTICO_ACTUALIZADO',
      'DIAGNOSTICO_CREADO',
      'MENOR_CREADO',
    ]);
  });
});

describe('Control de acceso', () => {
  test('un usuario no autenticado recibe 401 en todos los endpoints', async () => {
    const diagnostico = await registrar();
    const rutas = [
      ['get', '/api/diagnosticos'],
      ['get', ruta()],
      ['post', ruta()],
      ['get', `${ruta()}/${diagnostico._id}`],
      ['patch', `${ruta()}/${diagnostico._id}`],
    ];
    for (const [metodo, url] of rutas) {
      expect((await request(app)[metodo](url)).status).toBe(401);
    }
  });

  test('el administrador consulta los diagnósticos pero no los registra ni edita', async () => {
    const diagnostico = await registrar();
    expect((await adminAgent.get(ruta())).status).toBe(200);
    expect((await adminAgent.get(`${ruta()}/${diagnostico._id}`)).status).toBe(200);
    expect((await adminAgent.post(ruta()).send(datosDiagnostico())).status).toBe(403);
    expect((await editar(diagnostico, { tipo: 'Cambio' }, adminAgent)).status).toBe(403);
    expect(await Diagnostico.countDocuments()).toBe(1);
  });

  test('un psicopedagogo no asignado no consulta ni modifica los diagnósticos del menor', async () => {
    const diagnostico = await registrar();
    const respuestas = await Promise.all([
      otroAgent.get(ruta()),
      otroAgent.get(`${ruta()}/${diagnostico._id}`),
      otroAgent.post(ruta()).send(datosDiagnostico()),
      editar(diagnostico, { tipo: 'Cambio' }, otroAgent),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect((await Diagnostico.findById(diagnostico._id)).tipo).toBe('Tipo de diagnóstico de prueba');
    expect(await buscarAuditoria({ accion: 'ACCESO_DENEGADO', recursoId: menor._id })).toHaveLength(4);
  });
});

describe('Tipo de diagnóstico: categorías del administrador y «Otro»', () => {
  test('el psicopedagogo usa una categoría creada por el administrador', async () => {
    expect(
      (await adminAgent.post('/api/tipos-diagnostico').send({ nombre: 'Categoría Nueva Ficticia' }))
        .status
    ).toBe(201);
    const tipos = (await psicoAgent.get('/api/tipos-diagnostico')).body.tipos.map((t) => t.nombre);
    expect(tipos).toContain('Categoría Nueva Ficticia');

    // Se guarda con el nombre exacto de la categoría.
    const diagnostico = await registrar({
      tipo: 'categoría nueva  ficticia',
      tipoPersonalizado: false,
    });
    expect(diagnostico).toMatchObject({ tipo: 'Categoría Nueva Ficticia', tipoPersonalizado: false });
    const guardado = await Diagnostico.findById(diagnostico._id).lean();
    expect(guardado).toMatchObject({ tipo: 'Categoría Nueva Ficticia', tipoPersonalizado: false });
  });

  test('«Otro» guarda el tipo ingresado y se visualiza al consultarlo después', async () => {
    const diagnostico = await registrar({ tipo: 'Tipo Personalizado Ficticio', tipoPersonalizado: true });
    expect(diagnostico).toMatchObject({ tipo: 'Tipo Personalizado Ficticio', tipoPersonalizado: true });

    const guardado = await Diagnostico.findById(diagnostico._id).lean();
    expect(guardado).toMatchObject({ tipo: 'Tipo Personalizado Ficticio', tipoPersonalizado: true });

    const res = await psicoAgent.get(`${ruta()}/${diagnostico._id}`);
    expect(res.body.diagnostico).toMatchObject({
      tipo: 'Tipo Personalizado Ficticio',
      tipoPersonalizado: true,
    });
    const listado = await psicoAgent.get(ruta());
    expect(listado.body.diagnosticos[0]).toMatchObject({ tipoPersonalizado: true });
    // El tipo personalizado no pasa a ser una categoría del administrador.
    const tipos = (await psicoAgent.get('/api/tipos-diagnostico')).body.tipos.map((t) => t.nombre);
    expect(tipos).not.toContain('Tipo Personalizado Ficticio');
  });

  test('un tipo que no es «Otro» debe ser una categoría activa', async () => {
    const noListado = await psicoAgent
      .post(ruta())
      .send(datosDiagnostico({ tipo: 'Tipo inexistente', tipoPersonalizado: false }));
    expect(noListado.status).toBe(400);
    expect(noListado.body.detalles.tipo).toMatch(/Otro/);

    const tipo = (await psicoAgent.get('/api/tipos-diagnostico')).body.tipos.find(
      (t) => t.nombre === 'Tipo corregido'
    );
    await adminAgent.patch(`/api/tipos-diagnostico/${tipo._id}`).send({ activo: false });
    const inactivo = await psicoAgent.post(ruta()).send(datosDiagnostico({ tipo: 'Tipo corregido' }));
    expect(inactivo.status).toBe(400);
    expect(await Diagnostico.countDocuments()).toBe(0);
  });

  test('«Otro» no puede repetir una categoría activa', async () => {
    const res = await psicoAgent
      .post(ruta())
      .send(datosDiagnostico({ tipo: 'tipo corregido', tipoPersonalizado: true }));
    expect(res.status).toBe(400);
    expect(res.body.detalles.tipo).toMatch(/ya está en la lista/);
  });

  test('tipoPersonalizado solo se acepta junto al tipo y debe ser booleano', async () => {
    const diagnostico = await registrar();
    expect((await editar(diagnostico, { tipoPersonalizado: true })).status).toBe(400);
    const res = await psicoAgent
      .post(ruta())
      .send(datosDiagnostico({ tipo: 'Tipo Libre', tipoPersonalizado: 'si' }));
    expect(res.status).toBe(400);
  });

  test('cambiar a «Otro» crea una versión que conserva el tipo anterior y su origen', async () => {
    const diagnostico = await registrar();
    const res = await editar(diagnostico, { tipo: 'Tipo Personalizado Ficticio', tipoPersonalizado: true });

    expect(res.status).toBe(200);
    expect(res.body.campos).toEqual(['tipo']);
    expect(res.body.diagnostico).toMatchObject({
      version: 2,
      tipo: 'Tipo Personalizado Ficticio',
      tipoPersonalizado: true,
    });
    expect(res.body.diagnostico.versiones[0]).toMatchObject({
      version: 1,
      tipo: 'Tipo de diagnóstico de prueba',
      tipoPersonalizado: false,
    });
  });

  test('un tipo cuya categoría se desactivó se conserva al editar otros campos', async () => {
    const diagnostico = await registrar();
    const tipo = (await psicoAgent.get('/api/tipos-diagnostico')).body.tipos.find(
      (t) => t.nombre === 'Tipo de diagnóstico de prueba'
    );
    await adminAgent.patch(`/api/tipos-diagnostico/${tipo._id}`).send({ activo: false });

    const res = await editar(diagnostico, { descripcion: 'Hallazgos ficticios corregidos.' });
    expect(res.status).toBe(200);
    expect(res.body.diagnostico).toMatchObject({ tipo: 'Tipo de diagnóstico de prueba', version: 2 });
  });
});
