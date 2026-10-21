import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import GlobalStyle from './styles/GlobalStyle';
import { AuthProvider } from './context/AuthProvider';
import { PERMISOS } from './constants/auth';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import CambiarPassword from './pages/CambiarPassword';
import NoAutorizado from './pages/NoAutorizado';
import Usuarios from './pages/admin/Usuarios';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Inicio />} />
              <Route path="cambiar-password" element={<CambiarPassword />} />
              <Route path="no-autorizado" element={<NoAutorizado />} />
              <Route
                element={
                  <ProtectedRoute permiso={PERMISOS.USUARIOS_GESTIONAR} />
                }
              >
                <Route path="usuarios" element={<Usuarios />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
