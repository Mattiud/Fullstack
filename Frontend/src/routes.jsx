import { Navigate } from 'react-router-dom';
import App from './App';
import { PERMISOS } from './constants/auth';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import CambiarPassword from './pages/CambiarPassword';
import NoAutorizado from './pages/NoAutorizado';
import Usuarios from './pages/admin/Usuarios';
import ListadoMenores from './pages/menores/ListadoMenores';
import FichaMenor from './pages/menores/FichaMenor';
import FormularioMenor from './pages/menores/FormularioMenor';
import ListadoDiagnosticos from './pages/diagnosticos/ListadoDiagnosticos';
import DetalleDiagnostico from './pages/diagnosticos/DetalleDiagnostico';
import TiposDiagnostico from './pages/admin/TiposDiagnostico';
import ListadoSesiones from './pages/sesiones/ListadoSesiones';
import FormularioSesion from './pages/sesiones/FormularioSesion';

// Rutas para el enrutador de datos (necesario para avisar de cambios sin guardar).
export const rutas = [
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'login', element: <Login /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Inicio /> },
              { path: 'cambiar-password', element: <CambiarPassword /> },
              { path: 'no-autorizado', element: <NoAutorizado /> },
              {
                element: <ProtectedRoute permiso={PERMISOS.EXPEDIENTES_LEER} />,
                children: [
                  { path: 'menores', element: <ListadoMenores /> },
                  { path: 'menores/:menorId', element: <FichaMenor /> },
                  { path: 'diagnosticos', element: <ListadoDiagnosticos /> },
                  {
                    path: 'menores/:menorId/diagnosticos/:diagnosticoId',
                    element: <DetalleDiagnostico />,
                  },
                  { path: 'sesiones', element: <ListadoSesiones /> },
                  {
                    path: 'menores/:menorId/sesiones/:sesionId',
                    element: <FormularioSesion />,
                  },
                ],
              },
              {
                element: (
                  <ProtectedRoute permiso={PERMISOS.EXPEDIENTES_ESCRIBIR} />
                ),
                children: [
                  { path: 'menores/nuevo', element: <FormularioMenor /> },
                  {
                    path: 'menores/:menorId/editar',
                    element: <FormularioMenor />,
                  },
                ],
              },
              {
                element: <ProtectedRoute permiso={PERMISOS.SESIONES_EDITAR} />,
                children: [
                  { path: 'sesiones/nueva', element: <FormularioSesion /> },
                ],
              },
              {
                element: (
                  <ProtectedRoute permiso={PERMISOS.DIAGNOSTICOS_TIPOS} />
                ),
                children: [
                  { path: 'tipos-diagnostico', element: <TiposDiagnostico /> },
                ],
              },
              {
                element: (
                  <ProtectedRoute permiso={PERMISOS.USUARIOS_GESTIONAR} />
                ),
                children: [{ path: 'usuarios', element: <Usuarios /> }],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
