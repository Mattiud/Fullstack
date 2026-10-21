import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Cargando } from './ui';

const RUTA_CAMBIO_PASSWORD = '/cambiar-password';

// Restricción complementaria a la del backend: evita mostrar páginas a usuarios sin
// sesión o sin el permiso requerido. Los datos siguen protegidos por la API.
export default function ProtectedRoute({ permiso, children }) {
  const { usuario, cargando, tienePermiso } = useAuth();
  const location = useLocation();

  if (cargando) {
    return <Cargando role="status">Verificando sesión…</Cargando>;
  }
  if (!usuario) {
    return (
      <Navigate to="/login" replace state={{ desde: location.pathname }} />
    );
  }
  if (
    usuario.debeCambiarPassword &&
    location.pathname !== RUTA_CAMBIO_PASSWORD
  ) {
    return <Navigate to={RUTA_CAMBIO_PASSWORD} replace />;
  }
  if (permiso && !tienePermiso(permiso)) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return children ?? <Outlet />;
}
