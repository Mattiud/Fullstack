const mongoose = require('mongoose');

// Metadatos de un documento adjunto. El contenido se guarda cifrado en GridFS
// (bucket "documentos") con un nombre interno aleatorio.
const documentoSchema = new mongoose.Schema(
  {
    menor: { type: mongoose.Schema.Types.ObjectId, ref: 'Menor', required: true, index: true },
    // Solo para mostrar; nunca se usa como ruta ni nombre de almacenamiento.
    nombreOriginal: { type: String, required: true, trim: true, maxlength: 200 },
    tipo: { type: String, enum: ['pdf', 'doc', 'docx'], required: true },
    mimeType: { type: String, required: true },
    tamano: { type: Number, required: true },
    archivoId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Parámetros del cifrado AES-256-GCM, en base64.
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    subidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.archivoId;
        delete ret.iv;
        delete ret.authTag;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Documento', documentoSchema);
