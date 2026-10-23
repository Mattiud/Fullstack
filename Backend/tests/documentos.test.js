const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const request = require('supertest');
const JSZip = require('jszip');
const Documento = require('../src/models/Documento');
const { ROLES } = require('../src/config/roles');
const {
  app,
  usarBaseDeDatosDePrueba,
  crearUsuario,
  iniciarSesion,
  buscarAuditoria,
} = require('./helpers');

usarBaseDeDatosDePrueba();

// Archivos de prueba con contenido ficticio, generados con Microsoft Word.
const fixture = (nombre) => fs.readFileSync(path.join(__dirname, 'fixtures', nombre));
const PDF = fixture('documento-prueba.pdf');
const DOCX = fixture('documento-prueba.docx');
const DOC = fixture('documento-prueba.doc');
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let admin;
let psico;
let otroPsico;
let adminAgent;
let psicoAgent;
let otroAgent;
let menor;
let menorOtro;

function datosMenor(nombre, rut) {
  return {
    nombre,
    rut,
    fechaNacimiento: '2016-03-12',
    apoderado: { nombre: 'Apoderado Ficticio', parentesco: 'Madre', telefono: '+56 9 1234 5678' },
    antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
  };
}

beforeEach(async () => {
  admin = await crearUsuario({ rol: ROLES.ADMIN });
  psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
  otroAgent = await iniciarSesion(otroPsico.email);
  menor = (await psicoAgent.post('/api/menores').send(datosMenor('Menor Uno', '12.345.678-5'))).body.menor;
  menorOtro = (await otroAgent.post('/api/menores').send(datosMenor('Menor Dos', '7.654.321-6'))).body
    .menor;
});

const rutaDocumentos = (id = menor._id) => `/api/menores/${id}/documentos`;

function subir(agent, contenido, filename, contentType, id) {
  return agent.post(rutaDocumentos(id)).attach('archivo', contenido, { filename, contentType });
}

async function subirPdf(nombre = 'Evaluación inicial.pdf') {
  const res = await subir(psicoAgent, PDF, nombre, 'application/pdf');
  expect(res.status).toBe(201);
  return res.body.documento;
}

// Lectura binaria con supertest.
function binario(res, callback) {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
}

describe('Carga y almacenamiento', () => {
  test('un usuario autorizado adjunta un PDF y queda asociado al menor', async () => {
    const documento = await subirPdf();

    expect(documento).toMatchObject({
      nombreOriginal: 'Evaluación inicial.pdf',
      tipo: 'pdf',
      mimeType: 'application/pdf',
      tamano: PDF.length,
      menor: menor._id,
      subidoPor: { nombre: psico.nombre },
    });
    expect(documento).not.toHaveProperty('archivoId');
    expect(documento).not.toHaveProperty('iv');

    const lista = await psicoAgent.get(rutaDocumentos());
    expect(lista.body.documentos.map((d) => d._id)).toEqual([documento._id]);
    expect(lista.body.limites).toMatchObject({ maxBytes: 1024 * 1024, extensiones: ['.pdf', '.docx', '.doc'] });
  });

  test('el contenido queda cifrado en GridFS', async () => {
    await subirPdf();
    const chunks = await mongoose.connection.db.collection('documentos.chunks').find().toArray();
    const almacenado = Buffer.concat(chunks.map((c) => c.data.buffer));

    expect(almacenado.length).toBe(PDF.length);
    expect(almacenado.includes('%PDF')).toBe(false);
    expect(almacenado.equals(PDF)).toBe(false);
  });

  test('el registro de auditoría no incluye el nombre del archivo', async () => {
    await subirPdf('Informe Menor Uno.pdf');
    const [registro] = await buscarAuditoria({ accion: 'DOCUMENTO_SUBIDO' });

    expect(registro).toMatchObject({ recurso: 'menor', recursoId: menor._id });
    expect(JSON.stringify(registro)).not.toContain('Informe Menor Uno');
  });
});

