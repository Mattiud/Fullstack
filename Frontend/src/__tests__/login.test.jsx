import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import { LOGO_LOGIN } from '../constants/marca';
import { errorHttp, renderApp } from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');

const NOMBRE = 'Sistema de Gestión de Información Psicopedagógica';

async function abrirLogin() {
  authApi.obtenerSesion.mockResolvedValue(null);
  renderApp('/login');
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
}

describe('Pantalla de inicio de sesión', () => {
  test('busca el logo WebP configurado y, mientras carga, muestra la marca de texto', async () => {
    await abrirLogin();
    const logo = screen.getByAltText('Logo de la organización');
    expect(LOGO_LOGIN).toMatch(/\.webp$/);
    expect(logo).toHaveAttribute('src', LOGO_LOGIN);
    expect(screen.getByText('SGP')).toBeInTheDocument();
    expect(screen.getByText(NOMBRE)).toBeInTheDocument();
  });

  test('sin logo disponible no queda una imagen rota ni un espacio vacío', async () => {
    await abrirLogin();
    fireEvent.error(screen.getByAltText('Logo de la organización'));
    expect(
      screen.queryByAltText('Logo de la organización')
    ).not.toBeInTheDocument();
    expect(screen.getByText('SGP')).toBeInTheDocument();
    expect(screen.getByText(NOMBRE)).toBeInTheDocument();
  });

  test('con el logo cargado lo muestra en lugar de la sigla', async () => {
    await abrirLogin();
    fireEvent.load(screen.getByAltText('Logo de la organización'));
    expect(screen.getByAltText('Logo de la organización')).toBeInTheDocument();
    expect(screen.queryByText('SGP')).not.toBeInTheDocument();
    expect(screen.getByText(NOMBRE)).toBeInTheDocument();
  });

  test('el formulario conserva sus validaciones y mensajes de error', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      errorHttp(401, { error: 'Credenciales inválidas' })
    );
    await abrirLogin();

    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByText('Ingrese la contraseña')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'persona@prueba.cl'
    );
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveFicticia1');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(authApi.login).toHaveBeenCalledWith(
      'persona@prueba.cl',
      'ClaveFicticia1'
    );
    expect(
      await screen.findByText('Credenciales inválidas')
    ).toBeInTheDocument();
  });
});
