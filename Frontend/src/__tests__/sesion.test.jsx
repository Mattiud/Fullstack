import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as usersApi from '../api/users';
import * as auditApi from '../api/audit';
import {
  errorHttp,
  renderApp,
  usuarioAdmin,
  usuarioPsico,
} from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');

describe('Inicio de sesión', () => {
  beforeEach(() => {
    authApi.obtenerSesion.mockResolvedValue(null);
  });

  test('un usuario sin sesión es redirigido al formulario de inicio de sesión', async () => {
    renderApp('/usuarios');

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' })
    ).toBeInTheDocument();
    expect(usersApi.listarUsuarios).not.toHaveBeenCalled();
  });

  test('valida los campos antes de enviar', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(screen.getByText('Ingrese el correo')).toBeInTheDocument();
    expect(screen.getByText('Ingrese la contraseña')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Correo institucional'),
      'correo-invalido'
    );
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByText('Ingrese un correo válido')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  test('muestra el mensaje genérico del servidor ante credenciales incorrectas', async () => {
    authApi.login.mockRejectedValue(
      errorHttp(401, { error: 'Credenciales inválidas' })
    );
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(
      await screen.findByLabelText('Correo institucional'),
      'admin@prueba.cl'
    );
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveIncorrecta1');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales inválidas'
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  test('permite mostrar y ocultar la contraseña', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    const password = await screen.findByLabelText('Contraseña');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  test('no ofrece registro público ni recuperación de contraseña', async () => {
    renderApp('/login');

    expect(
      await screen.findByText(
        'Si olvidó su contraseña, contacte al administrador.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/olvidaste/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recordarme/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /registr/i })
    ).not.toBeInTheDocument();
  });

  test('deshabilita el botón mientras se envían las credenciales', async () => {
    authApi.login.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(
      await screen.findByLabelText('Correo institucional'),
      'admin@prueba.cl'
    );
    await user.type(screen.getByLabelText('Contraseña'), 'ClavePrueba123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled();
  });

  test('tras iniciar sesión vuelve a la página solicitada', async () => {
    authApi.login.mockResolvedValue(usuarioAdmin);
    usersApi.listarUsuarios.mockResolvedValue([usuarioAdmin]);
    auditApi.listarAuditoria.mockResolvedValue([]);
    const user = userEvent.setup();
    renderApp('/usuarios');

    await user.type(
      await screen.findByLabelText('Correo institucional'),
      'admin@prueba.cl'
    );
    await user.type(screen.getByLabelText('Contraseña'), 'ClavePrueba123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(
      await screen.findByRole('heading', { name: 'Usuarios y roles' })
    ).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith(
      'admin@prueba.cl',
      'ClavePrueba123'
    );
  });
});

describe('Sesión', () => {
  test('recupera la sesión al recargar la aplicación', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioPsico);
    renderApp('/');

    expect(screen.getByRole('status')).toHaveTextContent('Verificando sesión');
    expect(
      await screen.findByRole('heading', {
        name: `Hola, ${usuarioPsico.nombre}`,
      })
    ).toBeInTheDocument();
    expect(authApi.obtenerSesion).toHaveBeenCalledTimes(1);
  });

  test('no guarda datos de sesión en localStorage ni sessionStorage', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioPsico);
    renderApp('/');

    await screen.findByRole('heading', {
      name: `Hola, ${usuarioPsico.nombre}`,
    });
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  test('cierra la sesión desde la interfaz', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioPsico);
    authApi.logout.mockResolvedValue();
    const user = userEvent.setup();
    renderApp('/');

    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión' })
    );

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' })
    ).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });

  test('cierra la sesión local aunque falle la solicitud al servidor', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioPsico);
    authApi.logout.mockRejectedValue(new Error('Sin conexión'));
    const user = userEvent.setup();
    renderApp('/');

    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión' })
    );

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' })
    ).toBeInTheDocument();
  });
});

describe('Contraseña temporal', () => {
  const usuarioTemporal = { ...usuarioPsico, debeCambiarPassword: true };

  test('obliga a cambiarla antes de acceder a otras páginas', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioTemporal);
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Cambiar contraseña' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Inicio' })
    ).not.toBeInTheDocument();
  });

  test('valida el formulario y continúa tras cambiarla', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioTemporal);
    authApi.cambiarPassword.mockResolvedValue(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/');

    await user.type(
      await screen.findByLabelText('Contraseña actual'),
      'Temporal2024x'
    );
    await user.type(screen.getByLabelText('Nueva contraseña'), 'corta');
    await user.click(
      screen.getByRole('button', { name: 'Guardar contraseña' })
    );
    expect(
      screen.getByText('Debe tener al menos 10 caracteres')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Las contraseñas no coinciden')
    ).toBeInTheDocument();
    expect(authApi.cambiarPassword).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Nueva contraseña'));
    await user.type(
      screen.getByLabelText('Nueva contraseña'),
      'NuevaClave2024'
    );
    await user.type(
      screen.getByLabelText('Repita la nueva contraseña'),
      'NuevaClave2024'
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar contraseña' })
    );

    await waitFor(() =>
      expect(authApi.cambiarPassword).toHaveBeenCalledWith(
        'Temporal2024x',
        'NuevaClave2024'
      )
    );
    expect(
      await screen.findByRole('heading', {
        name: `Hola, ${usuarioPsico.nombre}`,
      })
    ).toBeInTheDocument();
  });
});