describe('Visualización', () => {
  test('el PDF se entrega con su contenido real para el visor integrado', async () => {
    const documento = await subirPdf();
    const res = await psicoAgent
      .get(`${rutaDocumentos()}/${documento._id}/vista`)
      .buffer(true)
      .parse(binario);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.body.equals(PDF)).toBe(true);
    expect(await buscarAuditoria({ accion: 'DOCUMENTO_CONSULTADO' })).toHaveLength(1);
  });

  test('un DOCX se visualiza como HTML con su contenido y formato', async () => {
    const { body } = await subir(psicoAgent, DOCX, 'Informe escolar.docx', MIME_DOCX);
    const res = await psicoAgent.get(`${rutaDocumentos()}/${body.documento._id}/vista`);

    expect(res.status).toBe(200);
    expect(res.body.formato).toBe('html');
    expect(res.body.html).toContain('<h1>Informe de prueba ficticio</h1>');
    expect(res.body.html).toContain('Antecedentes de ejemplo sin datos reales de menores.');
  });

  test('un DOC se visualiza con su texto', async () => {
    const { body } = await subir(psicoAgent, DOC, 'Autorización.doc', 'application/msword');
    expect(body.documento.tipo).toBe('doc');
    const res = await psicoAgent.get(`${rutaDocumentos()}/${body.documento._id}/vista`);

    expect(res.body.html).toContain('<p>Antecedentes de ejemplo sin datos reales de menores.</p>');
  });

  test('acepta DOCX con tipo MIME genérico si el contenido es válido', async () => {
    const res = await subir(psicoAgent, DOCX, 'informe.docx', 'application/octet-stream');
    expect(res.status).toBe(201);
    expect(res.body.documento.mimeType).toBe(MIME_DOCX);
  });

  test('el HTML generado no contiene scripts ni enlaces', async () => {
    const zip = await JSZip.loadAsync(DOCX);
    const xml = await zip.file('word/document.xml').async('string');
    zip.file(
      'word/document.xml',
      xml.replace('Informe de prueba ficticio', 'Informe &lt;script&gt;alert(1)&lt;/script&gt;')
    );
    const modificado = await zip.generateAsync({ type: 'nodebuffer' });
    const { body } = await subir(psicoAgent, modificado, 'informe.docx', MIME_DOCX);
    const res = await psicoAgent.get(`${rutaDocumentos()}/${body.documento._id}/vista`);

    expect(res.body.html).not.toContain('<script');
    expect(res.body.html).toContain('&lt;script&gt;');
  });

  test('la descarga entrega el archivo original con su nombre', async () => {
    const documento = await subirPdf();
    const res = await psicoAgent
      .get(`${rutaDocumentos()}/${documento._id}/descarga`)
      .buffer(true)
      .parse(binario);

    expect(res.headers['content-disposition']).toContain("attachment;");
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''Evaluaci%C3%B3n%20inicial.pdf");
    expect(res.body.equals(PDF)).toBe(true);
    expect(await buscarAuditoria({ accion: 'DOCUMENTO_DESCARGADO' })).toHaveLength(1);
  });

  test('un archivo alterado en la base de datos no se entrega', async () => {
    const documento = await subirPdf();
    const chunks = mongoose.connection.db.collection('documentos.chunks');
    const chunk = await chunks.findOne();
    const datos = Buffer.from(chunk.data.buffer);
    datos[10] ^= 0xff;
    await chunks.updateOne({ _id: chunk._id }, { $set: { data: datos } });

    const res = await psicoAgent.get(`${rutaDocumentos()}/${documento._id}/vista`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'No se pudo abrir el documento' });
  });
});

describe('Rechazo de archivos', () => {
  test('formato no permitido', async () => {
    const res = await subir(psicoAgent, Buffer.from('texto'), 'notas.txt', 'text/plain');
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/PDF, DOC y DOCX/);
  });

  test('extensión PDF con contenido distinto', async () => {
    const res = await subir(psicoAgent, DOCX, 'falso.pdf', 'application/pdf');
    expect(res.status).toBe(415);
  });

  test('tipo MIME que no coincide con la extensión', async () => {
    const res = await subir(psicoAgent, PDF, 'informe.pdf', 'text/html');
    expect(res.status).toBe(415);
  });

  test('archivo que supera el tamaño máximo', async () => {
    const grande = Buffer.concat([PDF.subarray(0, 8), Buffer.alloc(1024 * 1024 + 10)]);
    const res = await subir(psicoAgent, grande, 'grande.pdf', 'application/pdf');
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('El archivo supera el tamaño máximo permitido (1 MB)');
  });

  test('DOCX con macros', async () => {
    const zip = await JSZip.loadAsync(DOCX);
    zip.file('word/vbaProject.bin', 'macro ficticia');
    const conMacros = await zip.generateAsync({ type: 'nodebuffer' });
    const res = await subir(psicoAgent, conMacros, 'macros.docx', MIME_DOCX);
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/macros/);
  });

  test('PDF con contenido activo', async () => {
    const conScript = Buffer.from(
      PDF.toString('latin1').replace('%PDF-1.7', '%PDF-1.7\n1 0 obj << /S /JavaScript >> endobj'),
      'latin1'
    );
    const res = await subir(psicoAgent, conScript, 'script.pdf', 'application/pdf');
    expect(res.status).toBe(415);
  });

  test('DOCX dañado', async () => {
    const danado = Buffer.concat([DOCX.subarray(0, 4), Buffer.from('word/document.xml'), Buffer.alloc(200)]);
    const res = await subir(psicoAgent, danado, 'danado.docx', MIME_DOCX);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'El archivo está dañado o no se puede leer' });
  });

  test('solicitud sin archivo', async () => {
    const res = await psicoAgent.post(rutaDocumentos()).field('otro', 'x');
    expect(res.status).toBe(400);
    expect(await Documento.countDocuments()).toBe(0);
  });
});

