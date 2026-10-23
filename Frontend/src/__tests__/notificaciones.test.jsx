import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { theme } from '../styles/theme';
import { NotificacionesProvider } from '../context/NotificacionesProvider';
import { useNotificaciones } from '../context/useNotificaciones';

let api;
function Capturar() {
  api = useNotificaciones();
  return <button type="button">Elemento previo</button>;
}

function montar() {
  render(
    <ThemeProvider theme={theme}>
      <NotificacionesProvider>
        <Capturar />
      </NotificacionesProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  jest.useRealTimers();
});

describe('Notificaciones', () => {
  test('distingue éxito, advertencia y error', () => {
    montar();
    act(() => {
      api.notificar({
        tipo: 'exito',
        mensaje: 'Cambios guardados correctamente',
      });
      api.notificar({ tipo: 'advertencia', mensaje: 'Revise los campos' });
      api.notificar({
        tipo: 'error',
        mensaje: 'No fue posible guardar los cambios',
      });
    });

    expect(screen.getByRole('status')).toHaveTextContent('Éxito:');
    const alertas = screen.getAllByRole('alert');
    expect(alertas[0]).toHaveTextContent('Advertencia:');
    expect(alertas[1]).toHaveTextContent('Error:');
  });

  test('no duplica un aviso igual que ya está visible', () => {
    montar();
    act(() => {
      api.notificar({
        tipo: 'exito',
        mensaje: 'Documento eliminado correctamente',
      });
      api.notificar({
        tipo: 'exito',
        mensaje: 'Documento eliminado correctamente',
      });
    });
    expect(
      screen.getAllByText('Documento eliminado correctamente')
    ).toHaveLength(1);
  });

  test('los avisos de éxito se cierran solos y los de error quedan hasta cerrarlos', async () => {
    jest.useFakeTimers();
    montar();
    act(() => {
      api.notificar({ tipo: 'exito', mensaje: 'Listo' });
      api.notificar({ tipo: 'error', mensaje: 'Falló' });
    });

    act(() => jest.advanceTimersByTime(4100));
    expect(screen.queryByText('Listo')).not.toBeInTheDocument();
    expect(screen.getByText('Falló')).toBeInTheDocument();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Falló')).not.toBeInTheDocument();
  });
});

describe('Confirmación', () => {
  test('cancelar resuelve false y devuelve el foco al elemento anterior', async () => {
    montar();
    const user = userEvent.setup();
    const previo = screen.getByRole('button', { name: 'Elemento previo' });
    previo.focus();

    let promesa;
    act(() => {
      promesa = api.confirmar({
        titulo: 'Eliminar',
        mensaje: '¿Seguro?',
        textoConfirmar: 'Eliminar',
      });
    });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await expect(promesa).resolves.toBe(false);
    expect(previo).toHaveFocus();
  });

  test('el foco queda dentro del modal al usar Tab', async () => {
    montar();
    const user = userEvent.setup();
    act(() => {
      api.confirmar({
        titulo: 'Eliminar',
        mensaje: '¿Seguro?',
        textoConfirmar: 'Eliminar',
      });
    });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveFocus();
  });

  test('confirmar devuelve el resultado de la acción', async () => {
    montar();
    const user = userEvent.setup();
    let promesa;
    act(() => {
      promesa = api.confirmar({
        titulo: 'Desactivar',
        mensaje: '¿Seguro?',
        textoConfirmar: 'Desactivar',
        accion: async () => ({ activo: false }),
      });
    });

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    await expect(promesa).resolves.toEqual({ activo: false });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
