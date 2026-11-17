// Íconos de línea para botones y acciones, con la misma convención de
// IconoNavegacion (24 × 24, trazo 1,8, currentColor). Son decorativos: el nombre
// accesible lo da el texto del botón o su aria-label. El tamaño lo fija el botón
// que los contiene (ver components/ui.js).

const TRAZOS = {
  agregar: <path d="M12 5v14M5 12h14" />,
  editar: (
    <>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  eliminar: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
    </>
  ),
  ver: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  descargar: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </>
  ),
  subirArchivo: (
    <>
      <path d="M12 15V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 19h14" />
    </>
  ),
  pdf: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </>
  ),
  ampliar: (
    <>
      <path d="M14 4h6v6M10 20H4v-6" />
      <path d="M20 4l-6.5 6.5M4 20l6.5-6.5" />
    </>
  ),
  volver: (
    <>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  anterior: <path d="M15 5l-7 7 7 7" />,
  siguiente: <path d="M9 5l7 7-7 7" />,
  subir: (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  bajar: (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  desactivar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  activar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
    </>
  ),
  confirmar: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  recargar: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
};

export default function Icono({ nombre }) {
  return (
    <svg
      className="icono"
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
