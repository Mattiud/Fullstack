import { AxiosError } from 'axios';
import client, { mensajeDeError, setUnauthorizedHandler } from '../api/client';

// Simula respuestas del servidor sin realizar solicitudes reales.
function responderCon(status) {
  client.defaults.adapter = async (config) => {
    throw new AxiosError('Error', 'ERR_BAD_REQUEST', config, null, {
      status,
      data: { error: 'Debe iniciar sesión' },
      headers: {},
      config,
    });
  };
}

describe('Cliente de la API', () => {
  test('usa el mismo origen y envía la cookie de sesión', () => {
    expect(client.defaults.baseURL).toBe('/api');
    expect(client.defaults.withCredentials).toBe(true);
  });

  test('un 401 en una ruta protegida cierra la sesión local', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    responderCon(401);

    await expect(client.get('/users')).rejects.toBeInstanceOf(AxiosError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('un 401 al iniciar sesión o comprobar la sesión no dispara el cierre', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    responderCon(401);

    await expect(client.post('/auth/login', {})).rejects.toBeInstanceOf(
      AxiosError
    );
    await expect(client.get('/auth/me')).rejects.toBeInstanceOf(AxiosError);
    expect(handler).not.toHaveBeenCalled();
  });

  test('un 403 no cierra la sesión', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    responderCon(403);

    await expect(client.get('/users')).rejects.toBeInstanceOf(AxiosError);
    expect(handler).not.toHaveBeenCalled();
  });

  test('mensajeDeError usa el mensaje del servidor o uno genérico', () => {
    expect(
      mensajeDeError({
        response: { data: { error: 'Credenciales inválidas' } },
      })
    ).toBe('Credenciales inválidas');
    expect(mensajeDeError({ request: {} })).toBe(
      'No se pudo conectar con el servidor'
    );
    expect(mensajeDeError(new Error('interno'), 'Mensaje genérico')).toBe(
      'Mensaje genérico'
    );
  });
});
