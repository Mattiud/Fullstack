import {
  asignarCarriles,
  diasSemana,
  esFechaValida,
  etiquetaDia,
  inicioSemana,
  nombreMes,
  semanasMes,
  sumarDias,
  sumarMeses,
} from '../utils/calendario';

describe('Fechas del calendario', () => {
  test('la semana empieza el lunes', () => {
    expect(inicioSemana('2026-11-16')).toBe('2026-11-16');
    expect(inicioSemana('2026-11-18')).toBe('2026-11-16');
    // Domingo: pertenece a la semana que empezó el lunes anterior.
    expect(inicioSemana('2026-11-22')).toBe('2026-11-16');
    expect(diasSemana('2026-11-18')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  test('suma días y meses atravesando cambios de mes y de año', () => {
    expect(sumarDias('2026-12-28', 7)).toBe('2027-01-04');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-01');
    expect(sumarMeses('2026-01-31', -1)).toBe('2025-12-01');
  });

  test('la grilla del mes tiene 6 semanas de lunes a domingo', () => {
    const semanas = semanasMes('2026-11-10');
    expect(semanas).toHaveLength(6);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas[0][0]).toBe('2026-10-26');
    expect(semanas[5][6]).toBe('2026-12-06');
  });

  test('etiquetas en español con día y mes DD/MM', () => {
    expect(etiquetaDia('2026-11-16')).toBe('Lun 16/11');
    expect(etiquetaDia('2026-11-22')).toBe('Dom 22/11');
    expect(nombreMes('2026-11-16')).toBe('Noviembre 2026');
  });

  test('valida fechas AAAA-MM-DD', () => {
    expect(esFechaValida('2026-11-16')).toBe(true);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('16/11/2026')).toBe(false);
    expect(esFechaValida(null)).toBe(false);
  });
});

describe('Sesiones superpuestas', () => {
  test('las que se cruzan van en carriles distintos', () => {
    const carriles = asignarCarriles([
      { _id: 'c', horaInicio: '11:00', horaFin: '12:00' },
      { _id: 'a', horaInicio: '09:00', horaFin: '10:00' },
      { _id: 'b', horaInicio: '09:30', horaFin: '10:30' },
      { _id: 'd', horaInicio: '10:00', horaFin: '10:45' },
    ]);
    expect(carriles.get('a')).toEqual({ carril: 0, carriles: 2 });
    expect(carriles.get('b')).toEqual({ carril: 1, carriles: 2 });
    // Empieza cuando termina "a": reutiliza su carril.
    expect(carriles.get('d')).toEqual({ carril: 0, carriles: 2 });
    expect(carriles.get('c')).toEqual({ carril: 0, carriles: 1 });
  });
});
