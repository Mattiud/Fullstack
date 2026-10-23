import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { rutas } from './routes';

// Datos ficticios para las pruebas.
export const usuarioAdmin = {
  _id: 'admin-1',
  nombre: 'Admin Ficticio',
  email: 'admin@prueba.cl',
  rol: 'admin',
  activo: true,
  debeCambiarPassword: false,
  ultimoAcceso: '2026-10-21T11:52:00.000Z',
  permisos: [
    'usuarios:gestionar',
    'auditoria:leer',
    'expedientes:leer',
    'expedientes:todos',
    'expedientes:asignar',
    'historial:leer',
  ],
};

export const usuarioPsico = {
  _id: 'psico-1',
  nombre: 'Profesional Ficticio',
  email: 'profesional@prueba.cl',
  rol: 'psicopedagogo',
  activo: true,
  debeCambiarPassword: false,
  permisos: [
    'expedientes:leer',
    'expedientes:escribir',
    'diagnosticos:editar',
    'informes:emitir',
    'historial:leer',
  ],
};

export function errorHttp(status, data) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data },
  });
}

export function renderApp(ruta = '/') {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  return { router, ...render(<RouterProvider router={router} />) };
}
