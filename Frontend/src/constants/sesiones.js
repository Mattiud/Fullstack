// Deben coincidir con Backend/src/models/Sesion.js.
export const ESTADOS_SESION = {
  BORRADOR: 'borrador',
  PLANIFICADA: 'planificada',
};

export const NOMBRES_ESTADOS_SESION = {
  [ESTADOS_SESION.BORRADOR]: 'Borrador',
  [ESTADOS_SESION.PLANIFICADA]: 'Planificada',
};

// Opciones del bloque "Registro post-sesión" del mockup 1h.
export const ASISTENCIAS = [
  { valor: 'asistio', etiqueta: 'Asistió' },
  { valor: 'inasistencia', etiqueta: 'Inasistencia' },
  { valor: 'reagendada', etiqueta: 'Reagendada' },
];

export const NOMBRES_ASISTENCIA = Object.fromEntries(
  ASISTENCIAS.map(({ valor, etiqueta }) => [valor, etiqueta])
);

export const LIMITES_SESION = {
  objetivo: 300,
  objetivos: 10,
  actividad: 300,
  actividades: 15,
  observaciones: 5000,
};

// "09:00 – 09:45", o "—" si falta alguna hora.
export function horario(sesion) {
  return sesion.horaInicio && sesion.horaFin
    ? `${sesion.horaInicio} – ${sesion.horaFin}`
    : '—';
}

// "objetivos 2/3" una vez registrado el resultado; antes, la cantidad planificada.
export function resumenObjetivos(sesion) {
  const { totalObjetivos, objetivosLogrados } = sesion;
  if (sesion.asistencia || objetivosLogrados > 0) {
    return `objetivos ${objetivosLogrados}/${totalObjetivos}`;
  }
  return totalObjetivos === 1 ? '1 objetivo' : `${totalObjetivos} objetivos`;
}

// Colores de los estados (claves de theme.colores). «Planificada» usa el color
// principal de la página; la asistencia, los colores de éxito, error y advertencia.
export const TONOS_SESION = {
  planificada: { borde: 'primario', texto: 'primario', fondo: 'lateral' },
  asistio: { borde: 'exito', texto: 'exito', fondo: 'exitoFondo' },
  inasistencia: { borde: 'errorBorde', texto: 'error', fondo: 'errorFondo' },
  reagendada: {
    borde: 'advertenciaBorde',
    texto: 'advertencia',
    fondo: 'advertenciaFondo',
  },
};

// Duración que se propone para la hora de término (mockup 1h: 09:00 – 09:45).
export const DURACION_PREDETERMINADA_MIN = 45;

// Suma minutos a una hora HH:mm. Devuelve '' si el resultado pasa de medianoche, para
// no proponer una hora de término anterior a la de inicio.
export function sumarMinutos(hora, minutos) {
  const coincide = /^(\d{2}):(\d{2})$/.exec(hora ?? '');
  if (!coincide) return '';
  const total = Number(coincide[1]) * 60 + Number(coincide[2]) + minutos;
  if (total >= 24 * 60) return '';
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
}
