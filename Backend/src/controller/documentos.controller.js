const mongoose = require('mongoose');
const Documento = require('../models/Documento');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const config = require('../config/env');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const { guardarCifrado, leerDescifrado, eliminarArchivo } = require('../utils/almacenamiento');
const {
  TIPOS,
  validarArchivo,
  sanearNombre,
  convertirAHtml,
  limites,
  contentDisposition,
} = require('../utils/documentos');

// El documento debe pertenecer al menor autorizado: un id ajeno responde 404.
async function buscarDocumento(req) {
  const { documentoId } = req.params;
  const documento = mongoose.isValidObjectId(documentoId)
    ? await Documento.findOne({ _id: documentoId, menor: req.menorId })
    : null;
  if (!documento) throw new HttpError(404, 'Documento no encontrado');
  return documento;
}

async function contenidoDe(documento) {
  try {
    return await leerDescifrado(documento);
  } catch {
    // Falla si el archivo falta o fue alterado (el cifrado GCM lo detecta).
    throw new HttpError(500, 'No se pudo abrir el documento');
  }
}

function auditar(req, accion, documento) {
  return registrarAuditoria(req, {
    accion,
    recurso: 'menor',
    recursoId: req.menorId,
    // El nombre del archivo puede contener datos del menor: no se registra.
    detalle: { documentoId: String(documento._id), tipo: documento.tipo },
  });
}

function sinCache(res) {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
}

async function listarDocumentos(req, res) {
  const documentos = await Documento.find({ menor: req.menorId })
    .sort({ createdAt: -1 })
    .populate('subidoPor', 'nombre');
  res.json({ documentos, limites: limites(config.documentosMaxBytes) });
}

async function subirDocumento(req, res) {
  if (!req.file) throw new HttpError(400, 'Debe adjuntar un archivo');
  const tipo = validarArchivo(req.file);
  // DOC y DOCX dañados se detectan al intentar leerlos.
  if (tipo !== 'pdf') await convertirAHtml(tipo, req.file.buffer);

  const almacenado = await guardarCifrado(req.file.buffer);
  const documento = await Documento.create({
    menor: req.menorId,
    nombreOriginal: sanearNombre(req.file.originalname),
    tipo,
    mimeType: TIPOS[tipo].mimes[0],
    tamano: req.file.size,
    ...almacenado,
    subidoPor: req.user._id,
  });

  await auditar(req, AUDIT_ACTIONS.DOCUMENTO_SUBIDO, documento);
  await documento.populate('subidoPor', 'nombre');
  res.status(201).json({ documento });
}

// PDF: binario para el visor integrado. DOC/DOCX: HTML saneado.
async function verDocumento(req, res) {
  const documento = await buscarDocumento(req);
  const contenido = await contenidoDe(documento);
  await auditar(req, AUDIT_ACTIONS.DOCUMENTO_CONSULTADO, documento);
  sinCache(res);

  if (documento.tipo === 'pdf') {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition('inline', documento.nombreOriginal),
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    return res.send(contenido);
  }
  res.json({ formato: 'html', html: await convertirAHtml(documento.tipo, contenido) });
}

async function descargarDocumento(req, res) {
  const documento = await buscarDocumento(req);
  const contenido = await contenidoDe(documento);
  await auditar(req, AUDIT_ACTIONS.DOCUMENTO_DESCARGADO, documento);
  sinCache(res);
  res.set({
    'Content-Type': documento.mimeType,
    'Content-Disposition': contentDisposition('attachment', documento.nombreOriginal),
  });
  res.send(contenido);
}

async function eliminarDocumento(req, res) {
  const documento = await buscarDocumento(req);
  await eliminarArchivo(documento.archivoId);
  await documento.deleteOne();
  await auditar(req, AUDIT_ACTIONS.DOCUMENTO_ELIMINADO, documento);
  res.status(204).end();
}

module.exports = {
  listarDocumentos,
  subirDocumento,
  verDocumento,
  descargarDocumento,
  eliminarDocumento,
};
