const { ROLES, PERMISSIONS, hasPermission } = require('../src/config/roles');

// Matriz de permisos del mockup 1k (Gestión de usuarios y roles).
const MATRIZ = [
  ['Ver fichas de menores', PERMISSIONS.EXPEDIENTES_LEER, true, true],
  ['Editar diagnósticos', PERMISSIONS.DIAGNOSTICOS_EDITAR, false, true],
  ['Emitir informes', PERMISSIONS.INFORMES_EMITIR, false, true],
  ['Crear usuarios', PERMISSIONS.USUARIOS_GESTIONAR, true, false],
  ['Ver historial de cambios', PERMISSIONS.HISTORIAL_LEER, true, true],
  ['Consultar el registro de auditoría', PERMISSIONS.AUDITORIA_LEER, true, false],
  ['Acceder a expedientes no asignados', PERMISSIONS.EXPEDIENTES_TODOS, true, false],
];

describe('Matriz de permisos por rol', () => {
  test.each(MATRIZ)('%s', (_accion, permiso, admin, psicopedagogo) => {
    expect(hasPermission(ROLES.ADMIN, permiso)).toBe(admin);
    expect(hasPermission(ROLES.PSICOPEDAGOGO, permiso)).toBe(psicopedagogo);
  });

  test('un rol desconocido no tiene permisos', () => {
    expect(hasPermission('superadmin', PERMISSIONS.USUARIOS_GESTIONAR)).toBe(false);
  });
});
