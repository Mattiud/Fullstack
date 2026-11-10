const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const Informe = require('../src/models/Informe');
const { ROLES } = require('../src/config/roles');
const { edadCronologica, formatearEdadCronologica } = require('../src/utils/validators');
const {
  app,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');
const { crearPng } = require('./imagenes');
const { textoDelPdf, totalPaginas, tieneImagen, dimensionesImagenes } = require('./pdf');

usarBaseDeDatosDePrueba();

// Datos ficticios: los RUT son válidos según el dígito verificador pero no corresponden a nadie.
function datosMenor(cambios = {}) {
  return {
    nombre: 'Menor Ficticio Uno',
    rut: '12.345.678-5',
    fechaNacimiento: '2016-03-12',
    fechaIngreso: '2026-03-04',
    curso: '4° básico',
    establecimiento: 'Escuela Ficticia',
    apoderado: { nombre: 'Apoderado Ficticio', parentesco: 'Madre', telefono: '+56 9 1234 5678' },
    antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
    ...cambios,
  };
}

const TABLA_FICTICIA = {
  titulo: 'Tabla ficticia de resultados',
  descripcion: 'Descripción ficticia de la tabla.',
  columnas: ['Área de evaluación', 'Total de ítems', 'Logrados', '% de logro'],
  filas: [
    ['Área ficticia A', '10', '7', '70%'],
    ['Área ficticia B', '12', '6', '50%'],
  ],
};

const AREA_FICTICIA = {
  titulo: 'Área ficticia de lenguaje',
  apartados: [
    {
      titulo: 'Comprensión',
      texto: 'Observación ficticia.\n- Fortaleza ficticia.\n- Dificultad ficticia.',
    },
    { titulo: '', texto: '1. Primer punto ficticio.\n2. Segundo punto ficticio.' },
  ],
};

const CONTENIDO_COMPLETO = {
  fechaInforme: '2026-11-02',
  curso: '4° básico',
  establecimiento: 'Escuela Ficticia',
  antecedentesRelevantes: 'Antecedentes ficticios.\nSegundo párrafo ficticio.',
  motivoConsulta: 'Derivación y motivo ficticios.',
  instrumentoEvaluativo: 'Instrumento ficticio.',
  areasEvaluacion: '- Área ficticia A\n- Área ficticia B',
  analisisCuantitativo: 'Comentario general ficticio.',
  tablasCuantitativas: [TABLA_FICTICIA],
  objetivoEvaluacion: 'Objetivo ficticio de la evaluación.',
  areasCualitativas: [AREA_FICTICIA],
  conclusion: 'Conclusión ficticia.',
  sugerencias: {
    familia: 'Sugerencia ficticia para la familia.',
    escuela: '- Sugerencia ficticia para la escuela.',
    nino: 'Sugerencia ficticia para el niño.',
  },
};

let psico;
let adminAgent;
let psicoAgent;
let otroAgent;
let menor;
let otroMenor;

const ruta = (menorId = menor._id) => `/api/menores/${menorId}/informes`;

beforeEach(async () => {
  const admin = await crearUsuario({ rol: ROLES.ADMIN });
  psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  const otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
  otroAgent = await iniciarSesion(otroPsico.email);

  // Al registrar un menor, el psicopedagogo queda asignado a él.
  menor = (await psicoAgent.post('/api/menores').send(datosMenor())).body.menor;
  otroMenor = (
    await otroAgent
      .post('/api/menores')
      .send(datosMenor({ nombre: 'Menor Ficticio Dos', rut: '7.654.321-6' }))
  ).body.menor;
});

async function crear(datos = { fechaInforme: '2026-11-02' }, agent = psicoAgent) {
  const res = await agent.post(ruta()).send(datos);
  expect(res.status).toBe(201);
  return res.body.informe;
}

function editar(informe, cambios, agent = psicoAgent) {
  return agent
    .patch(`${ruta()}/${informe._id}`)
    .send({ ...cambios, ultimaActualizacion: informe.updatedAt });
}

function generar(informe, agent = psicoAgent) {
  return agent
    .post(`${ruta()}/${informe._id}/pdf`)
    .send({ ultimaActualizacion: informe.updatedAt });
}

// Supertest no convierte los PDF: se reciben como Buffer.
function comoBuffer(res, callback) {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
}

function descargarPdf(informe, version, agent = psicoAgent, query = '') {
  return agent
    .get(`${ruta()}/${informe._id}/pdfs/${version}${query}`)
    .buffer(true)
    .parse(comoBuffer);
}

async function textoDeVersion(informe, version = 1) {
  const res = await descargarPdf(informe, version);
  expect(res.status).toBe(200);
  return textoDelPdf(res.body);
}

const hash = (contenido) => crypto.createHash('sha256').update(contenido).digest('hex');

describe('Edad cronológica', () => {
  const fecha = (texto) => new Date(`${texto}T00:00:00.000Z`);

  test.each([
    ['2016-03-12', '2026-11-02', { anios: 10, meses: 7 }, '10 años y 7 meses'],
    ['2016-03-12', '2026-03-12', { anios: 10, meses: 0 }, '10 años'],
    ['2016-03-12', '2026-03-11', { anios: 9, meses: 11 }, '9 años y 11 meses'],
    ['2025-10-20', '2026-11-19', { anios: 1, meses: 0 }, '1 año'],
    ['2025-10-20', '2026-11-20', { anios: 1, meses: 1 }, '1 año y 1 mes'],
    ['2026-05-01', '2026-11-02', { anios: 0, meses: 6 }, '6 meses'],
    // Nacimiento el 29 de febrero: en años no bisiestos cumple el 28.
    ['2016-02-29', '2026-02-28', { anios: 10, meses: 0 }, '10 años'],
    ['2016-01-31', '2016-02-29', { anios: 0, meses: 1 }, '1 mes'],
  ])('de %s a %s', (nacimiento, referencia, esperado, texto) => {
    const edad = edadCronologica(fecha(nacimiento), fecha(referencia));
    expect(edad).toEqual(esperado);
    expect(formatearEdadCronologica(edad)).toBe(texto);
  });

  test('no hay edad antes del nacimiento', () => {
    expect(edadCronologica(fecha('2026-05-01'), fecha('2026-04-30'))).toBeNull();
  });
});

describe('Permisos', () => {
  test('el administrador no accede a ningún informe', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const respuestas = await Promise.all([
      adminAgent.get('/api/informes'),
      adminAgent.get(ruta()),
      adminAgent.post(ruta()).send({ fechaInforme: '2026-11-02' }),
      adminAgent.get(`${ruta()}/${informe._id}`),
      adminAgent.patch(`${ruta()}/${informe._id}`).send({ conclusion: 'x' }),
      adminAgent.post(`${ruta()}/vista-previa`).send({}),
      adminAgent.post(`${ruta()}/${informe._id}/pdf`).send({}),
      adminAgent.get(`${ruta()}/${informe._id}/pdfs/1`),
      adminAgent.put('/api/auth/datos-profesionales').send({ registro: '1' }),
    ]);
    for (const res of respuestas) expect(res.status).toBe(403);
    expect(await buscarAuditoria({ accion: 'ACCESO_DENEGADO' })).toHaveLength(respuestas.length);
  });

  test('un psicopedagogo no asignado al menor no accede a sus informes', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const respuestas = await Promise.all([
      otroAgent.get(ruta()),
      otroAgent.post(ruta()).send({ fechaInforme: '2026-11-02' }),
      otroAgent.get(`${ruta()}/${informe._id}`),
      otroAgent.patch(`${ruta()}/${informe._id}`).send({ conclusion: 'x' }),
      otroAgent.post(`${ruta()}/vista-previa`).send({}),
      otroAgent.post(`${ruta()}/${informe._id}/pdf`).send({}),
      otroAgent.get(`${ruta()}/${informe._id}/pdfs/1`),
    ]);
    for (const res of respuestas) expect(res.status).toBe(403);
    expect(await Informe.countDocuments()).toBe(1);
  });

  test('un informe de otro menor responde 404', async () => {
    const informe = await crear();
    const ajeno = await otroAgent.get(`/api/menores/${otroMenor._id}/informes/${informe._id}`);
    expect(ajeno.status).toBe(404);
  });

  test('un usuario no autenticado recibe 401', async () => {
    expect((await request(app).get('/api/informes')).status).toBe(401);
    expect((await request(app).get(ruta())).status).toBe(401);
    expect((await request(app).post(ruta()).send({})).status).toBe(401);
    expect((await request(app).put('/api/auth/datos-profesionales').send({})).status).toBe(401);
  });

  test('el listado general solo incluye los menores accesibles y no los textos', async () => {
    await crear(CONTENIDO_COMPLETO);
    await otroAgent
      .post(`/api/menores/${otroMenor._id}/informes`)
      .send({ fechaInforme: '2026-11-01' });

    const propios = await psicoAgent.get('/api/informes');
    expect(propios.status).toBe(200);
    expect(propios.body.total).toBe(1);
    const [informe] = propios.body.informes;
    expect(informe.menor).toMatchObject({ nombre: 'Menor Ficticio Uno' });
    expect(informe.creadoPor).toMatchObject({ nombre: psico.nombre });
    expect(informe).toMatchObject({ ultimoPdf: null, pdfDesactualizado: false });
    for (const campo of ['conclusion', 'tablasCuantitativas', 'areasCualitativas', 'pdfs']) {
      expect(informe).not.toHaveProperty(campo);
    }
  });
});

