// Edad cronológica en años y meses cumplidos a la fecha de referencia. Misma lógica que
// edadCronologica en Backend/src/utils/validators.js (fechas sin hora, en UTC).
export function edadCronologica(fechaNacimiento, referencia) {
  const nacimiento = new Date(fechaNacimiento);
  const fecha = new Date(referencia);
  if (Number.isNaN(nacimiento.getTime()) || Number.isNaN(fecha.getTime())) {
    return null;
  }
  let meses =
    (fecha.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 +
    (fecha.getUTCMonth() - nacimiento.getUTCMonth());
  const ultimoDiaMes = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)
  ).getUTCDate();
  if (fecha.getUTCDate() < Math.min(nacimiento.getUTCDate(), ultimoDiaMes)) {
    meses -= 1;
  }
  if (meses < 0) return null;
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
}

export function formatearEdadCronologica(edad) {
  if (!edad) return '';
  const anios = `${edad.anios} ${edad.anios === 1 ? 'año' : 'años'}`;
  const meses = `${edad.meses} ${edad.meses === 1 ? 'mes' : 'meses'}`;
  if (edad.anios === 0) return meses;
  return edad.meses === 0 ? anios : `${anios} y ${meses}`;
}
