const ROLES = Object.freeze({
  ADMIN: 'admin',
  PSICOPEDAGOGO: 'psicopedagogo',
});

const PERMISSIONS = Object.freeze({
  USUARIOS_GESTIONAR: 'usuarios:gestionar',
  // Registro global de accesos y cambios.
  AUDITORIA_LEER: 'auditoria:leer',
  // Ver fichas de menores.
  EXPEDIENTES_LEER: 'expedientes:leer',
  // Acceso a todos los expedientes, sin necesidad de estar asignado al menor.
  EXPEDIENTES_TODOS: 'expedientes:todos',
  // Registrar menores, editar sus fichas y gestionar sus documentos.
  EXPEDIENTES_ESCRIBIR: 'expedientes:escribir',
  // Asignar o quitar los profesionales responsables de cada menor.
  EXPEDIENTES_ASIGNAR: 'expedientes:asignar',
  DIAGNOSTICOS_EDITAR: 'diagnosticos:editar',
  INFORMES_EMITIR: 'informes:emitir',
  // Historial de cambios de los expedientes a los que se tiene acceso.
  HISTORIAL_LEER: 'historial:leer',
});

// Matriz de permisos del mockup 1k (Gestión de usuarios y roles): el administrador
// consulta las fichas pero no modifica información clínica.
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze([
    PERMISSIONS.USUARIOS_GESTIONAR,
    PERMISSIONS.AUDITORIA_LEER,
    PERMISSIONS.EXPEDIENTES_LEER,
    PERMISSIONS.EXPEDIENTES_TODOS,
    PERMISSIONS.EXPEDIENTES_ASIGNAR,
    PERMISSIONS.HISTORIAL_LEER,
  ]),
  [ROLES.PSICOPEDAGOGO]: Object.freeze([
    PERMISSIONS.EXPEDIENTES_LEER,
    PERMISSIONS.EXPEDIENTES_ESCRIBIR,
    PERMISSIONS.DIAGNOSTICOS_EDITAR,
    PERMISSIONS.INFORMES_EMITIR,
    PERMISSIONS.HISTORIAL_LEER,
  ]),
});

function permisosDeRol(rol) {
  return ROLE_PERMISSIONS[rol] || [];
}

function hasPermission(rol, permiso) {
  return permisosDeRol(rol).includes(permiso);
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, permisosDeRol, hasPermission };
