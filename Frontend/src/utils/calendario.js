import { formatearDia } from './formato';

// Fechas del calendario como texto AAAA-MM-DD, calculadas en UTC: las fechas de las
// sesiones se guardan a medianoche UTC, así que no dependen de la zona horaria local.

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const aFecha = (texto) => new Date(`${texto}T00:00:00.000Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

export function esFechaValida(texto) {
  return (
    typeof texto === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(texto) &&
    !Number.isNaN(aFecha(texto).getTime()) &&
    aTexto(aFecha(texto)) === texto
  );
}

export function sumarDias(texto, dias) {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aTexto(fecha);
}

// Primer día del mes que está `meses` meses antes o después.
export function sumarMeses(texto, meses) {
  const fecha = aFecha(texto);
  return aTexto(
    new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1))
  );
}

// 0 = lunes … 6 = domingo.
export function diaDeLaSemana(texto) {
  return (aFecha(texto).getUTCDay() + 6) % 7;
}

export function inicioSemana(texto) {
  return sumarDias(texto, -diaDeLaSemana(texto));
}

// Los 7 días (lunes a domingo) de la semana de `texto`.
export function diasSemana(texto) {
  const lunes = inicioSemana(texto);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

// Grilla del mes: 6 semanas de lunes a domingo (42 días) desde el lunes de la semana
// del día 1.
export function semanasMes(texto) {
  const inicio = inicioSemana(sumarMeses(texto, 0));
  return Array.from({ length: 6 }, (_, semana) =>
    Array.from({ length: 7 }, (_, dia) => sumarDias(inicio, semana * 7 + dia))
  );
}

export function mismoMes(a, b) {
  return a.slice(0, 7) === b.slice(0, 7);
}

// "Noviembre 2026".
export function nombreMes(texto) {
  const fecha = aFecha(texto);
  return `${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
}

// "Lun 16/11".
export function etiquetaDia(texto) {
  return `${DIAS_CORTOS[diaDeLaSemana(texto)]} ${formatearDia(texto).slice(0, 5)}`;
}

export function nombreDia(texto) {
  return DIAS_CORTOS[diaDeLaSemana(texto)];
}

export function minutosDe(hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

// Reparte en carriles las sesiones de un día que se superponen, para mostrarlas lado
// a lado. Devuelve, por _id, el carril de la sesión y cuántos carriles tiene su grupo.
export function asignarCarriles(sesiones) {
  const ordenadas = [...sesiones].sort(
    (a, b) =>
      minutosDe(a.horaInicio) - minutosDe(b.horaInicio) ||
      minutosDe(a.horaFin) - minutosDe(b.horaFin)
  );
  const resultado = new Map();
  let grupo = [];
  let finesCarril = [];
  let finGrupo = -1;

  const cerrarGrupo = () => {
    for (const id of grupo) resultado.get(id).carriles = finesCarril.length;
    grupo = [];
    finesCarril = [];
  };

  for (const sesion of ordenadas) {
    const inicio = minutosDe(sesion.horaInicio);
    const fin = minutosDe(sesion.horaFin);
    if (inicio >= finGrupo) {
      cerrarGrupo();
      finGrupo = -1;
    }
    let carril = finesCarril.findIndex((finCarril) => finCarril <= inicio);
    if (carril === -1) {
      carril = finesCarril.length;
      finesCarril.push(fin);
    } else {
      finesCarril[carril] = fin;
    }
    resultado.set(sesion._id, { carril, carriles: 0 });
    grupo.push(sesion._id);
    finGrupo = Math.max(finGrupo, fin);
  }
  cerrarGrupo();
  return resultado;
}
