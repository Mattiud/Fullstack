// Íconos de línea del menú lateral (en los mockups, el recuadro .wf-ic antes de cada
// sección). SVG en línea, sin dependencias: toman el color del texto (currentColor)
// y son decorativos, por lo que no alteran el nombre accesible del enlace.

const TRAZOS = {
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  menores: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2c2.8.3 5 2.7 5 5.8" />
    </>
  ),
  diagnosticos: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M8.5 10h7M8.5 14h7M8.5 18h4" />
    </>
  ),
  sesiones: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  informes: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  tiposDiagnostico: (
    <>
      <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  configuracionInformes: (
    <>
      <path d="M13 3H6.5a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6.5 21H11" />
      <path d="M13 3l5 5h-5z" />
      <path d="M8.5 12h4M8.5 15.5h2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M17 13.2v1.3M17 19.5v1.3M20.8 17h-1.3M14.5 17h-1.3M19.7 14.3l-.9.9M15.2 18.8l-.9.9M19.7 19.7l-.9-.9M15.2 15.2l-.9-.9" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.6 2.9-6.5 6.5-6.5 1.2 0 2.3.3 3.2.9" />
      <path d="M18 13l3.5 1.4v2.6c0 2.1-1.5 3.6-3.5 4.3-2-.7-3.5-2.2-3.5-4.3v-2.6z" />
    </>
  ),
};

export default function IconoNavegacion({ nombre }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