describe('Registro y edición', () => {
  test('guarda un borrador incompleto asociado al menor y al profesional', async () => {
    const informe = await crear({ fechaInforme: '2026-11-02', motivoConsulta: '  Motivo  ' });
    expect(informe).toMatchObject({
      motivoConsulta: 'Motivo',
      menor: { _id: menor._id, nombre: 'Menor Ficticio Uno' },
      creadoPor: { nombre: psico.nombre },
      actualizadoPor: { nombre: psico.nombre },
      tablasCuantitativas: [],
      areasCualitativas: [],
      pdfs: [],
      ultimoPdf: null,
    });
    expect(informe.fechaInforme).toBe('2026-11-02T00:00:00.000Z');
    // Nombre y fecha de nacimiento no se duplican en el informe.
    const guardado = await Informe.findById(informe._id).lean();
    expect(guardado).not.toHaveProperty('nombre');
    expect(guardado).not.toHaveProperty('fechaNacimiento');
    expect(guardado.menor.toString()).toBe(menor._id);
    expect(await buscarAuditoria({ accion: 'INFORME_CREADO' })).toHaveLength(1);
  });

  test('guarda toda la estructura (tablas, áreas y apartados) y la consulta', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    expect(informe).toMatchObject({
      ...CONTENIDO_COMPLETO,
      fechaInforme: '2026-11-02T00:00:00.000Z',
    });
    const consultado = await psicoAgent.get(`${ruta()}/${informe._id}`);
    expect(consultado.status).toBe(200);
    expect(consultado.body.informe.tablasCuantitativas).toEqual([TABLA_FICTICIA]);
    expect(consultado.body.informe.areasCualitativas).toEqual([AREA_FICTICIA]);
    expect(consultado.body.informe.menor.fechaNacimiento).toBe('2016-03-12T00:00:00.000Z');
  });

  test('agrega y elimina áreas, apartados, filas y columnas al editar', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const tabla = {
      ...TABLA_FICTICIA,
      // Se elimina una columna y una fila, y se agrega otra fila.
      columnas: ['Área de evaluación', 'Logrados', '% de logro'],
      filas: [
        ['Área ficticia A', '7', '70%'],
        ['Área ficticia C', '3', '30%'],
      ],
    };
    const areas = [
      { ...AREA_FICTICIA, apartados: [AREA_FICTICIA.apartados[0]] },
      { titulo: 'Área ficticia nueva', apartados: [{ titulo: 'Nuevo', texto: 'Texto nuevo.' }] },
    ];
    const res = await editar(informe, {
      tablasCuantitativas: [tabla, { ...TABLA_FICTICIA, titulo: 'Segunda tabla' }],
      areasCualitativas: areas,
    });
    expect(res.status).toBe(200);
    expect(res.body.campos).toEqual(['tablasCuantitativas', 'areasCualitativas']);
    expect(res.body.informe.tablasCuantitativas).toHaveLength(2);
    expect(res.body.informe.tablasCuantitativas[0]).toEqual(tabla);
    expect(res.body.informe.areasCualitativas).toEqual(areas);

    // Sin cambios reales no se registra una modificación.
    const igual = await editar(res.body.informe, { areasCualitativas: areas });
    expect(igual.body.campos).toEqual([]);

    const [auditoria] = await buscarAuditoria({ accion: 'INFORME_ACTUALIZADO' });
    expect(auditoria.detalle.campos).toEqual(['tablasCuantitativas', 'areasCualitativas']);
    // El contenido del informe no queda en la auditoría.
    expect(JSON.stringify(auditoria)).not.toContain('ficticia');
  });

  test('completa con celdas vacías las filas más cortas', async () => {
    const informe = await crear({
      fechaInforme: '2026-11-02',
      tablasCuantitativas: [{ columnas: ['A', 'B', 'C'], filas: [['1'], []] }],
    });
    expect(informe.tablasCuantitativas[0]).toEqual({
      titulo: '',
      descripcion: '',
      columnas: ['A', 'B', 'C'],
      filas: [
        ['1', '', ''],
        ['', '', ''],
      ],
    });
  });

  test('una edición basada en una versión anterior responde 409', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    expect((await editar(informe, { conclusion: 'Primera' })).status).toBe(200);
    const res = await editar(informe, { conclusion: 'Segunda' });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('INFORME_DESACTUALIZADO');
    expect((await editar({ _id: informe._id }, { conclusion: 'x' })).status).toBe(400);
  });

  const columnas13 = Array.from({ length: 13 }, (_, i) => `C${i}`);
  test.each([
    [{ fechaInforme: '' }, 'fechaInforme'],
    [{ fechaInforme: '2099-01-01' }, 'fechaInforme'],
    [{ fechaInforme: '2016-03-11' }, 'fechaInforme'],
    [{ fechaInforme: '02-11-2026' }, 'fechaInforme'],
    [{ curso: 'x'.repeat(51) }, 'curso'],
    [{ conclusion: 'x'.repeat(15001) }, 'conclusion'],
    [{ motivoConsulta: 'Motivo 😀' }, 'motivoConsulta'],
    [{ analisisCualitativo: 42 }, 'analisisCualitativo'],
    [{ sugerencias: { otra: 'x' } }, 'sugerencias'],
    [{ sugerencias: 'texto' }, 'sugerencias'],
    [{ sugerencias: { familia: 'x'.repeat(8001) } }, 'sugerencias.familia'],
    [{ tablasCuantitativas: 'tabla' }, 'tablasCuantitativas'],
    [{ tablasCuantitativas: [{ columnas: [] }] }, 'tablasCuantitativas'],
    [{ tablasCuantitativas: [{ columnas: columnas13 }] }, 'tablasCuantitativas'],
    [{ tablasCuantitativas: [{ columnas: ['A'], filas: [['1', '2']] }] }, 'tablasCuantitativas'],
    [{ tablasCuantitativas: [{ columnas: ['A'], filas: [[5]] }] }, 'tablasCuantitativas'],
    [{ tablasCuantitativas: [{ columnas: ['A'], filas: [['😀']] }] }, 'tablasCuantitativas'],
    [{ tablasCuantitativas: [{ columnas: ['A'], formula: 'x' }] }, 'tablasCuantitativas'],
    [{ areasCualitativas: [{ titulo: 'A', apartados: 'x' }] }, 'areasCualitativas'],
    [{ areasCualitativas: [{ titulo: 'A', apartados: [{ texto: 1 }] }] }, 'areasCualitativas'],
    [
      { areasCualitativas: Array.from({ length: 21 }, () => ({ titulo: 'A', apartados: [] })) },
      'areasCualitativas',
    ],
  ])('rechaza %j', async (datos, campo) => {
    const res = await psicoAgent.post(ruta()).send({ fechaInforme: '2026-11-02', ...datos });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty([campo]);
    expect(await Informe.countDocuments()).toBe(0);
  });

  test('rechaza campos no permitidos, como el menor o los PDF', async () => {
    for (const extra of [{ menor: otroMenor._id }, { pdfs: [] }, { creadoPor: psico._id }]) {
      const res = await psicoAgent.post(ruta()).send({ fechaInforme: '2026-11-02', ...extra });
      expect(res.status).toBe(400);
    }
    expect(await Informe.countDocuments()).toBe(0);
  });

  test('acepta informes extensos con varias áreas y tablas', async () => {
    const extenso = {
      ...CONTENIDO_COMPLETO,
      conclusion: 'ñ'.repeat(15000),
      tablasCuantitativas: Array.from({ length: 5 }, () => ({
        ...TABLA_FICTICIA,
        filas: Array.from({ length: 50 }, (_, i) => [`Fila ${i}`, '1', '1', '100%']),
      })),
      areasCualitativas: Array.from({ length: 8 }, (_, i) => ({
        titulo: `Área ${i}`,
        apartados: Array.from({ length: 4 }, () => ({ titulo: 'Apartado', texto: 'é'.repeat(5000) })),
      })),
    };
    const informe = await crear(extenso);
    expect(informe.conclusion).toHaveLength(15000);
    expect(informe.areasCualitativas).toHaveLength(8);
    expect(informe.tablasCuantitativas[4].filas).toHaveLength(50);
  });
});

