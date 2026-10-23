const crypto = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../config/env');

// Archivos adjuntos en GridFS (bucket "documentos"), cifrados con AES-256-GCM.
// Persisten en MongoDB, a diferencia del disco local de Render, que se borra al reiniciar.
const ALGORITMO = 'aes-256-gcm';

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'documentos' });
}

// Cifra y guarda el contenido. Devuelve la referencia y los parámetros del cifrado.
async function guardarCifrado(contenido) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, config.documentosKey, iv);
  const cifrado = Buffer.concat([cipher.update(contenido), cipher.final()]);

  const archivoId = await new Promise((resolve, reject) => {
    // Nombre interno aleatorio: no depende del nombre entregado por el usuario.
    const subida = bucket().openUploadStream(crypto.randomUUID());
    subida.once('finish', () => resolve(subida.id));
    subida.once('error', reject);
    subida.end(cifrado);
  });

  return {
    archivoId,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

// Lee y descifra el contenido. GCM falla si el archivo fue alterado.
async function leerDescifrado({ archivoId, iv, authTag }) {
  const partes = [];
  for await (const parte of bucket().openDownloadStream(archivoId)) {
    partes.push(parte);
  }
  const decipher = crypto.createDecipheriv(
    ALGORITMO,
    config.documentosKey,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.concat(partes)), decipher.final()]);
}

async function eliminarArchivo(archivoId) {
  await bucket().delete(archivoId);
}

module.exports = { guardarCifrado, leerDescifrado, eliminarArchivo };
