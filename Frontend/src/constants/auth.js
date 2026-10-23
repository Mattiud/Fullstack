// Deben coincidir con Backend/src/config/roles.js (lo verifica permisos.test.js).
// Los permisos reales los aplica el backend; en el frontend solo determinan qué se muestra.
export const PERMISOS = {
  USUARIOS_GESTIONAR: 'usuarios:gestionar',
  AUDITORIA_LEER: 'auditoria:leer',
  EXPEDIENTES_LEER: 'expedientes:leer',
  EXPEDIENTES_TODOS: 'expedientes:todos',
  EXPEDIENTES_ESCRIBIR: 'expedientes:escribir',
  EXPEDIENTES_ASIGNAR: 'expedientes:asignar',
  DIAGNOSTICOS_EDITAR: 'diagnosticos:editar',
  INFORMES_EMITIR: 'informes:emitir',
  HISTORIAL_LEER: 'historial:leer',
};

export const ROLES = {
  ADMIN: 'admin',
  PSICOPEDAGOGO: 'psicopedagogo',
};

export const NOMBRES_ROLES = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.PSICOPEDAGOGO]: 'Psicopedagogo',
};

export const PERMISOS_POR_ROL = {
  [ROLES.ADMIN]: [
    PERMISOS.USUARIOS_GESTIONAR,
    PERMISOS.AUDITORIA_LEER,
    PERMISOS.EXPEDIENTES_LEER,
    PERMISOS.EXPEDIENTES_TODOS,
    PERMISOS.EXPEDIENTES_ASIGNAR,
    PERMISOS.HISTORIAL_LEER,
  ],
  [ROLES.PSICOPEDAGOGO]: [
    PERMISOS.EXPEDIENTES_LEER,
    PERMISOS.EXPEDIENTES_ESCRIBIR,
    PERMISOS.DIAGNOSTICOS_EDITAR,
    PERMISOS.INFORMES_EMITIR,
    PERMISOS.HISTORIAL_LEER,
  ],
};

// Filas de la matriz de permisos del mockup 1k.
export const MATRIZ_PERMISOS = [
  { accion: 'Ver fichas de menores', permiso: PERMISOS.EXPEDIENTES_LEER },
  { accion: 'Editar diagnósticos', permiso: PERMISOS.DIAGNOSTICOS_EDITAR },
  { accion: 'Emitir informes', permiso: PERMISOS.INFORMES_EMITIR },
  { accion: 'Crear usuarios', permiso: PERMISOS.USUARIOS_GESTIONAR },
  { accion: 'Ver historial de cambios', permiso: PERMISOS.HISTORIAL_LEER },
];