describe('Generación del PDF', () => {
  test('exige todas las secciones, incluida una tabla con datos y un área', async () => {
    const informe = await crear({ fechaInforme: '2026-11-02', motivoConsulta: 'Motivo' });
    const res = await generar(informe);
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.detalles).sort()).toEqual(
      [
        'antecedentesRelevantes',
        'instrumentoEvaluativo',
        'areasEvaluacion',
        'tablasCuantitativas',
        'objetivoEvaluacion',
        'areasCualitativas',
        'conclusion',
        'sugerencias.familia',
        'sugerencias.escuela',
        'sugerencias.nino',
      ].sort()
    );
    expect(await mongoose.connection.db.collection('documentos.files').countDocuments()).toBe(0);
  });

  test.each([
    [
      { tablasCuantitativas: [{ ...TABLA_FICTICIA, filas: [['', '', '', '']] }] },
      'tablasCuantitativas',
      /no tiene datos/,
    ],
    [
      { tablasCuantitativas: [{ ...TABLA_FICTICIA, columnas: ['A', '', 'C', 'D'] }] },
      'tablasCuantitativas',
      /encabezados de la tabla 1/,
    ],
    [
      { areasCualitativas: [{ titulo: '', apartados: AREA_FICTICIA.apartados }] },
      'areasCualitativas',
      /nombre del área 1/,
    ],
    [
      { areasCualitativas: [{ titulo: 'Área', apartados: [{ titulo: 'Sin texto', texto: '' }] }] },
      'areasCualitativas',
      /apartado a\) del área 1/,
    ],
  ])('detecta tablas o áreas incompletas (%#)', async (cambios, campo, mensaje) => {
    const informe = await crear({ ...CONTENIDO_COMPLETO, ...cambios });
    const res = await generar(informe);
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.detalles)).toEqual([campo]);
    expect(res.body.detalles[campo]).toMatch(mensaje);
  });

  test('el PDF conserva la estructura, las tablas, las áreas y las listas', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const res = await generar(informe);
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/archivoId|authTag|"iv"/);
    expect(await buscarAuditoria({ accion: 'INFORME_PDF_GENERADO' })).toHaveLength(1);

    const pdf = await descargarPdf(informe, 1);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toMatch(
      /^inline; filename="informe-psicopedagogico-2026-11-02-v1\.pdf"/
    );
    const lineas = textoDelPdf(pdf.body).split('\n');
    // Secciones en el orden de la estructura del informe.
    const titulos = [
      'ANTECEDENTES PERSONALES',
      'ANTECEDENTES RELEVANTES',
      'DERIVACIÓN Y MOTIVO DE CONSULTA',
      'ANTECEDENTES DE EVALUACIÓN',
      'Instrumento evaluativo',
      'Áreas de evaluación',
      'RESULTADOS CUANTITATIVOS',
      'Tabla ficticia de resultados',
      'Área de evaluación',
      'OBJETIVO DE LA EVALUACIÓN',
      'RESULTADOS Y ANÁLISIS CUALITATIVOS POR ÁREAS',
      '1. Área ficticia de lenguaje',
      'a) Comprensión',
      'CONCLUSIÓN PSICOPEDAGÓGICA',
      'SUGERENCIAS',
      'Familia',
      'Escuela',
      'Niño',
    ];
    const posiciones = titulos.map((titulo) => lineas.indexOf(titulo));
    expect(posiciones.every((p) => p >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
    // Celdas de la tabla, viñetas y listas numeradas tal como se ingresaron.
    for (const valor of [
      'Total de ítems',
      '% de logro',
      'Área ficticia B',
      '50%',
      '•',
      'Fortaleza ficticia.',
      '1.',
      'Segundo punto ficticio.',
      'Sugerencia ficticia para la escuela.',
    ]) {
      expect(lineas).toContain(valor);
    }
    // El apartado sin subtítulo no recibe letra.
    expect(lineas).not.toContain('b) ');
    // Datos del perfil y edad calculada a la fecha del informe.
    const texto = lineas.join('\n');
    for (const valor of ['Menor Ficticio Uno', '12-03-2016', '10 años y 7 meses']) {
      expect(texto).toContain(valor);
    }
    expect(texto).not.toContain('VISTA PREVIA');
    expect(texto).not.toContain('(Sección sin completar)');
  });

  describe('% de logro calculado', () => {
    function tablaLogro(filas, columnas = ['Área', 'Total de ítems', 'Logrados', '% de logro']) {
      return { titulo: 'Tabla de logro ficticia', columnas, filas };
    }

    test('se calcula como Logrados ÷ Total de ítems, redondeado a entero', async () => {
      const tabla = tablaLogro([
        ['Área A', '10', '7', ''],
        ['Área B', '12', '7', ''],
        // El valor ingresado a mano se reemplaza por el calculado.
        ['Área C', '8', '8', '99%'],
      ]);
      const informe = await crear({ ...CONTENIDO_COMPLETO, tablasCuantitativas: [tabla] });
      await generar(informe);
      const lineas = (await textoDeVersion(informe)).split('\n');
      for (const valor of ['70%', '58%', '100%']) expect(lineas).toContain(valor);
      expect(lineas).not.toContain('99%');

      // El informe guardado conserva las celdas tal como se ingresaron.
      const guardado = await Informe.findById(informe._id).lean();
      expect(guardado.tablasCuantitativas[0].filas.map((f) => f[3])).toEqual(['', '', '99%']);
    });

    test.each([['7,5'], ['diez'], ['-3'], ['1e2']])(
      '«Total de ítems» y «Logrados» solo admiten enteros (rechaza %s)',
      async (valor) => {
        for (const fila of [
          ['Área', valor, '1', ''],
          ['Área', '10', valor, ''],
        ]) {
          const res = await psicoAgent
            .post(ruta())
            .send({ fechaInforme: '2026-11-02', tablasCuantitativas: [tablaLogro([fila])] });
          expect(res.status).toBe(400);
          expect(res.body.detalles.tablasCuantitativas).toMatch(/solo admite números enteros/);
        }
        expect(await Informe.countDocuments()).toBe(0);
      }
    );

    test('las demás columnas admiten texto libre', async () => {
      const informe = await crear({
        fechaInforme: '2026-11-02',
        tablasCuantitativas: [tablaLogro([['Área con texto', '10', '', 'En proceso']])],
      });
      expect(informe.tablasCuantitativas[0].filas[0]).toEqual([
        'Área con texto',
        '10',
        '',
        'En proceso',
      ]);
    });

    test('si una fila no permite el cálculo, conserva lo ingresado', async () => {
      const tabla = tablaLogro([
        ['Total cero', '0', '0', 'manual 1'],
        ['Total vacío', '', '3', 'manual 2'],
        ['Logrados mayor', '5', '6', 'manual 3'],
        ['Sin valor', '10', '', ''],
      ]);
      const informe = await crear({ ...CONTENIDO_COMPLETO, tablasCuantitativas: [tabla] });
      await generar(informe);
      const lineas = (await textoDeVersion(informe)).split('\n');
      for (const valor of ['manual 1', 'manual 2', 'manual 3']) {
        expect(lineas).toContain(valor);
      }
      expect(lineas.some((l) => /^\d+%$/.test(l))).toBe(false);
    });

    test('reconoce los encabezados sin importar mayúsculas, tildes ni espacios', async () => {
      const tabla = tablaLogro(
        [['Área A', '4', '1', '']],
        ['Área', '  TOTAL DE ITEMS ', 'logrados', '% DE LOGRO']
      );
      const informe = await crear({ ...CONTENIDO_COMPLETO, tablasCuantitativas: [tabla] });
      await generar(informe);
      expect((await textoDeVersion(informe)).split('\n')).toContain('25%');
    });

    test('sin las tres columnas la tabla se imprime tal cual', async () => {
      const tabla = tablaLogro(
        [['Área A', '7', 'manual']],
        ['Área', 'Logrados', '% de logro']
      );
      const informe = await crear({ ...CONTENIDO_COMPLETO, tablasCuantitativas: [tabla] });
      await generar(informe);
      expect((await textoDeVersion(informe)).split('\n')).toContain('manual');
    });

    test('la vista previa también muestra el % calculado', async () => {
      const res = await psicoAgent
        .post(`${ruta()}/vista-previa`)
        .send({
          fechaInforme: '2026-11-02',
          tablasCuantitativas: [tablaLogro([['Área A', '20', '5', '']])],
        })
        .buffer(true)
        .parse(comoBuffer);
      expect(textoDelPdf(res.body).split('\n')).toContain('25%');
    });
  });

  test('una tabla extensa continúa en otra página repitiendo su encabezado', async () => {
    const tabla = {
      titulo: 'Tabla extensa ficticia',
      columnas: ['Subárea', 'Descripción', 'Nivel'],
      filas: Array.from({ length: 80 }, (_, i) => [`Subárea ${i}`, 'Texto ficticio.', 'Logrado']),
    };
    const informe = await crear({ ...CONTENIDO_COMPLETO, tablasCuantitativas: [tabla] });
    await generar(informe);
    const { body } = await descargarPdf(informe, 1);
    expect(totalPaginas(body)).toBeGreaterThan(2);
    const lineas = textoDelPdf(body).split('\n');
    expect(lineas.filter((l) => l === 'Descripción').length).toBeGreaterThan(1);
    for (let i = 0; i < 80; i += 1) expect(lineas).toContain(`Subárea ${i}`);
  });

  test('aplica la configuración institucional y los datos profesionales en el pie', async () => {
    const conf = '/api/configuracion-informes';
    await adminAgent.put(conf).send({
      nombreInstitucion: 'Centro Ficticio',
      textoPie: 'Pie institucional ficticio',
      numeracionPaginas: true,
    });
    await adminAgent
      .put(`${conf}/logo`)
      .attach('logo', crearPng(400, 100), { filename: 'logo.png', contentType: 'image/png' });
    // El psicopedagogo no puede modificar la configuración institucional.
    expect((await psicoAgent.put(conf).send({ textoPie: 'Intento' })).status).toBe(403);
    await psicoAgent.put('/api/auth/datos-profesionales').send({
      tituloProfesional: 'Psicopedagoga',
      registro: '0000-F',
      correo: 'profesional@ficticio.cl',
    });

    const informe = await crear({
      ...CONTENIDO_COMPLETO,
      analisisCualitativo: Array.from({ length: 40 }, (_, i) => `Párrafo ficticio ${i}.`).join('\n'),
    });
    await generar(informe);
    const { body } = await descargarPdf(informe, 1);
    const paginas = totalPaginas(body);
    expect(paginas).toBeGreaterThan(1);
    const texto = textoDelPdf(body);
    const lineaProfesional = `${psico.nombre} · Psicopedagoga · Registro: 0000-F · profesional@ficticio.cl`;
    expect(texto.split(lineaProfesional)).toHaveLength(paginas + 1);
    expect(texto.match(/Centro Ficticio/g)).toHaveLength(paginas);
    expect(texto.match(/Pie institucional ficticio/g)).toHaveLength(paginas);
    for (let i = 1; i <= paginas; i += 1) expect(texto).toContain(`Página ${i} de ${paginas}`);
    const imagenes = dimensionesImagenes(body);
    expect(imagenes).toHaveLength(paginas);
    for (const { ancho, alto } of imagenes) expect(ancho / alto).toBeCloseTo(4, 3);
  });

  test('sin configuración ni datos profesionales se genera con el diseño predeterminado', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    await generar(informe);
    const { body } = await descargarPdf(informe, 1);
    expect(tieneImagen(body)).toBe(false);
    const texto = textoDelPdf(body);
    expect(texto).toContain('Página 1 de');
    expect(texto).not.toContain('Registro:');
  });

  test('editar y volver a generar crea otra versión sin alterar la anterior', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const primera = (await generar(informe)).body.informe;
    const v1 = (await descargarPdf(informe, 1)).body;

    // También cambian los datos profesionales: el PDF ya emitido no se modifica.
    await psicoAgent.put('/api/auth/datos-profesionales').send({ registro: 'NUEVO-1' });
    const editado = (
      await editar(primera, {
        conclusion: 'Conclusión nueva.',
        areasCualitativas: [...CONTENIDO_COMPLETO.areasCualitativas, AREA_FICTICIA],
      })
    ).body.informe;
    expect(editado.pdfDesactualizado).toBe(true);

    const res = await generar(editado);
    expect(res.body.version).toBe(2);
    expect(res.body.informe.pdfDesactualizado).toBe(false);

    const v1Despues = (await descargarPdf(informe, 1)).body;
    expect(hash(v1Despues)).toBe(hash(v1));
    expect(textoDelPdf(v1Despues)).not.toContain('NUEVO-1');
    const v2 = await textoDeVersion(informe, 2);
    expect(v2).toContain('Conclusión nueva.');
    expect(v2).toContain('2. Área ficticia de lenguaje');
    expect(v2).toContain('Registro: NUEVO-1');
    expect(await mongoose.connection.db.collection('documentos.files').countDocuments()).toBe(2);
  });

  test('generar el PDF exige la versión actual del informe', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    await editar(informe, { conclusion: 'Otra conclusión.' });
    const res = await generar(informe);
    expect(res.status).toBe(409);
    expect(await mongoose.connection.db.collection('documentos.files').countDocuments()).toBe(0);
  });

  test('una versión inexistente responde 404', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    expect((await descargarPdf(informe, 1)).status).toBe(404);
    expect((await descargarPdf(informe, 'abc')).status).toBe(404);
  });
});

