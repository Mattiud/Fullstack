import { NOMBRES_ROLES } from '../constants/auth';

const formatoFecha = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatearFecha(valor) {
  return valor ? formatoFecha.format(new Date(valor)) : '—';
}

function nombreDe(usuariosPorId, id) {
  return usuariosPorId.get(id)?.nombre ?? 'una cuenta';
}

// Descripción legible de un registro de auditoría (acciones de Backend/src/models/AuditLog.js).
export function describirAuditoria(registro, usuariosPorId = new Map()) {
  const { accion, resultado, recurso, recursoId, detalle = {} } = registro;
  const afectado = nombreDe(usuariosPorId, recursoId);

  switch (accion) {
    case 'LOGIN_EXITOSO':
      return 'inicio de sesión exitoso';
    case 'LOGIN_FALLIDO':
      return 'intento de inicio de sesión fallido';
    case 'INTENTOS_EXCEDIDOS':
      return 'bloqueo por exceso de intentos';
    case 'LOGOUT':
      return 'cierre de sesión';
    case 'CAMBIO_PASSWORD':
      return resultado === 'fallo'
        ? 'intento fallido de cambio de contraseña'
        : 'cambió su contraseña';
    case 'ACCESO_NO_AUTENTICADO':
      return 'acceso sin sesión válida';
    case 'ACCESO_DENEGADO':
      return recurso === 'menor'
        ? 'acceso denegado a un expediente'
        : 'acceso denegado';
    case 'ORIGEN_RECHAZADO':
      return 'solicitud rechazada desde otro origen';
    case 'USUARIO_CREADO':
      return `creó la cuenta de ${afectado} (${NOMBRES_ROLES[detalle.rol] ?? detalle.rol})`;
    case 'USUARIO_ACTUALIZADO':
      if (detalle.rol) return `cambió el rol de ${afectado}`;
      if (detalle.activo === false) return `desactivó la cuenta de ${afectado}`;
      if (detalle.activo === true) return `activó la cuenta de ${afectado}`;
      return `actualizó la cuenta de ${afectado}`;
    case 'PASSWORD_TEMPORAL_ASIGNADA':
      return `asignó una contraseña temporal a ${afectado}`;
    default:
      return accion;
  }
}
