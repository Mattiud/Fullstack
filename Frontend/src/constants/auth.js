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
  DIAGNOSTICOS_TIPOS: 'diagnosticos:tipos',
  SESIONES_EDITAR: 'sesiones:editar',
  INFORMES_EMITIR: 'informes:emitir',
  INFORMES_CONFIGURAR: 'informes:configurar',
  HISTORIAL_LEER: 'historial:leer',
};

// Cierre de sesión por inactividad (igual que Backend/src/config/env.js): la sesión se
// cierra tras 12 h sin actividad y se renueva como máximo una vez por hora.
export const INACTIVIDAD_MAXIMA_MS = 12 * 60 * 60 * 1000;
export const RENOVACION_MINIMA_MS = 60 * 60 * 1000;

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
    PERMISOS.DIAGNOSTICOS_TIPOS,
    PERMISOS.INFORMES_CONFIGURAR,
    PERMISOS.HISTORIAL_LEER,
  ],
  [ROLES.PSICOPEDAGOGO]: [
    PERMISOS.EXPEDIENTES_LEER,
    PERMISOS.EXPEDIENTES_ESCRIBIR,
    PERMISOS.DIAGNOSTICOS_EDITAR,
    PERMISOS.SESIONES_EDITAR,
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
