import { PERMISOS, PERMISOS_POR_ROL, NOMBRES_ROLES } from '../constants/auth';

// Las constantes del frontend deben reflejar exactamente los permisos que aplica el backend.
const backend = require('../../../Backend/src/config/roles.js');

describe('Permisos del frontend sincronizados con el backend', () => {
  test('los mismos permisos', () => {
    expect(Object.values(PERMISOS).sort()).toEqual(
      Object.values(backend.PERMISSIONS).sort()
    );
  });

  test('los mismos roles', () => {
    expect(Object.keys(NOMBRES_ROLES).sort()).toEqual(
      Object.values(backend.ROLES).sort()
    );
  });

  test.each(Object.values(backend.ROLES))(
    'los mismos permisos para el rol %s',
    (rol) => {
      expect([...PERMISOS_POR_ROL[rol]].sort()).toEqual(
        [...backend.ROLE_PERMISSIONS[rol]].sort()
      );
    }
  );
});
