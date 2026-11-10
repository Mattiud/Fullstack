// Dimensiones del logo dentro de su caja, conservando la proporción (igual que el PDF
// generado en Backend/src/utils/informePdf.js). Sin dimensiones conocidas, usa la caja.
export function ajustarLogo(caja, dimensiones) {
  if (!dimensiones?.ancho || !dimensiones?.alto) return caja;
  const escala = Math.min(
    caja.ancho / dimensiones.ancho,
    caja.alto / dimensiones.alto
  );
  return {
    ancho: dimensiones.ancho * escala,
    alto: dimensiones.alto * escala,
  };
}
