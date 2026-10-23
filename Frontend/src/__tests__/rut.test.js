import {
  formatearRut,
  limpiarRut,
  posicionTrasSignificativos,
  validarRut,
} from '../utils/rut';

describe('Formato del RUT', () => {
  test.each([
    ['212914541', '21.291.454-1'],
    ['21291454-1', '21.291.454-1'],
    ['21.291.454-1', '21.291.454-1'],
    ['21..291--454-1', '21.291.454-1'],
    ['7654321-6', '7.654.321-6'],
    ['20123456k', '20.123.456-K'],
    ['2', '2'],
    ['21', '2-1'],
    ['2129', '212-9'],
    ['', ''],
  ])('%s → %s', (entrada, esperado) => {
    expect(formatearRut(entrada)).toBe(esperado);
  });

  test('descarta caracteres no válidos y la K que no está al final', () => {
    expect(limpiarRut('2K1.29a1')).toBe('21291');
    expect(limpiarRut('1234567890123')).toBe('123456789');
  });

  test('ubica el cursor tras los caracteres significativos', () => {
    expect(posicionTrasSignificativos('21.291.454-1', 0)).toBe(0);
    expect(posicionTrasSignificativos('21.291.454-1', 2)).toBe(2);
    expect(posicionTrasSignificativos('21.291.454-1', 3)).toBe(4);
    expect(posicionTrasSignificativos('21.291.454-1', 9)).toBe(12);
  });
});

describe('Validación del RUT', () => {
  test.each([
    ['21.291.454-1', null],
    ['21291454-1', null],
    ['12.345.678-5', null],
    ['21.291.454-2', 'El dígito verificador del RUT no es válido'],
    ['123', 'El RUT no tiene un formato válido'],
    ['', 'El RUT es obligatorio'],
  ])('%s', (rut, error) => {
    expect(validarRut(rut)).toBe(error);
  });
});
