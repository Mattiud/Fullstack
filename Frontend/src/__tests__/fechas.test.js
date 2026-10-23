import {
  fechaParaCampo,
  formatearDia,
  formatearFecha,
  hoyParaCampo,
} from '../utils/formato';
import { edadDesde, validarFecha } from '../utils/validacion';

describe('formato de fechas en la interfaz (DD/MM/AAAA)', () => {
  test('formatearFecha muestra día, mes, año completo y hora local en 24 h', () => {
    expect(formatearFecha(new Date(2026, 9, 23, 15, 5))).toBe(
      '23/10/2026 15:05'
    );
    expect(formatearFecha(new Date(2026, 0, 2, 9, 0).toISOString())).toBe(
      '02/01/2026 09:00'
    );
  });

  test('formatearDia usa la fecha guardada a medianoche UTC sin desplazarla', () => {
    expect(formatearDia('2016-03-12T00:00:00.000Z')).toBe('12/03/2016');
    expect(formatearDia('2026-12-31T00:00:00.000Z')).toBe('31/12/2026');
  });

  test('valores vacíos o no válidos se muestran como guion', () => {
    for (const valor of [null, undefined, '', 'no-es-fecha']) {
      expect(formatearFecha(valor)).toBe('—');
      expect(formatearDia(valor)).toBe('—');
      expect(fechaParaCampo(valor)).toBe('');
    }
  });

  test('los campos de tipo fecha siguen recibiendo AAAA-MM-DD', () => {
    expect(fechaParaCampo('2016-03-12T00:00:00.000Z')).toBe('2016-03-12');
  });
});

describe('fecha de hoy y validación con el reloj local', () => {
  afterEach(() => jest.useRealTimers());

  test('hoyParaCampo usa la fecha local, no la de UTC', () => {
    expect(hoyParaCampo(new Date(2026, 9, 23, 22, 30))).toBe('2026-10-23');
    expect(hoyParaCampo(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  test('una fecha posterior a hoy (local) es futura, aunque en UTC ya sea ese día', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 23, 22, 30));
    const opciones = { etiqueta: 'La fecha de ingreso' };
    expect(validarFecha('2026-10-23', opciones)).toBeNull();
    expect(validarFecha('2026-10-24', opciones)).toBe(
      'La fecha de ingreso no puede ser futura'
    );
  });

  test('rechaza fechas inexistentes igual que el backend', () => {
    const opciones = { etiqueta: 'La fecha de ingreso' };
    expect(validarFecha('2026-02-30', opciones)).toBe(
      'La fecha de ingreso no es una fecha válida'
    );
    expect(edadDesde('2026-02-30')).toBeNull();
  });

  test('la edad cambia el día del cumpleaños según la fecha local', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 23, 22, 30));
    expect(edadDesde('2008-10-24')).toBe(17);
    expect(edadDesde('2008-10-23')).toBe(18);
  });
});
