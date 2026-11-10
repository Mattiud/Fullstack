const request = require('supertest');
const Sesion = require('../src/models/Sesion');
const { ROLES } = require('../src/config/roles');
const { hoyEnChile } = require('../src/utils/validators');
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

// Fecha AAAA-MM-DD a `dias` de hoy (hora de Chile).
function enDias(dias) {
  const fecha = new Date(`${hoyEnChile()}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function datosSesion(cambios = {}) {
  return {
    fecha: enDias(7),
    horaInicio: '09:00',
    horaFin: '09:45',
    objetivos: [{ descripcion: 'Objetivo ficticio uno' }, { descripcion: 'Objetivo ficticio dos' }],
    actividades: ['Actividad ficticia A', 'Actividad ficticia B'],
    ...cambios,
  };
}

let adminAgent;
let psico;
let otroPsico;
let psicoAgent;
let otroAgent;
let menor;
let otroMenor;

const ruta = (menorId = menor._id) => `/api/menores/${menorId}/sesiones`;

beforeEach(async () => {
  const admin = await crearUsuario({ rol: ROLES.ADMIN });
  psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
  otroAgent = await iniciarSesion(otroPsico.email);

  expect(
    (await adminAgent.post('/api/tipos-diagnostico').send({ nombre: 'Tipo de prueba' })).status
  ).toBe(201);

  menor = (await psicoAgent.post('/api/menores').send(datosMenor())).body.menor;
  // Menor asignado solo al otro psicopedagogo.
  otroMenor = (
    await otroAgent
      .post('/api/menores')
      .send(datosMenor({ nombre: 'Menor Ficticio Dos', rut: '7.654.321-6' }))
  ).body.menor;
});

async function registrar(cambios, agent = psicoAgent, menorId = menor._id) {
  const res = await agent.post(ruta(menorId)).send(datosSesion(cambios));
  expect(res.status).toBe(201);
  return res.body.sesion;
}

function editar(sesion, cambios, agent = psicoAgent) {
  return agent
    .patch(`${ruta()}/${sesion._id}`)
    .send({ ultimaActualizacion: sesion.updatedAt, ...cambios });
}

async function registrarDiagnostico(cambios = {}, agent = psicoAgent, menorId = menor._id) {
  const res = await agent.post(`/api/menores/${menorId}/diagnosticos`).send({
    tipo: 'Tipo de prueba',
    fechaEvaluacion: '2026-10-01',
    descripcion: 'Hallazgos ficticios.',
    estado: 'vigente',
    ...cambios,
  });
  expect(res.status).toBe(201);
  return res.body.diagnostico;
}

describe('Registro de planificaciones (T08)', () => {
  test('el psicopedagogo asignado registra una sesión vinculada al menor', async () => {
    const sesion = await registrar();

    expect(sesion).toMatchObject({
      estado: 'planificada',
      horaInicio: '09:00',
      horaFin: '09:45',
      numero: 1,
      menor: { _id: menor._id, nombre: 'Menor Ficticio Uno' },
      profesional: { _id: String(psico._id) },
      actividades: ['Actividad ficticia A', 'Actividad ficticia B'],
    });
    const guardada = await Sesion.findById(sesion._id).lean();
    expect(String(guardada.menor)).toBe(menor._id);
    expect(String(guardada.profesional)).toBe(String(psico._id));
    expect(guardada.fecha.toISOString()).toBe(`${enDias(7)}T00:00:00.000Z`);
    expect(guardada.objetivos.map((o) => o.descripcion)).toEqual([
      'Objetivo ficticio uno',
      'Objetivo ficticio dos',
    ]);
    // La sesión no copia datos personales del menor.
    expect(guardada).not.toHaveProperty('rut');
    expect(guardada).not.toHaveProperty('nombre');
  });

  test('exige fecha, horario, objetivos y actividades para quedar planificada', async () => {
    const res = await psicoAgent.post(ruta()).send({ estado: 'planificada' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.detalles).sort()).toEqual([
      'actividades',
      'fecha',
      'horaFin',
      'horaInicio',
      'objetivos',
    ]);
    expect(await Sesion.countDocuments()).toBe(0);
  });

  test('un borrador puede guardarse incompleto, pero no vacío', async () => {
    const res = await psicoAgent
      .post(ruta())
      .send({ estado: 'borrador', objetivos: [{ descripcion: 'Idea inicial' }] });
    expect(res.status).toBe(201);
    expect(res.body.sesion).toMatchObject({ estado: 'borrador', numero: null });

    const vacio = await psicoAgent.post(ruta()).send({ estado: 'borrador', objetivos: [] });
    expect(vacio.status).toBe(400);
    expect(await Sesion.countDocuments()).toBe(1);
  });

  test('valida el formato de fecha y horas y que el término sea posterior al inicio', async () => {
    const formato = await psicoAgent
      .post(ruta())
      .send(datosSesion({ fecha: '31/12/2026', horaInicio: '9:00', horaFin: '25:00' }));
    expect(formato.status).toBe(400);
    expect(Object.keys(formato.body.detalles).sort()).toEqual(['fecha', 'horaFin', 'horaInicio']);

    const orden = await psicoAgent
      .post(ruta())
      .send(datosSesion({ horaInicio: '10:00', horaFin: '09:30' }));
    expect(orden.status).toBe(400);
    expect(orden.body.detalles).toEqual({
      horaFin: 'La hora de término debe ser posterior a la de inicio',
    });
  });

  test('rechaza objetivos o actividades vacíos y campos no permitidos', async () => {
    const vacios = await psicoAgent
      .post(ruta())
      .send(datosSesion({ objetivos: [{ descripcion: '  ' }], actividades: [''] }));
    expect(vacios.status).toBe(400);
    expect(Object.keys(vacios.body.detalles).sort()).toEqual(['actividades', 'objetivos']);

    expect((await psicoAgent.post(ruta()).send(datosSesion({ menor: otroMenor._id }))).status).toBe(
      400
    );
    expect(
      (await psicoAgent.post(ruta()).send(datosSesion({ profesional: otroMenor._id }))).status
    ).toBe(400);
    expect(await Sesion.countDocuments()).toBe(0);
  });

  test('registra la acción en la auditoría sin el contenido de la sesión', async () => {
    const sesion = await registrar();
    const [registro] = await buscarAuditoria({ accion: 'SESION_CREADA' });

    expect(registro.recursoId).toBe(menor._id);
    expect(registro.detalle).toEqual({ sesionId: sesion._id, estado: 'planificada' });
    expect(JSON.stringify(registro)).not.toContain('Objetivo ficticio');
  });
});

describe('Relación con los diagnósticos', () => {
  test('asocia un diagnóstico vigente del menor y conserva su versión', async () => {
    const diagnostico = await registrarDiagnostico();
    const sesion = await registrar({ diagnostico: diagnostico._id });

    expect(sesion.diagnostico).toMatchObject({ _id: diagnostico._id, tipo: 'Tipo de prueba' });
    expect(sesion.diagnosticoVersion).toBe(1);

    // Una nueva versión del diagnóstico no altera la versión asociada a la sesión.
    await psicoAgent
      .patch(`/api/menores/${menor._id}/diagnosticos/${diagnostico._id}`)
      .send({ ultimaActualizacion: diagnostico.updatedAt, descripcion: 'Hallazgos v2.' });
    const { body } = await psicoAgent.get(`${ruta()}/${sesion._id}`);
    expect(body.sesion.diagnosticoVersion).toBe(1);
    expect(body.sesion.diagnostico.version).toBe(2);
  });

  test('rechaza diagnósticos en borrador, de otro menor o inexistentes', async () => {
    const borrador = await registrarDiagnostico({ estado: 'borrador', descripcion: '' });
    const ajeno = await registrarDiagnostico({}, otroAgent, otroMenor._id);

    for (const diagnostico of [borrador._id, ajeno._id, '64b000000000000000000000', 'abc']) {
      const res = await psicoAgent.post(ruta()).send(datosSesion({ diagnostico }));
      expect(res.status).toBe(400);
      expect(res.body.detalles).toHaveProperty('diagnostico');
    }
    expect(await Sesion.countDocuments()).toBe(0);
  });

  test('permite quitar el diagnóstico asociado', async () => {
    const diagnostico = await registrarDiagnostico();
    const sesion = await registrar({ diagnostico: diagnostico._id });

    const res = await editar(sesion, { diagnostico: null });
    expect(res.status).toBe(200);
    expect(res.body.campos).toEqual(['diagnostico']);
    const guardada = await Sesion.findById(sesion._id).lean();
    expect(guardada.diagnostico).toBeUndefined();
    expect(guardada.diagnosticoVersion).toBeUndefined();
  });
});

describe('Registro post-sesión', () => {
  test('no se completa antes de la fecha de la sesión', async () => {
    const res = await psicoAgent
      .post(ruta())
      .send(datosSesion({ asistencia: 'asistio', observaciones: 'Observación ficticia.' }));
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('registroPostSesion');

    const sesion = await registrar();
    const logro = await editar(sesion, {
      objetivos: [{ descripcion: 'Objetivo ficticio uno', logrado: true }],
    });
    expect(logro.status).toBe(400);
  });

  test('se registra desde el día de la sesión, con asistencia y logro de objetivos', async () => {
    const sesion = await registrar({ fecha: enDias(0) });
    const res = await editar(sesion, {
      asistencia: 'asistio',
      observaciones: 'Observación ficticia.',
      objetivos: [
        { descripcion: 'Objetivo ficticio uno', logrado: true },
        { descripcion: 'Objetivo ficticio dos', logrado: false },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.campos.sort()).toEqual(['asistencia', 'logroObjetivos', 'observaciones']);
    expect(res.body.sesion).toMatchObject({ asistencia: 'asistio', observaciones: 'Observación ficticia.' });

    const { body } = await psicoAgent.get(ruta());
    expect(body.sesiones[0]).toMatchObject({ totalObjetivos: 2, objetivosLogrados: 1 });
  });

  test('una sesión con registro post-sesión no se traslada a una fecha futura', async () => {
    const sesion = await registrar({ fecha: enDias(-1) });
    const conRegistro = (await editar(sesion, { asistencia: 'reagendada' })).body.sesion;

    const res = await editar(conRegistro, { fecha: enDias(3) });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('fecha');
  });

  test('un borrador no admite registro post-sesión', async () => {
    const res = await psicoAgent
      .post(ruta())
      .send({ estado: 'borrador', fecha: enDias(-1), asistencia: 'asistio' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('registroPostSesion');
  });

  test('rechaza valores de asistencia no definidos', async () => {
    const sesion = await registrar({ fecha: enDias(-1) });
    expect((await editar(sesion, { asistencia: 'atrasado' })).status).toBe(400);
  });
});

describe('Consulta', () => {
  test('el listado del menor no incluye el contenido y numera en orden cronológico', async () => {
    await registrar({ fecha: enDias(-14) });
    await registrar({ fecha: enDias(-7), observaciones: 'Observación ficticia.' });
    await registrar({ fecha: enDias(7) });
    await psicoAgent.post(ruta()).send({ estado: 'borrador', horaInicio: '10:00' });

    const { status, body } = await psicoAgent.get(ruta());
    expect(status).toBe(200);
    expect(body.sesiones.map((s) => [s.estado, s.numero])).toEqual([
      ['borrador', null],
      ['planificada', 3],
      ['planificada', 2],
      ['planificada', 1],
    ]);
    for (const sesion of body.sesiones) {
      expect(sesion).not.toHaveProperty('observaciones');
      expect(sesion).not.toHaveProperty('objetivos');
      expect(sesion).not.toHaveProperty('actividades');
    }
  });

  test('el detalle incluye la sesión anterior y queda en la auditoría', async () => {
    const primera = await registrar({ fecha: enDias(-7) });
    await editar(primera, {
      observaciones: 'Observación previa ficticia.',
      objetivos: [{ descripcion: 'Objetivo ficticio uno', logrado: true }],
    });
    const segunda = await registrar({ fecha: enDias(2) });

    const { body } = await psicoAgent.get(`${ruta()}/${segunda._id}`);
    expect(body.sesion.numero).toBe(2);
    expect(body.anterior).toMatchObject({
      _id: primera._id,
      observaciones: 'Observación previa ficticia.',
      totalObjetivos: 1,
      objetivosLogrados: 1,
    });
    expect(await buscarAuditoria({ accion: 'SESION_CONSULTADA' })).toHaveLength(1);

    const contexto = await psicoAgent.get(`${ruta()}/contexto`);
    expect(contexto.status).toBe(200);
    expect(contexto.body.anterior._id).toBe(primera._id);
  });

  test('los datos siguen disponibles en una nueva sesión de usuario', async () => {
    const sesion = await registrar();
    const nuevoAgente = await iniciarSesion(psico.email);
    const { body } = await nuevoAgente.get(`${ruta()}/${sesion._id}`);
    expect(body.sesion.objetivos).toHaveLength(2);
  });

  test('una sesión de otro menor no se encuentra a través de este expediente', async () => {
    const ajena = await registrar({}, otroAgent, otroMenor._id);
    expect((await psicoAgent.get(`${ruta()}/${ajena._id}`)).status).toBe(404);
  });

  test('la agenda general muestra solo las sesiones de los menores accesibles, en orden', async () => {
    await registrar({ fecha: enDias(5), horaInicio: '11:00', horaFin: '11:45' });
    await registrar({ fecha: enDias(5), horaInicio: '09:00', horaFin: '09:45' });
    await registrar({ fecha: enDias(1) });
    await registrar({ fecha: enDias(-3) });
    await registrar({}, otroAgent, otroMenor._id);

    const proximas = (await psicoAgent.get('/api/sesiones')).body;
    expect(proximas.total).toBe(3);
    expect(proximas.sesiones.map((s) => [s.fecha.slice(0, 10), s.horaInicio])).toEqual([
      [enDias(1), '09:00'],
      [enDias(5), '09:00'],
      [enDias(5), '11:00'],
    ]);
    expect(proximas.sesiones[0]).not.toHaveProperty('objetivos');

    const anteriores = (await psicoAgent.get('/api/sesiones?vista=anteriores')).body;
    expect(anteriores.sesiones.map((s) => s.fecha.slice(0, 10))).toEqual([enDias(-3)]);

    // El administrador ve las de todos los menores.
    expect((await adminAgent.get('/api/sesiones')).body.total).toBe(4);
  });

  test('el filtro «Solo mis sesiones» muestra las del profesional responsable', async () => {
    await registrar();
    await adminAgent
      .put(`/api/menores/${menor._id}/profesionales`)
      .send({ profesionales: [String(psico._id), String(otroPsico._id)] });
    await registrar({ fecha: enDias(8) }, otroAgent);

    expect((await psicoAgent.get('/api/sesiones')).body.total).toBe(2);
    const mias = (await psicoAgent.get('/api/sesiones?mias=true')).body;
    expect(mias.total).toBe(1);
    expect(mias.sesiones[0].profesional._id).toBe(String(psico._id));
  });
});

describe('Edición', () => {
  test('actualiza los campos y registra solo sus nombres en el historial', async () => {
    const sesion = await registrar();
    const res = await editar(sesion, { horaInicio: '08:30', actividades: ['Actividad nueva'] });

    expect(res.status).toBe(200);
    expect(res.body.campos.sort()).toEqual(['actividades', 'horaInicio']);
    const { body } = await psicoAgent.get(`/api/menores/${menor._id}/historial`);
    expect(body.historial.map((h) => h.accion)).toEqual([
      'SESION_ACTUALIZADA',
      'SESION_CREADA',
      'MENOR_CREADO',
    ]);
    expect(body.historial[0].detalle.campos.sort()).toEqual(['actividades', 'horaInicio']);
  });

  test('sin cambios reales no registra una modificación', async () => {
    const sesion = await registrar();
    const res = await editar(sesion, { horaInicio: '09:00' });
    expect(res.body.campos).toEqual([]);
    expect(await buscarAuditoria({ accion: 'SESION_ACTUALIZADA' })).toHaveLength(0);
  });

  test('un borrador se completa y pasa a planificada, pero no vuelve a borrador', async () => {
    const borrador = (
      await psicoAgent.post(ruta()).send({ estado: 'borrador', horaInicio: '10:00' })
    ).body.sesion;

    expect((await editar(borrador, { estado: 'planificada' })).status).toBe(400);
    const res = await editar(borrador, { ...datosSesion({ horaInicio: '10:00', horaFin: '10:45' }), estado: 'planificada' });
    expect(res.status).toBe(200);
    expect(res.body.sesion).toMatchObject({ estado: 'planificada', numero: 1 });
    const [publicacion] = await buscarAuditoria({ accion: 'SESION_ACTUALIZADA' });
    expect(publicacion.detalle).toMatchObject({ estado: 'planificada', publicada: true });

    const vuelta = await editar(res.body.sesion, { estado: 'borrador' });
    expect(vuelta.status).toBe(400);
    expect(vuelta.body.detalles).toHaveProperty('estado');
  });

  test('no sobrescribe cambios guardados por otra persona', async () => {
    const sesion = await registrar();
    expect((await editar(sesion, { horaFin: '10:00' })).status).toBe(200);

    const tardio = await editar(sesion, { horaFin: '10:30' });
    expect(tardio.status).toBe(409);
    expect(tardio.body.codigo).toBe('SESION_DESACTUALIZADA');

    const sinVersion = await psicoAgent.patch(`${ruta()}/${sesion._id}`).send({ horaFin: '11:00' });
    expect(sinVersion.status).toBe(400);
    expect((await Sesion.findById(sesion._id)).horaFin).toBe('10:00');
  });
});

describe('Control de acceso', () => {
  test('un usuario no autenticado recibe 401 en todos los endpoints', async () => {
    const sesion = await registrar();
    const rutas = [
      ['get', '/api/sesiones'],
      ['get', ruta()],
      ['get', `${ruta()}/contexto`],
      ['post', ruta()],
      ['get', `${ruta()}/${sesion._id}`],
      ['patch', `${ruta()}/${sesion._id}`],
    ];
    for (const [metodo, url] of rutas) {
      expect((await request(app)[metodo](url)).status).toBe(401);
    }
  });

  test('el administrador consulta las sesiones pero no las registra ni edita', async () => {
    const sesion = await registrar();
    expect((await adminAgent.get(ruta())).status).toBe(200);
    expect((await adminAgent.get(`${ruta()}/${sesion._id}`)).status).toBe(200);
    expect((await adminAgent.post(ruta()).send(datosSesion())).status).toBe(403);
    expect((await editar(sesion, { horaFin: '10:00' }, adminAgent)).status).toBe(403);
    expect(await Sesion.countDocuments()).toBe(1);
  });

  test('un psicopedagogo no asignado no consulta ni modifica las sesiones del menor', async () => {
    const sesion = await registrar();
    const respuestas = await Promise.all([
      otroAgent.get(ruta()),
      otroAgent.get(`${ruta()}/contexto`),
      otroAgent.get(`${ruta()}/${sesion._id}`),
      otroAgent.post(ruta()).send(datosSesion()),
      editar(sesion, { horaFin: '10:00' }, otroAgent),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect((await Sesion.findById(sesion._id)).horaFin).toBe('09:45');
    expect(await Sesion.countDocuments()).toBe(1);
  });
});

describe('Calendario', () => {
  const calendario = (agent, consulta) =>
    agent.get('/api/sesiones/calendario').query(consulta);

  test('devuelve las sesiones del período en orden, una vez cada una y sin contenido', async () => {
    await registrar({ fecha: enDias(2), horaInicio: '11:00', horaFin: '11:45' });
    const primera = await registrar({
      fecha: enDias(2),
      horaInicio: '09:00',
      horaFin: '09:45',
    });
    await registrar({ fecha: enDias(1) });
    await registrar({ fecha: enDias(20) });

    const res = await calendario(psicoAgent, { desde: enDias(0), hasta: enDias(6) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ desde: enDias(0), hasta: enDias(6) });
    expect(res.body.sesiones.map((s) => [s.fecha.slice(0, 10), s.horaInicio])).toEqual([
      [enDias(1), '09:00'],
      [enDias(2), '09:00'],
      [enDias(2), '11:00'],
    ]);
    const ids = res.body.sesiones.map((s) => s._id);
    expect(new Set(ids).size).toBe(ids.length);

    const bloque = res.body.sesiones.find((s) => s._id === primera._id);
    expect(bloque).toMatchObject({
      menor: { _id: menor._id, nombre: 'Menor Ficticio Uno' },
      profesional: { _id: String(psico._id) },
      primerObjetivo: 'Objetivo ficticio uno',
      totalObjetivos: 2,
      totalActividades: 2,
      estado: 'planificada',
    });
    expect(bloque).not.toHaveProperty('objetivos');
    expect(bloque).not.toHaveProperty('actividades');
    expect(bloque).not.toHaveProperty('observaciones');
  });

  test('incluye los borradores con fecha y el filtro «Sin planificar» muestra solo esos', async () => {
    await registrar({ fecha: enDias(1) });
    await psicoAgent.post(ruta()).send({ estado: 'borrador', fecha: enDias(2) });
    // Sin fecha no se puede ubicar en el calendario.
    await psicoAgent.post(ruta()).send({ estado: 'borrador', horaInicio: '10:00' });

    const todos = await calendario(psicoAgent, { desde: enDias(0), hasta: enDias(6) });
    expect(todos.body.sesiones.map((s) => s.estado)).toEqual(['planificada', 'borrador']);

    const borradores = await calendario(psicoAgent, {
      desde: enDias(0),
      hasta: enDias(6),
      borradores: 'true',
    });
    expect(borradores.body.sesiones.map((s) => s.estado)).toEqual(['borrador']);
  });

  test('muestra a cada psicopedagogo solo sus menores y al administrador todos', async () => {
    await registrar({ fecha: enDias(1) });
    await registrar({ fecha: enDias(1) }, otroAgent, otroMenor._id);
    const periodo = { desde: enDias(0), hasta: enDias(6) };

    expect((await calendario(psicoAgent, periodo)).body.sesiones).toHaveLength(1);
    expect((await calendario(otroAgent, periodo)).body.sesiones).toHaveLength(1);
    expect((await calendario(adminAgent, periodo)).body.sesiones).toHaveLength(2);
  });

  test('filtra por menor y por profesional responsable', async () => {
    await adminAgent
      .put(`/api/menores/${menor._id}/profesionales`)
      .send({ profesionales: [String(psico._id), String(otroPsico._id)] });
    await registrar({ fecha: enDias(1) });
    await registrar({ fecha: enDias(2) }, otroAgent);
    await registrar({ fecha: enDias(3) }, otroAgent, otroMenor._id);
    const periodo = { desde: enDias(0), hasta: enDias(6) };

    const delMenor = await calendario(otroAgent, { ...periodo, menor: menor._id });
    expect(delMenor.body.sesiones).toHaveLength(2);
    expect(delMenor.body.sesiones.every((s) => s.menor._id === menor._id)).toBe(true);

    const mias = await calendario(psicoAgent, { ...periodo, mias: 'true' });
    expect(mias.body.sesiones).toHaveLength(1);
    expect(mias.body.sesiones[0].profesional._id).toBe(String(psico._id));
  });

  test('no permite filtrar por un menor no asignado', async () => {
    await registrar({ fecha: enDias(1) }, otroAgent, otroMenor._id);
    const periodo = { desde: enDias(0), hasta: enDias(6) };

    const ajeno = await calendario(psicoAgent, { ...periodo, menor: otroMenor._id });
    expect(ajeno.status).toBe(403);
    expect(ajeno.body).not.toHaveProperty('sesiones');
    expect(
      await buscarAuditoria({ accion: 'ACCESO_DENEGADO', recursoId: otroMenor._id })
    ).toHaveLength(1);
    expect((await calendario(psicoAgent, { ...periodo, menor: 'abc' })).status).toBe(400);
    expect(
      (await calendario(psicoAgent, { ...periodo, menor: '64b000000000000000000000' })).status
    ).toBe(404);
  });

  test('valida el período', async () => {
    const casos = [
      {},
      { desde: enDias(0) },
      { desde: '02/11/2026', hasta: enDias(6) },
      { desde: enDias(6), hasta: enDias(0) },
      { desde: enDias(0), hasta: enDias(42) },
    ];
    for (const consulta of casos) {
      expect((await calendario(psicoAgent, consulta)).status).toBe(400);
    }
    expect((await calendario(psicoAgent, { desde: enDias(0), hasta: enDias(41) })).status).toBe(
      200
    );
  });

  test('una sesión editada aparece en su nueva fecha y no en la anterior', async () => {
    const sesion = await registrar({ fecha: enDias(1) });
    expect((await editar(sesion, { fecha: enDias(10) })).status).toBe(200);

    const antes = await calendario(psicoAgent, { desde: enDias(0), hasta: enDias(6) });
    const despues = await calendario(psicoAgent, { desde: enDias(7), hasta: enDias(13) });
    expect(antes.body.sesiones).toHaveLength(0);
    expect(despues.body.sesiones.map((s) => s._id)).toEqual([sesion._id]);
  });

  test('requiere una sesión iniciada', async () => {
    const res = await request(app)
      .get('/api/sesiones/calendario')
      .query({ desde: enDias(0), hasta: enDias(6) });
    expect(res.status).toBe(401);
  });
});
