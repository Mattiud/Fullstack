import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as usersApi from '../api/users';
import * as auditApi from '../api/audit';
import * as diagnosticosApi from '../api/diagnosticos';
import {
  errorHttp,
  renderApp,
  usuarioAdmin,
  usuarioPsico,
} from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');
jest.mock('../api/diagnosticos');

// Datos ficticios.
const cuentaSinUso = {
  _id: 'sin-uso-1',
  nombre: 'Cuenta Ficticia Sin Uso',
  email: 'sin.uso@prueba.cl',
  rol: 'psicopedagogo',
  activo: true,
  debeCambiarPassword: true,
};

const categoria = { _id: 'tipo-1', nombre: 'Categoría ficticia', activo: true };

beforeEach(() => {
  jest.spyOn(window, 'confirm').mockImplementation(() => true);
});

afterEach(() => {
  expect(window.confirm).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

function fila(texto) {
  return screen.getByRole('cell', { name: texto }).closest('tr');
}

describe('Eliminar usuarios', () => {
  beforeEach(() => {
    authApi.obtenerSesion.mockResolvedValue(usuarioAdmin);
    usersApi.listarUsuarios.mockResolvedValue([
      usuarioAdmin,
      usuarioPsico,
      cuentaSinUso,
    ]);
    auditApi.listarAuditoria.mockResolvedValue([]);
  });

  async function abrir() {
    const user = userEvent.setup();
    renderApp('/usuarios');
    await screen.findByRole('cell', { name: cuentaSinUso.email });
    return user;
  }

  test('muestra «Eliminar» junto a «Desactivar», salvo en la propia cuenta', async () => {
    await abrir();
    const otra = within(fila(cuentaSinUso.email));
    expect(
      otra.getByRole('button', { name: `Desactivar a ${cuentaSinUso.nombre}` })
    ).toBeInTheDocument();
    expect(
      otra.getByRole('button', { name: `Eliminar a ${cuentaSinUso.nombre}` })
    ).toBeInTheDocument();
    expect(
      within(fila(usuarioAdmin.email)).queryByRole('button', {
        name: /Eliminar/,
      })
    ).not.toBeInTheDocument();
  });

  test('cancelar la confirmación no elimina nada', async () => {
    const user = await abrir();
    await user.click(
      screen.getByRole('button', { name: `Eliminar a ${cuentaSinUso.nombre}` })
    );
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent(cuentaSinUso.nombre);
    expect(dialogo).toHaveTextContent(cuentaSinUso.email);
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(usersApi.eliminarUsuario).not.toHaveBeenCalled();
    expect(
      screen.getByRole('cell', { name: cuentaSinUso.email })
    ).toBeInTheDocument();
  });

  test('al confirmar elimina la cuenta y la quita del listado', async () => {
    usersApi.eliminarUsuario.mockResolvedValue();
    const user = await abrir();
    await user.click(
      screen.getByRole('button', { name: `Eliminar a ${cuentaSinUso.nombre}` })
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Eliminar',
      })
    );
    expect(usersApi.eliminarUsuario).toHaveBeenCalledWith(cuentaSinUso._id);
    expect(
      await screen.findByText(`Se eliminó la cuenta de ${cuentaSinUso.nombre}.`)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('cell', { name: cuentaSinUso.email })
      ).not.toBeInTheDocument()
    );
  });

  test('si la cuenta tiene información asociada, informa y la conserva', async () => {
    const mensaje =
      'No se puede eliminar la cuenta de Profesional Ficticio porque tiene información asociada (registros de actividad). Desactívela para impedir su acceso sin perder la trazabilidad.';
    usersApi.eliminarUsuario.mockRejectedValue(
      errorHttp(409, { error: mensaje })
    );
    const user = await abrir();
    await user.click(
      screen.getByRole('button', { name: `Eliminar a ${usuarioPsico.nombre}` })
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Eliminar',
      })
    );
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: usuarioPsico.email })
    ).toBeInTheDocument();
  });
});

describe('Eliminar tipos de diagnóstico', () => {
  beforeEach(() => {
    authApi.obtenerSesion.mockResolvedValue(usuarioAdmin);
    diagnosticosApi.listarTiposDiagnostico.mockResolvedValue([categoria]);
  });

  async function abrir() {
    const user = userEvent.setup();
    renderApp('/tipos-diagnostico');
    await screen.findByText(categoria.nombre);
    return user;
  }

  test('muestra «Eliminar» junto a «Desactivar» y permite cancelar', async () => {
    const user = await abrir();
    expect(
      screen.getByRole('button', { name: `Desactivar ${categoria.nombre}` })
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: `Eliminar ${categoria.nombre}` })
    );
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent(categoria.nombre);
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(diagnosticosApi.eliminarTipoDiagnostico).not.toHaveBeenCalled();
    expect(screen.getByText(categoria.nombre)).toBeInTheDocument();
  });

  test('al confirmar elimina la categoría y la quita del listado', async () => {
    diagnosticosApi.eliminarTipoDiagnostico.mockResolvedValue();
    const user = await abrir();
    await user.click(
      screen.getByRole('button', { name: `Eliminar ${categoria.nombre}` })
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Eliminar',
      })
    );
    expect(diagnosticosApi.eliminarTipoDiagnostico).toHaveBeenCalledWith(
      categoria._id
    );
    expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: categoria.nombre })).toBeNull()
    );
  });

  test('si la categoría está en uso, informa y la conserva', async () => {
    const mensaje =
      'No se puede eliminar «Categoría ficticia»: se usa en 2 diagnósticos. Desactívela para dejar de ofrecerla.';
    diagnosticosApi.eliminarTipoDiagnostico.mockRejectedValue(
      errorHttp(409, { error: mensaje })
    );
    const user = await abrir();
    await user.click(
      screen.getByRole('button', { name: `Eliminar ${categoria.nombre}` })
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Eliminar',
      })
    );
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: categoria.nombre })
    ).toBeInTheDocument();
  });
});
