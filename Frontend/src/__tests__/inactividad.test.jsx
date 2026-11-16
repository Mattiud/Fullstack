import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import * as authApi from '../api/auth';
import client, { registrarVencimiento } from '../api/client';
import { INACTIVIDAD_MAXIMA_MS } from '../constants/auth';
import { renderApp, usuarioAdmin, usuarioPsico } from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');
// API que consulta el panel de inicio.
jest.mock('../api/menores');
jest.mock('../api/diagnosticos');
jest.mock('../api/sesiones');
jest.mock('../api/informes');
jest.mock('../api/actividad');

const HORA = 60 * 60 * 1000;
const AVISO = /Su sesión se cerró tras 12 horas de inactividad/;

// El servidor informa el vencimiento en cada respuesta (encabezado X-Sesion-Vence).
function informarVencimiento(msDesdeAhora) {
  act(() => {
    registrarVencimiento(new Date(Date.now() + msDesdeAhora).toISOString());
  });
}

async function iniciar(usuario = usuarioPsico) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
  const resultado = renderApp('/');
  await screen.findByRole('heading', { name: 'Panel de inicio' });
  return resultado;
}

afterEach(() => {
  client.defaults.adapter = undefined;
});

describe('Cierre de sesión por inactividad', () => {
  test.each([
    ['psicopedagogo', usuarioPsico],
    ['administrador', usuarioAdmin],
  ])(
    'al vencer, el %s vuelve al inicio de sesión con un aviso',
    async (_rol, usuario) => {
      const { router } = await iniciar(usuario);
      // Al comprobar con el servidor, la sesión ya no es válida.
      authApi.obtenerSesion.mockResolvedValue(null);
      informarVencimiento(50);

      expect(
        await screen.findByRole('heading', { name: 'Iniciar sesión' })
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(AVISO);
      expect(router.state.location.pathname).toBe('/login');
      // La comprobación es automática: no cuenta como actividad.
      expect(authApi.obtenerSesion).toHaveBeenCalledTimes(2);
    }
  );

  test('si otra pestaña renovó la sesión, no se cierra', async () => {
    await iniciar();
    authApi.obtenerSesion.mockImplementation(async () => {
      // El servidor responde con el nuevo vencimiento.
      registrarVencimiento(new Date(Date.now() + 10 * HORA).toISOString());
      return usuarioPsico;
    });
    informarVencimiento(50);

    await waitFor(() => expect(authApi.obtenerSesion).toHaveBeenCalledTimes(2));
    await new Promise((resolver) => setTimeout(resolver, 300));
    expect(
      screen.getByRole('heading', { name: 'Panel de inicio' })
    ).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  test('la interacción informa actividad como máximo una vez por hora', async () => {
    authApi.registrarActividad.mockResolvedValue();
    await iniciar();

    // Renovada hace 30 minutos: todavía no corresponde informar.
    informarVencimiento(INACTIVIDAD_MAXIMA_MS - HORA / 2);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.pointerDown(window);
    expect(authApi.registrarActividad).not.toHaveBeenCalled();

    // Renovada hace 2 horas: la interacción mantiene abierta la sesión.
    informarVencimiento(INACTIVIDAD_MAXIMA_MS - 2 * HORA);
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() =>
      expect(authApi.registrarActividad).toHaveBeenCalledTimes(1)
    );
  });

  test('un rechazo por inactividad en cualquier solicitud cierra con aviso', async () => {
    const { router } = await iniciar();
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Error', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        data: {
          error:
            'Su sesión se cerró por inactividad. Inicie sesión nuevamente.',
          codigo: 'SESION_EXPIRADA',
        },
        headers: {},
        config,
      });
    };
    await act(async () => {
      await expect(client.get('/menores')).rejects.toBeInstanceOf(AxiosError);
    });

    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(AVISO);
    expect(router.state.location.pathname).toBe('/login');
  });

  test('cerrar sesión manualmente no muestra el aviso de inactividad', async () => {
    authApi.logout.mockResolvedValue();
    await iniciar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' })
    ).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});