describe('Vista previa', () => {
  test('usa el contenido sin guardar y no almacena nada', async () => {
    const res = await psicoAgent
      .post(`${ruta()}/vista-previa`)
      .send({
        fechaInforme: '2026-11-02',
        motivoConsulta: 'Motivo sin guardar.',
        tablasCuantitativas: [TABLA_FICTICIA],
      })
      .buffer(true)
      .parse(comoBuffer);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const texto = textoDelPdf(res.body);
    expect(texto).toContain('VISTA PREVIA');
    expect(texto).toContain('Motivo sin guardar.');
    expect(texto).toContain('Área ficticia B');
    expect(texto).toContain('(Sección sin completar)');
    expect(texto).toContain(`Profesional: ${psico.nombre}`);
    expect(await Informe.countDocuments()).toBe(0);
    expect(await mongoose.connection.db.collection('documentos.files').countDocuments()).toBe(0);
  });

  test('de un informe guardado combina lo guardado con los cambios sin guardar', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const res = await psicoAgent
      .post(`${ruta()}/${informe._id}/vista-previa`)
      .send({
        conclusion: 'Conclusión en edición.',
        sugerencias: { nino: 'Cambio.' },
        areasCualitativas: [{ titulo: 'Área en edición', apartados: [{ texto: 'Texto.' }] }],
      })
      .buffer(true)
      .parse(comoBuffer);
    const texto = textoDelPdf(res.body);
    expect(texto).toContain('Conclusión en edición.');
    expect(texto).toContain('Sugerencia ficticia para la familia.');
    expect(texto).toContain('1. Área en edición');
    expect(texto).not.toContain('Área ficticia de lenguaje');
    const guardado = await Informe.findById(informe._id).lean();
    expect(guardado.conclusion).toBe('Conclusión ficticia.');
    expect(guardado.pdfs).toHaveLength(0);
  });

  test('valida el contenido de la vista previa', async () => {
    const res = await psicoAgent.post(`${ruta()}/vista-previa`).send({ conclusion: '😀' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('conclusion');
  });
});

describe('Datos profesionales', () => {
  const RUTA_DATOS = '/api/auth/datos-profesionales';

  test('el psicopedagogo guarda sus datos y quedan en su sesión', async () => {
    const res = await psicoAgent.put(RUTA_DATOS).send({
      tituloProfesional: '  Psicopedagoga  ',
      registro: '0000-F',
      correo: 'Profesional@Ficticio.cl',
      telefono: '+56 9 0000 0000',
    });
    expect(res.status).toBe(200);
    expect(res.body.usuario.datosProfesionales).toEqual({
      tituloProfesional: 'Psicopedagoga',
      registro: '0000-F',
      correo: 'profesional@ficticio.cl',
      telefono: '+56 9 0000 0000',
    });
    const me = await psicoAgent.get('/api/auth/me');
    expect(me.body.usuario.datosProfesionales.registro).toBe('0000-F');
    const [auditoria] = await buscarAuditoria({ accion: 'DATOS_PROFESIONALES_ACTUALIZADOS' });
    expect(auditoria.detalle.campos).toHaveLength(4);
    expect(JSON.stringify(auditoria)).not.toContain('0000-F');
  });

  test('vaciar todos los datos los elimina', async () => {
    await psicoAgent.put(RUTA_DATOS).send({ registro: '0000-F' });
    const res = await psicoAgent.put(RUTA_DATOS).send({ registro: '' });
    expect(res.body.usuario).not.toHaveProperty('datosProfesionales');
  });

  test.each([
    [{ correo: 'no-es-correo' }, 'correo'],
    [{ telefono: 'abc' }, 'telefono'],
    [{ tituloProfesional: 'x'.repeat(121) }, 'tituloProfesional'],
    [{ registro: '😀' }, 'registro'],
  ])('rechaza %j', async (datos, campo) => {
    const res = await psicoAgent.put(RUTA_DATOS).send(datos);
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty(campo);
  });

  test('no permite modificar otros datos de la cuenta', async () => {
    for (const extra of [{ nombre: 'Otro' }, { rol: 'admin' }, { email: 'x@ficticio.cl' }]) {
      expect((await psicoAgent.put(RUTA_DATOS).send(extra)).status).toBe(400);
    }
  });
});

describe('Historial del menor', () => {
  test('registra la creación, la edición y el PDF sin el contenido', async () => {
    const informe = await crear(CONTENIDO_COMPLETO);
    const editado = (await editar(informe, { conclusion: 'Conclusión editada.' })).body.informe;
    await generar(editado);

    const res = await psicoAgent.get(`/api/menores/${menor._id}/historial`);
    const acciones = res.body.historial.map((r) => r.accion);
    expect(acciones).toEqual(
      expect.arrayContaining(['INFORME_CREADO', 'INFORME_ACTUALIZADO', 'INFORME_PDF_GENERADO'])
    );
    expect(acciones).not.toContain('INFORME_CONSULTADO');
    expect(JSON.stringify(res.body)).not.toContain('Conclusión');
  });
});