describe('Permisos sobre documentos', () => {
  test('un usuario no autenticado no puede listar, subir ni ver documentos', async () => {
    const documento = await subirPdf();
    expect((await request(app).get(rutaDocumentos())).status).toBe(401);
    expect((await request(app).get(`${rutaDocumentos()}/${documento._id}/vista`)).status).toBe(401);
    expect((await request(app).get(`${rutaDocumentos()}/${documento._id}/descarga`)).status).toBe(401);
    expect(
      (await request(app).post(rutaDocumentos()).attach('archivo', PDF, 'a.pdf')).status
    ).toBe(401);
  });

  test('un psicopedagogo no asignado no puede ver, descargar ni subir', async () => {
    const documento = await subirPdf();
    const vista = await otroAgent.get(`${rutaDocumentos()}/${documento._id}/vista`);
    const descarga = await otroAgent.get(`${rutaDocumentos()}/${documento._id}/descarga`);
    const lista = await otroAgent.get(rutaDocumentos());
    const subida = await subir(otroAgent, PDF, 'a.pdf', 'application/pdf');

    expect([vista.status, descarga.status, lista.status, subida.status]).toEqual([403, 403, 403, 403]);
    expect(vista.headers['content-type']).toMatch(/json/);
    expect(await Documento.countDocuments()).toBe(1);
  });

  test('manipular el identificador para leer un documento de otro menor responde 404', async () => {
    const documento = await subirPdf();
    // El otro psicopedagogo sí tiene acceso a su propio menor, pero el documento no le pertenece.
    const res = await otroAgent.get(`${rutaDocumentos(menorOtro._id)}/${documento._id}/vista`);
    expect(res.status).toBe(404);
  });

  test('el administrador puede ver documentos pero no subirlos ni eliminarlos', async () => {
    const documento = await subirPdf();
    expect((await adminAgent.get(`${rutaDocumentos()}/${documento._id}/vista`)).status).toBe(200);
    expect((await subir(adminAgent, PDF, 'a.pdf', 'application/pdf')).status).toBe(403);
    expect((await adminAgent.delete(`${rutaDocumentos()}/${documento._id}`)).status).toBe(403);
  });
});

describe('Eliminación', () => {
  test('el psicopedagogo asignado elimina el documento y su contenido', async () => {
    const documento = await subirPdf();
    const res = await psicoAgent.delete(`${rutaDocumentos()}/${documento._id}`);

    expect(res.status).toBe(204);
    expect(await Documento.countDocuments()).toBe(0);
    expect(await mongoose.connection.db.collection('documentos.files').countDocuments()).toBe(0);
    expect(await mongoose.connection.db.collection('documentos.chunks').countDocuments()).toBe(0);
    expect(await buscarAuditoria({ accion: 'DOCUMENTO_ELIMINADO' })).toHaveLength(1);
    expect((await psicoAgent.get(`${rutaDocumentos()}/${documento._id}/vista`)).status).toBe(404);

    const historial = await psicoAgent.get(`/api/menores/${menor._id}/historial`);
    expect(historial.body.historial.map((h) => h.accion)).toEqual([
      'DOCUMENTO_ELIMINADO',
      'DOCUMENTO_SUBIDO',
      'MENOR_CREADO',
    ]);
  });
});
