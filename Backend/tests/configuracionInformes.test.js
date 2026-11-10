const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const ConfiguracionInforme = require('../src/models/ConfiguracionInforme');
const Menor = require('../src/models/Menor');
const Diagnostico = require('../src/models/Diagnostico');
const Sesion = require('../src/models/Sesion');
const Documento = require('../src/models/Documento');
const { ROLES } = require('../src/config/roles');
const { guardarCifrado, leerDescifrado } = require('../src/utils/almacenamiento');
const { generarInformePdf } = require('../src/utils/informePdf');
const {
  app,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');
const { crearPng } = require('./imagenes');
const { textoDelPdf, dimensionesImagenes } = require('./pdf');

usarBaseDeDatosDePrueba();

const URL = '/api/configuracion-informes';
const PNG = crearPng(400, 100);
const JPEG = fs.readFileSync(path.join(__dirname, 'fixtures', 'logo-prueba.jpg'));

let admin;
let adminAgent;
let psicoAgent;

beforeEach(async () => {
  admin = await crearUsuario({ rol: ROLES.ADMIN });
  const psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
});

function subir(agent, buffer, filename = 'logo.png', contentType = 'image/png') {
  return agent.put(`${URL}/logo`).attach('logo', buffer, { filename, contentType });
}

// Supertest no convierte los PDF: se reciben como Buffer.
function comoBuffer(res, callback) {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
}

const CONFIGURACION = {
  nombreInstitucion: '  Centro   Psicopedagógico Ficticio ',
  alineacionEncabezado: 'centro',
  posicionLogo: 'izquierda',
  tamanoLogo: 'grande',
  textoPie: '  Av. Ficticia 123, Concepción  \n\n+56 9 0000 0000 · contacto@ficticio.cl ',
  numeracionPaginas: false,
};

describe('Acceso a la configuración de informes', () => {
  test('el administrador obtiene los valores por defecto sin crear registros', async () => {
    const res = await adminAgent.get(URL);
    expect(res.status).toBe(200);
    expect(res.body.configuracion).toMatchObject({
      nombreInstitucion: '',
      alineacionEncabezado: 'izquierda',
      posicionLogo: 'derecha',
      tamanoLogo: 'mediano',
      textoPie: '',
      numeracionPaginas: true,
      logo: null,
    });
    expect(res.body.limitesLogo).toMatchObject({
      maxBytes: 1024 * 1024,
      extensiones: ['.png', '.jpg', '.jpeg'],
    });
    expect(await ConfiguracionInforme.countDocuments()).toBe(0);
  });

  test('el psicopedagogo no puede consultar ni modificar la configuración', async () => {
    const respuestas = await Promise.all([
      psicoAgent.get(URL),
      psicoAgent.put(URL).send({ textoPie: 'Intento' }),
      psicoAgent.get(`${URL}/logo`),
      subir(psicoAgent, PNG),
      psicoAgent.delete(`${URL}/logo`),
      psicoAgent.post(`${URL}/vista-previa`).send({}),
    ]);
    for (const res of respuestas) expect(res.status).toBe(403);
    expect(await ConfiguracionInforme.countDocuments()).toBe(0);
    expect(await buscarAuditoria({ accion: 'ACCESO_DENEGADO' })).toHaveLength(respuestas.length);
  });

  test('un usuario no autenticado recibe 401', async () => {
    expect((await request(app).get(URL)).status).toBe(401);
    expect((await request(app).put(URL).send({ textoPie: 'x' })).status).toBe(401);
    expect((await request(app).get(`${URL}/logo`)).status).toBe(401);
    expect((await request(app).post(`${URL}/vista-previa`)).status).toBe(401);
  });
});

describe('Guardado de la configuración', () => {
  test('guarda y modifica sin duplicar el registro, normalizando los textos', async () => {
    const res = await adminAgent.put(URL).send(CONFIGURACION);
    expect(res.status).toBe(200);
    expect(res.body.configuracion).toMatchObject({
      nombreInstitucion: 'Centro Psicopedagógico Ficticio',
      alineacionEncabezado: 'centro',
      posicionLogo: 'izquierda',
      tamanoLogo: 'grande',
      textoPie: 'Av. Ficticia 123, Concepción\n+56 9 0000 0000 · contacto@ficticio.cl',
      numeracionPaginas: false,
    });

    const modificado = await adminAgent.put(URL).send({ textoPie: 'Nuevo pie ficticio' });
    expect(modificado.body.configuracion.textoPie).toBe('Nuevo pie ficticio');
    expect(modificado.body.configuracion.tamanoLogo).toBe('grande');
    expect(await ConfiguracionInforme.countDocuments()).toBe(1);

    const auditorias = await buscarAuditoria({ accion: 'CONFIG_INFORMES_ACTUALIZADA' });
    expect(auditorias).toHaveLength(2);
    expect(auditorias[1].detalle).toEqual({ campos: ['textoPie'] });
    // Los textos configurados no quedan en el registro de auditoría.
    expect(JSON.stringify(auditorias)).not.toContain('Nuevo pie ficticio');
  });

  test('la configuración persiste al cerrar sesión y volver a ingresar', async () => {
    await adminAgent.put(URL).send(CONFIGURACION);
    await subir(adminAgent, PNG);
    await adminAgent.post('/api/auth/logout');
    expect((await adminAgent.get(URL)).status).toBe(401);

    const nuevaSesion = await iniciarSesion(admin.email);
    const res = await nuevaSesion.get(URL);
    expect(res.body.configuracion).toMatchObject({
      tamanoLogo: 'grande',
      numeracionPaginas: false,
      logo: { mimeType: 'image/png', ancho: 400, alto: 100 },
    });
  });

  test.each([
    [{ alineacionEncabezado: 'justificada' }, 'alineacionEncabezado'],
    [{ posicionLogo: 'centro' }, 'posicionLogo'],
    [{ tamanoLogo: 'enorme' }, 'tamanoLogo'],
    [{ numeracionPaginas: 'si' }, 'numeracionPaginas'],
    [{ nombreInstitucion: 'x'.repeat(121) }, 'nombreInstitucion'],
    [{ nombreInstitucion: 'Línea 1\nLínea 2' }, 'nombreInstitucion'],
    [{ nombreInstitucion: 'Centro 😀' }, 'nombreInstitucion'],
    [{ textoPie: 'x'.repeat(301) }, 'textoPie'],
    [{ textoPie: 'a\nb\nc\nd' }, 'textoPie'],
    [{ textoPie: 123 }, 'textoPie'],
  ])('rechaza %j', async (cuerpo, campo) => {
    const res = await adminAgent.put(URL).send(cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty(campo);
    expect(await ConfiguracionInforme.countDocuments()).toBe(0);
  });

  test('rechaza campos no permitidos y solicitudes sin cambios', async () => {
    expect((await adminAgent.put(URL).send({ clave: 'otra' })).status).toBe(400);
    expect((await adminAgent.put(URL).send({ logo: { mimeType: 'image/png' } })).status).toBe(400);
    expect((await adminAgent.put(URL).send({})).status).toBe(400);
  });

  test('permite vaciar el nombre y el pie', async () => {
    await adminAgent.put(URL).send(CONFIGURACION);
    const res = await adminAgent.put(URL).send({ nombreInstitucion: '', textoPie: '' });
    expect(res.status).toBe(200);
    expect(res.body.configuracion).toMatchObject({ nombreInstitucion: '', textoPie: '' });
  });
});

describe('Logo institucional', () => {
  test('sube un PNG válido y lo entrega sin exponer su almacenamiento', async () => {
    const res = await subir(adminAgent, PNG);
    expect(res.status).toBe(200);
    expect(res.body.configuracion.logo).toMatchObject({
      mimeType: 'image/png',
      ancho: 400,
      alto: 100,
      tamano: PNG.length,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/datos|_id|clave/);

    const imagen = await adminAgent.get(`${URL}/logo`).buffer(true).parse(comoBuffer);
    expect(imagen.status).toBe(200);
    expect(imagen.headers['content-type']).toBe('image/png');
    expect(imagen.headers['x-content-type-options']).toBe('nosniff');
    expect(imagen.headers['cache-control']).toBe('no-store');
    expect(Buffer.compare(imagen.body, PNG)).toBe(0);
    expect(await buscarAuditoria({ accion: 'LOGO_INFORMES_ACTUALIZADO' })).toHaveLength(1);
  });

  test('acepta JPEG con tipo MIME genérico y extensión .jpeg', async () => {
    const res = await subir(adminAgent, JPEG, 'logo.jpeg', 'application/octet-stream');
    expect(res.status).toBe(200);
    expect(res.body.configuracion.logo).toMatchObject({
      mimeType: 'image/jpeg',
      ancho: 300,
      alto: 120,
    });
  });

  test('reemplaza el logo sin duplicar la configuración y conserva las opciones', async () => {
    await adminAgent.put(URL).send({ textoPie: 'Pie ficticio' });
    await subir(adminAgent, PNG);
    const res = await subir(adminAgent, JPEG, 'otro.jpg', 'image/jpeg');
    expect(res.body.configuracion.logo.mimeType).toBe('image/jpeg');
    expect(res.body.configuracion.textoPie).toBe('Pie ficticio');
    expect(await ConfiguracionInforme.countDocuments()).toBe(1);

    const imagen = await adminAgent.get(`${URL}/logo`).buffer(true).parse(comoBuffer);
    expect(imagen.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(imagen.body, JPEG)).toBe(0);
  });

  test('elimina el logo', async () => {
    await subir(adminAgent, PNG);
    expect((await adminAgent.delete(`${URL}/logo`)).status).toBe(204);
    expect((await adminAgent.get(URL)).body.configuracion.logo).toBeNull();
    expect((await adminAgent.get(`${URL}/logo`)).status).toBe(404);
    expect((await adminAgent.delete(`${URL}/logo`)).status).toBe(404);
    expect(await buscarAuditoria({ accion: 'LOGO_INFORMES_ELIMINADO' })).toHaveLength(1);
  });

  test.each([
    ['un formato no permitido', Buffer.from('GIF89a'), 'logo.gif', 'image/gif', 415],
    ['texto con extensión .png', Buffer.from('no es una imagen'), 'logo.png', 'image/png', 415],
    ['un JPEG con extensión .png', JPEG, 'logo.png', 'image/png', 415],
    ['un tipo MIME que no coincide', PNG, 'logo.png', 'image/gif', 415],
    ['un archivo vacío', Buffer.alloc(0), 'logo.png', 'image/png', 400],
    ['un PNG dañado', crearPng(400, 100, { idatTruncado: true }), 'logo.png', 'image/png', 422],
    ['un PNG incompleto', PNG.subarray(0, PNG.length - 30), 'logo.png', 'image/png', 422],
    ['un JPEG incompleto', JPEG.subarray(0, JPEG.length - 200), 'logo.jpg', 'image/jpeg', 422],
    ['una imagen demasiado grande', crearPng(2001, 10), 'logo.png', 'image/png', 422],
  ])('rechaza %s', async (_caso, buffer, filename, contentType, status) => {
    const res = await subir(adminAgent, buffer, filename, contentType);
    expect(res.status).toBe(status);
    expect(res.body.error).toBeTruthy();
    expect(await ConfiguracionInforme.countDocuments()).toBe(0);
  });

  test('rechaza archivos de más de 1 MB', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
    const res = await subir(adminAgent, grande);
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/1 MB/);
  });

  test('exige el archivo en el campo "logo"', async () => {
    const sinArchivo = await adminAgent.put(`${URL}/logo`);
    expect(sinArchivo.status).toBe(400);
    const otroCampo = await adminAgent
      .put(`${URL}/logo`)
      .attach('archivo', PNG, { filename: 'logo.png', contentType: 'image/png' });
    expect(otroCampo.status).toBe(400);
  });
});

describe('Vista previa y uso en informes', () => {
  async function contarRegistrosClinicos() {
    const conteos = await Promise.all(
      [Menor, Diagnostico, Sesion, Documento].map((modelo) => modelo.countDocuments())
    );
    return conteos.reduce((a, b) => a + b, 0);
  }

  test('genera un PDF de prueba con las opciones sin guardar y no escribe datos', async () => {
    await adminAgent.put(URL).send({ textoPie: 'Pie guardado', numeracionPaginas: true });
    await subir(adminAgent, PNG);
    const antes = await ConfiguracionInforme.findOne().lean();

    const res = await adminAgent
      .post(`${URL}/vista-previa`)
      .send({ textoPie: 'Pie sin guardar', nombreInstitucion: 'Centro Ficticio' })
      .buffer(true)
      .parse(comoBuffer);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['cache-control']).toBe('no-store');

    const texto = textoDelPdf(res.body);
    expect(texto).toContain('DATOS FICTICIOS · VISTA PREVIA');
    expect(texto).toContain('Pie sin guardar');
    expect(texto).not.toContain('Pie guardado');
    expect(texto).toContain('Centro Ficticio');
    expect(texto).toMatch(/Página 1 de \d/);
    // Incluye el logo guardado con su proporción.
    const imagenes = dimensionesImagenes(res.body);
    expect(imagenes.length).toBeGreaterThan(0);
    for (const { ancho, alto } of imagenes) {
      expect(ancho / alto).toBeCloseTo(4, 3);
    }

    expect(await contarRegistrosClinicos()).toBe(0);
    const despues = await ConfiguracionInforme.findOne().lean();
    expect(despues.textoPie).toBe('Pie guardado');
    expect(despues.updatedAt).toEqual(antes.updatedAt);
  });

  test('genera la vista previa sin configuración guardada', async () => {
    const res = await adminAgent.post(`${URL}/vista-previa`).buffer(true).parse(comoBuffer);
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(await ConfiguracionInforme.countDocuments()).toBe(0);
  });

  test('valida las opciones de la vista previa', async () => {
    const res = await adminAgent.post(`${URL}/vista-previa`).send({ tamanoLogo: 'enorme' });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toHaveProperty('tamanoLogo');
  });

  test('obtenerVigente entrega la configuración con el logo para generar informes', async () => {
    await adminAgent.put(URL).send({ nombreInstitucion: 'Centro Ficticio' });
    await subir(adminAgent, PNG);
    const vigente = await ConfiguracionInforme.obtenerVigente({ conLogo: true });
    expect(vigente.nombreInstitucion).toBe('Centro Ficticio');
    expect(Buffer.compare(vigente.logo.datos, PNG)).toBe(0);
    const sinLogo = await ConfiguracionInforme.obtenerVigente();
    expect(sinLogo.logo).not.toHaveProperty('datos');
  });

  test('cambiar la configuración no modifica un PDF ya almacenado', async () => {
    await adminAgent.put(URL).send({ textoPie: 'Pie original', nombreInstitucion: 'Centro A' });
    await subir(adminAgent, PNG);
    const pdf = await generarInformePdf({
      configuracion: await ConfiguracionInforme.obtenerVigente({ conLogo: true }),
      secciones: [{ titulo: '1. Sección ficticia', parrafos: ['Contenido ficticio.'] }],
    });
    const almacenado = await guardarCifrado(pdf);
    const hash = (contenido) => crypto.createHash('sha256').update(contenido).digest('hex');

    await adminAgent.put(URL).send({ textoPie: 'Pie nuevo', nombreInstitucion: 'Centro B' });
    await subir(adminAgent, JPEG, 'logo.jpg', 'image/jpeg');
    await adminAgent.delete(`${URL}/logo`);

    const leido = await leerDescifrado(almacenado);
    expect(hash(leido)).toBe(hash(pdf));
    expect(textoDelPdf(leido)).toContain('Pie original');
    expect(textoDelPdf(leido)).not.toContain('Pie nuevo');
    expect(await mongoose.connection.db.collection('documentos.files').countDocuments()).toBe(1);
  });
});
