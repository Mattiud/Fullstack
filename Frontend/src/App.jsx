import { Outlet } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import GlobalStyle from './styles/GlobalStyle';
import { AuthProvider } from './context/AuthProvider';
import { NotificacionesProvider } from './context/NotificacionesProvider';

// Raíz de la aplicación: tema, estilos globales, avisos y sesión. Las rutas están en
// routes.jsx.
function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <NotificacionesProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </NotificacionesProvider>
    </ThemeProvider>
  );
}

export default App;
