import { screen, waitFor, within } from '@testing-library/react';
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

describe('Restricción por rol', () => {
  test('el psicopedagogo no ve la gestión de usuarios ni puede abrirla por URL', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioPsico);
    renderApp('/usuarios');

    expect(
      await screen.findByRole('heading', { name: 'Acceso no autorizado' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Usuarios' })
    ).not.toBeInTheDocument();
    expect(usersApi.listarUsuarios).not.toHaveBeenCalled();
    expect(auditApi.listarAuditoria).not.toHaveBeenCalled();
  });

  test('el administrador ve el enlace a la gestión de usuarios', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioAdmin);
    renderApp('/');

    expect(
      await screen.findByRole('link', { name: 'Usuarios' })
    ).toBeInTheDocument();
  });
});

describe('Usuarios y roles (administrador)', () => {
  beforeEach(() => {
    authApi.obtenerSesion.mockResolvedValue(usuarioAdmin);
    usersApi.listarUsuarios.mockResolvedValue([usuarioAdmin, usuarioPsico]);
    auditApi.listarAuditoria.mockResolvedValue([]);
  });

  async function abrirGestion() {
    renderApp('/usuarios');
    await screen.findByRole('cell', { name: usuarioPsico.email });
  }

  function fila(nombre) {
    return screen.getByRole('cell', { name: nombre }).closest('tr');
  }

  test('lista las cuentas con rol, estado y último acceso', async () => {
    await abrirGestion();

    const psico = within(fila(usuarioPsico.nombre));
    expect(psico.getByText('Psicopedagogo')).toBeInTheDocument();
    expect(psico.getByText('Activo')).toBeInTheDocument();
    expect(psico.getByText('—')).toBeInTheDocument();
    expect(
      psico.getByRole('button', { name: `Desactivar a ${usuarioPsico.nombre}` })
    ).toBeEnabled();

    const propia = within(fila(usuarioAdmin.nombre));
    expect(propia.getByText('(su cuenta)')).toBeInTheDocument();
    expect(
      propia.queryByRole('button', { name: /Desactivar/ })
    ).not.toBeInTheDocument();
    expect(propia.queryByText('—')).not.toBeInTheDocument();
  });

  test('filtra las cuentas con la búsqueda', async () => {
    const user = userEvent.setup();
    await abrirGestion();

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar usuario' }),
      'profesional@'
    );

    expect(
      screen.getByRole('cell', { name: usuarioPsico.email })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('cell', { name: usuarioAdmin.email })
    ).not.toBeInTheDocument();
  });

  test('el formulario aparece con "+ Nuevo usuario" y valida antes de enviar', async () => {
    const user = userEvent.setup();
    await abrirGestion();
    expect(
      screen.queryByRole('region', { name: 'Nuevo usuario' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    const formulario = within(
      screen.getByRole('region', { name: 'Nuevo usuario' })
    );

    await user.click(
      formulario.getByRole('button', { name: 'Registrar usuario' })
    );
    expect(formulario.getByText('Ingrese el nombre')).toBeInTheDocument();
    expect(formulario.getByText('Ingrese el correo')).toBeInTheDocument();
    expect(formulario.getByText('Ingrese la contraseña')).toBeInTheDocument();

    await user.type(
      formulario.getByLabelText('Contraseña temporal'),
      'solotexto'
    );
    await user.click(
      formulario.getByRole('button', { name: 'Registrar usuario' })
    );
    expect(
      formulario.getByText('Debe tener al menos 10 caracteres')
    ).toBeInTheDocument();
    expect(usersApi.crearUsuario).not.toHaveBeenCalled();

    await user.click(formulario.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('region', { name: 'Nuevo usuario' })
    ).not.toBeInTheDocument();
  });

  test('registra un usuario con el rol seleccionado', async () => {
    const nuevo = {
      _id: 'nuevo-1',
      nombre: 'Nueva Cuenta Ficticia',
      email: 'nueva@prueba.cl',
      rol: 'admin',
      activo: true,
      debeCambiarPassword: true,
    };
    usersApi.crearUsuario.mockResolvedValue(nuevo);
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    const formulario = within(
      screen.getByRole('region', { name: 'Nuevo usuario' })
    );
    await user.type(formulario.getByLabelText('Nombre'), nuevo.nombre);
    await user.type(
      formulario.getByLabelText('Correo institucional'),
      nuevo.email
    );
    await user.selectOptions(formulario.getByLabelText('Rol'), 'admin');
    await user.type(
      formulario.getByLabelText('Contraseña temporal'),
      'ClaveInicial2024'
    );
    await user.click(
      formulario.getByRole('button', { name: 'Registrar usuario' })
    );

    expect(usersApi.crearUsuario).toHaveBeenCalledWith({
      nombre: nuevo.nombre,
      email: nuevo.email,
      rol: 'admin',
      password: 'ClaveInicial2024',
    });
    expect(
      await screen.findByText(`Se registró la cuenta de ${nuevo.nombre}.`)
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: nuevo.email })).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Nuevo usuario' })
    ).not.toBeInTheDocument();
    // El registro de accesos se vuelve a consultar tras el cambio.
    await waitFor(() =>
      expect(auditApi.listarAuditoria).toHaveBeenCalledTimes(2)
    );
  });

  test('muestra los errores devueltos por el servidor', async () => {
    usersApi.crearUsuario.mockRejectedValue(
      errorHttp(409, {
        error: 'Ya existe un usuario con ese correo',
        detalles: { email: 'Ya existe un usuario con ese correo' },
      })
    );
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    const formulario = within(
      screen.getByRole('region', { name: 'Nuevo usuario' })
    );
    await user.type(formulario.getByLabelText('Nombre'), 'Cuenta Duplicada');
    await user.type(
      formulario.getByLabelText('Correo institucional'),
      usuarioPsico.email
    );
    await user.type(
      formulario.getByLabelText('Contraseña temporal'),
      'ClaveInicial2024'
    );
    await user.click(
      formulario.getByRole('button', { name: 'Registrar usuario' })
    );

    expect(await formulario.findByRole('alert')).toHaveTextContent(
      'Ya existe un usuario con ese correo'
    );
  });

  test('desactiva una cuenta tras confirmar', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    usersApi.actualizarUsuario.mockResolvedValue({
      ...usuarioPsico,
      activo: false,
    });
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(
      screen.getByRole('button', {
        name: `Desactivar a ${usuarioPsico.nombre}`,
      })
    );

    expect(usersApi.actualizarUsuario).toHaveBeenCalledWith(usuarioPsico._id, {
      activo: false,
    });
    expect(
      await within(fila(usuarioPsico.nombre)).findByText('Inactivo')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Activar a ${usuarioPsico.nombre}` })
    ).toBeInTheDocument();
  });

  test('no desactiva la cuenta si se cancela la confirmación', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(
      screen.getByRole('button', {
        name: `Desactivar a ${usuarioPsico.nombre}`,
      })
    );
    expect(usersApi.actualizarUsuario).not.toHaveBeenCalled();
  });

  test('edita el rol de un usuario', async () => {
    usersApi.actualizarUsuario.mockResolvedValue({
      ...usuarioPsico,
      rol: 'admin',
    });
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(
      screen.getByRole('button', { name: `Editar a ${usuarioPsico.nombre}` })
    );
    await user.selectOptions(screen.getByLabelText('Rol'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(usersApi.actualizarUsuario).toHaveBeenCalledWith(usuarioPsico._id, {
      rol: 'admin',
    });
    expect(
      await screen.findByText(
        `Se cambió el rol de ${usuarioPsico.nombre} a Administrador.`
      )
    ).toBeInTheDocument();
    expect(
      within(fila(usuarioPsico.nombre)).getByText('Administrador')
    ).toBeInTheDocument();
  });

  test('asigna una contraseña temporal desde la edición', async () => {
    usersApi.asignarPasswordTemporal.mockResolvedValue({
      ...usuarioPsico,
      debeCambiarPassword: true,
    });
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(
      screen.getByRole('button', { name: `Editar a ${usuarioPsico.nombre}` })
    );
    await user.type(screen.getByLabelText('Contraseña temporal'), 'corta');
    await user.click(
      screen.getByRole('button', { name: 'Asignar contraseña temporal' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Debe tener al menos 10 caracteres'
    );
    expect(usersApi.asignarPasswordTemporal).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Contraseña temporal'));
    await user.type(
      screen.getByLabelText('Contraseña temporal'),
      'Temporal2024x'
    );
    await user.click(
      screen.getByRole('button', { name: 'Asignar contraseña temporal' })
    );

    await waitFor(() =>
      expect(usersApi.asignarPasswordTemporal).toHaveBeenCalledWith(
        usuarioPsico._id,
        'Temporal2024x'
      )
    );
    expect(
      await screen.findByText(
        `Se asignó una contraseña temporal a ${usuarioPsico.nombre}.`
      )
    ).toBeInTheDocument();
  });

  test('en la propia cuenta no permite cambiar el rol ni asignar contraseña temporal', async () => {
    const user = userEvent.setup();
    await abrirGestion();

    await user.click(
      screen.getByRole('button', { name: `Editar a ${usuarioAdmin.nombre}` })
    );

    expect(screen.getByLabelText('Rol')).toBeDisabled();
    expect(
      screen.queryByLabelText('Contraseña temporal')
    ).not.toBeInTheDocument();
  });

  test('muestra la matriz de permisos del mockup', async () => {
    await abrirGestion();

    const matriz = within(
      screen.getByRole('region', { name: 'Matriz de permisos' })
    );
    const editar = within(
      matriz
        .getByRole('rowheader', { name: 'Editar diagnósticos' })
        .closest('tr')
    );
    const crear = within(
      matriz.getByRole('rowheader', { name: 'Crear usuarios' }).closest('tr')
    );

    const [adminEditar, psicoEditar] = editar.getAllByRole('cell');
    expect(
      within(adminEditar).getByLabelText('No permitido')
    ).toBeInTheDocument();
    expect(within(psicoEditar).getByLabelText('Permitido')).toBeInTheDocument();
    const [adminCrear, psicoCrear] = crear.getAllByRole('cell');
    expect(within(adminCrear).getByLabelText('Permitido')).toBeInTheDocument();
    expect(
      within(psicoCrear).getByLabelText('No permitido')
    ).toBeInTheDocument();
  });

  test('muestra el registro de accesos y cambios', async () => {
    auditApi.listarAuditoria.mockResolvedValue([
      {
        _id: 'r1',
        fecha: '2026-10-21T11:52:00.000Z',
        accion: 'LOGIN_EXITOSO',
        resultado: 'exito',
        usuario: { nombre: usuarioPsico.nombre },
      },
      {
        _id: 'r2',
        fecha: '2026-10-21T11:41:00.000Z',
        accion: 'LOGIN_FALLIDO',
        resultado: 'fallo',
        usuario: null,
      },
      {
        _id: 'r3',
        fecha: '2026-10-20T22:12:00.000Z',
        accion: 'USUARIO_ACTUALIZADO',
        resultado: 'exito',
        usuario: { nombre: usuarioAdmin.nombre },
        recurso: 'usuario',
        recursoId: usuarioPsico._id,
        detalle: { campos: ['rol'], rol: 'admin' },
      },
    ]);
    await abrirGestion();

    const registro = within(
      screen.getByRole('region', { name: 'Registro de accesos y cambios' })
    );
    expect(
      await registro.findByText(
        new RegExp(`${usuarioPsico.nombre} · inicio de sesión exitoso`)
      )
    ).toBeInTheDocument();
    expect(
      registro.getByText(/desconocido · intento de inicio de sesión fallido/)
    ).toBeInTheDocument();
    expect(
      registro.getByText(
        new RegExp(
          `${usuarioAdmin.nombre} · cambió el rol de ${usuarioPsico.nombre}`
        )
      )
    ).toBeInTheDocument();
    expect(auditApi.listarAuditoria).toHaveBeenCalledWith({ limite: 8 });
  });

  test('muestra un error si el servidor rechaza la lista', async () => {
    usersApi.listarUsuarios.mockRejectedValue(
      errorHttp(403, { error: 'No tiene permisos para realizar esta acción' })
    );
    renderApp('/usuarios');

    expect(
      await screen.findByText('No tiene permisos para realizar esta acción')
    ).toBeInTheDocument();
  });
});
