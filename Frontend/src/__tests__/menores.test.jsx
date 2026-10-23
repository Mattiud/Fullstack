import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as usersApi from '../api/users';
import * as menoresApi from '../api/menores';
import {
  errorHttp,
  renderApp,
  usuarioAdmin,
  usuarioPsico,
} from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');
jest.mock('../api/menores');

// Datos ficticios.
const menorFicticio = {
  _id: 'menor-1',
  nombre: 'Menor Ficticio Uno',
  rut: '12345678-5',
  edad: 10,
  fechaNacimiento: '2016-03-12T00:00:00.000Z',
  establecimiento: 'Colegio de Prueba',
  curso: '4° básico',
  fechaIngreso: '2026-03-04T00:00:00.000Z',
  apoderado: {
    nombre: 'Apoderado Ficticio',
    parentesco: 'Madre',
    telefono: '+56 9 1234 5678',
  },
  antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
  profesionalesAsignados: [
    { _id: usuarioPsico._id, nombre: usuarioPsico.nombre, activo: true },
  ],
  activo: true,
};

const sinDocumentos = {
  documentos: [],
  limites: {
    maxBytes: 10485760,
    extensiones: ['.pdf', '.docx', '.doc'],
    mimes: [],
  },
};

function sesionComo(usuario) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
}

beforeEach(() => {
  menoresApi.obtenerMenor.mockResolvedValue(menorFicticio);
  menoresApi.listarDocumentos.mockResolvedValue(sinDocumentos);
  menoresApi.listarMenores.mockResolvedValue({
    menores: [
      {
        _id: 'menor-1',
        nombre: 'Menor Ficticio Uno',
        edad: 10,
        apoderado: { nombre: 'Apoderado A' },
        activo: true,
      },
      {
        _id: 'menor-2',
        nombre: 'Menor Ficticio Dos',
        edad: 7,
        apoderado: { nombre: 'Apoderado B' },
        activo: false,
      },
    ],
    total: 2,
    pagina: 1,
    limite: 20,
  });
});

describe('Listado de menores', () => {
  test('muestra los menores registrados con su edad, apoderado y estado', async () => {
    sesionComo(usuarioPsico);
    renderApp('/menores');

    expect(
      await screen.findByRole('heading', { name: 'Menores (2)' })
    ).toBeInTheDocument();
    const fila = screen
      .getByRole('link', { name: 'Menor Ficticio Dos' })
      .closest('tr');
    expect(within(fila).getByText('7')).toBeInTheDocument();
    expect(within(fila).getByText('Apoderado B')).toBeInTheDocument();
    expect(within(fila).getByText('Inactivo')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '+ Nuevo menor' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Menores' })).toHaveClass('active');
  });

  test('el administrador no ve la opción de registrar menores', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/menores');

    await screen.findByRole('link', { name: 'Menor Ficticio Uno' });
    expect(
      screen.queryByRole('link', { name: '+ Nuevo menor' })
    ).not.toBeInTheDocument();
  });

  test('busca por nombre o RUT y filtra los activos', async () => {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores');
    await screen.findByRole('link', { name: 'Menor Ficticio Uno' });

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar por nombre o RUT' }),
      '12.345'
    );
    await waitFor(() =>
      expect(menoresApi.listarMenores).toHaveBeenLastCalledWith({
        q: '12.345',
        estado: 'todos',
        pagina: 1,
      })
    );

    await user.click(screen.getByRole('button', { name: 'Activos' }));
    expect(screen.getByRole('button', { name: 'Activos' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await waitFor(() =>
      expect(menoresApi.listarMenores).toHaveBeenLastCalledWith({
        q: '12.345',
        estado: 'activos',
        pagina: 1,
      })
    );
  });

  test('muestra un mensaje cuando no hay menores', async () => {
    sesionComo(usuarioPsico);
    menoresApi.listarMenores.mockResolvedValue({
      menores: [],
      total: 0,
      pagina: 1,
      limite: 20,
    });
    renderApp('/menores');

    expect(
      await screen.findByText('Aún no hay menores registrados.')
    ).toBeInTheDocument();
  });

  test('muestra los errores del servidor de forma comprensible', async () => {
    sesionComo(usuarioPsico);
    menoresApi.listarMenores.mockRejectedValue(
      errorHttp(500, { error: 'Error interno del servidor' })
    );
    renderApp('/menores');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error interno del servidor'
    );
  });
});

describe('Registro de menores', () => {
  async function abrirFormulario() {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/nuevo');
    await screen.findByRole('heading', { name: 'Nuevo menor' });
    return user;
  }

  async function completar(user) {
    await user.type(
      screen.getByLabelText('Nombre completo *'),
      'Menor Ficticio Tres'
    );
    await user.type(screen.getByLabelText('RUT *'), '12.345.678-5');
    await user.type(
      screen.getByLabelText('Fecha de nacimiento *'),
      '2017-05-20'
    );
    await user.type(screen.getByLabelText('Curso'), '3° básico');
    await user.type(
      screen.getByLabelText('Nombre del apoderado *'),
      'Apoderado Ficticio'
    );
    await user.type(screen.getByLabelText('Parentesco *'), 'Padre');
    await user.type(screen.getByLabelText('Teléfono *'), '+56 9 1111 2222');
    await user.type(
      screen.getByLabelText('Antecedentes relevantes *'),
      'Texto de ejemplo.'
    );
  }

  test('valida los campos obligatorios y el RUT antes de enviar', async () => {
    const user = await abrirFormulario();

    await user.click(screen.getByRole('button', { name: 'Registrar menor' }));
    expect(
      screen.getByText('Revise los campos marcados antes de guardar.')
    ).toBeInTheDocument();
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El RUT es obligatorio')).toBeInTheDocument();
    expect(
      screen.getByText('La fecha de nacimiento es obligatoria')
    ).toBeInTheDocument();
    expect(screen.getByText('El teléfono es obligatorio')).toBeInTheDocument();
    expect(
      screen.getByText('El campo de antecedentes relevantes es obligatorio')
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('RUT *'), '12.345.678-K');
    await user.click(screen.getByRole('button', { name: 'Registrar menor' }));
    expect(
      screen.getByText('El dígito verificador del RUT no es válido')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El RUT ingresado no es válido. Revise también los demás campos marcados.'
      )
    ).toBeInTheDocument();
    expect(menoresApi.crearMenor).not.toHaveBeenCalled();
  });

  test('registra al menor en el servidor y abre su ficha', async () => {
    menoresApi.crearMenor.mockResolvedValue({
      ...menorFicticio,
      _id: 'menor-3',
    });
    const user = await abrirFormulario();
    await completar(user);

    await user.click(screen.getByRole('button', { name: 'Registrar menor' }));

    expect(menoresApi.crearMenor).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Menor Ficticio Tres',
        rut: '12.345.678-5',
        fechaNacimiento: '2017-05-20',
        curso: '3° básico',
        apoderado: {
          nombre: 'Apoderado Ficticio',
          parentesco: 'Padre',
          telefono: '+56 9 1111 2222',
        },
        antecedentesRelevantes: 'Texto de ejemplo.',
      })
    );
    expect(
      await screen.findByText('Menor registrado correctamente')
    ).toBeInTheDocument();
    expect(menoresApi.obtenerMenor).toHaveBeenCalledWith('menor-3');
  });

  test('muestra el error de RUT duplicado devuelto por el servidor', async () => {
    menoresApi.crearMenor.mockRejectedValue(
      errorHttp(409, {
        error: 'Ya existe un menor registrado con ese RUT',
        detalles: { rut: 'Ya existe un menor registrado con ese RUT' },
      })
    );
    const user = await abrirFormulario();
    await completar(user);
    await user.click(screen.getByRole('button', { name: 'Registrar menor' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe un menor registrado con ese RUT'
    );
    expect(screen.getByLabelText('RUT *')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  test('avisa antes de salir con cambios sin guardar', async () => {
    const user = await abrirFormulario();
    await user.type(
      screen.getByLabelText('Nombre completo *'),
      'Cambio sin guardar'
    );

    await user.click(screen.getByRole('link', { name: 'Menores' }));
    const aviso = screen.getByRole('alertdialog', {
      name: 'Cambios sin guardar',
    });
    await user.click(
      within(aviso).getByRole('button', { name: 'Seguir editando' })
    );
    expect(screen.getByLabelText('Nombre completo *')).toHaveValue(
      'Cambio sin guardar'
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
    expect(
      await screen.findByRole('heading', { name: 'Menores (2)' })
    ).toBeInTheDocument();
  });

  test('el administrador no puede abrir el registro por URL', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/menores/nuevo');
    expect(
      await screen.findByRole('heading', { name: 'Acceso no autorizado' })
    ).toBeInTheDocument();
  });
});

describe('Ficha del menor', () => {
  test('muestra los antecedentes del menor', async () => {
    sesionComo(usuarioPsico);
    renderApp('/menores/menor-1');

    expect(
      await screen.findByRole('heading', {
        name: 'Menor Ficticio Uno · 10 años',
      })
    ).toBeInTheDocument();
    const antecedentes = within(
      screen.getByRole('region', { name: 'Antecedentes' })
    );
    expect(antecedentes.getByText('12.345.678-5')).toBeInTheDocument();
    expect(antecedentes.getByText('12/03/2016')).toBeInTheDocument();
    expect(antecedentes.getByText('04/03/2026')).toBeInTheDocument();
    expect(
      antecedentes.getByText('Apoderado Ficticio (Madre)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Antecedentes de ejemplo sin datos reales.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Editar ficha' })
    ).toBeInTheDocument();
  });

  test('muestra el mensaje de acceso denegado del servidor (T03)', async () => {
    sesionComo(usuarioPsico);
    menoresApi.obtenerMenor.mockRejectedValue(
      errorHttp(403, {
        error: 'No tiene permisos para acceder a este expediente',
      })
    );
    renderApp('/menores/menor-9');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tiene permisos para acceder a este expediente'
    );
    expect(screen.queryByText('12.345.678-5')).not.toBeInTheDocument();
  });

  test('el administrador ve la ficha sin opciones de edición y puede asignar profesionales', async () => {
    sesionComo(usuarioAdmin);
    const otro = {
      _id: 'psico-2',
      nombre: 'Otro Profesional',
      rol: 'psicopedagogo',
      activo: true,
    };
    usersApi.listarUsuarios.mockResolvedValue([
      usuarioAdmin,
      usuarioPsico,
      otro,
    ]);
    menoresApi.asignarProfesionales.mockResolvedValue({
      ...menorFicticio,
      profesionalesAsignados: [...menorFicticio.profesionalesAsignados, otro],
    });
    const user = userEvent.setup();
    renderApp('/menores/menor-1');

    await screen.findByRole('heading', {
      name: 'Menor Ficticio Uno · 10 años',
    });
    expect(
      screen.queryByRole('link', { name: 'Editar ficha' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Desactivar' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Modificar' }));
    expect(
      screen.queryByLabelText(usuarioAdmin.nombre)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(usuarioPsico.nombre)).toBeChecked();
    await user.click(screen.getByLabelText('Otro Profesional'));
    await user.click(
      screen.getByRole('button', { name: 'Guardar asignación' })
    );

    expect(menoresApi.asignarProfesionales).toHaveBeenCalledWith('menor-1', [
      usuarioPsico._id,
      'psico-2',
    ]);
    expect(
      await screen.findByText(
        'Profesionales asignados actualizados correctamente'
      )
    ).toBeInTheDocument();
  });

  test('desactiva la ficha tras confirmar, conservando los datos', async () => {
    sesionComo(usuarioPsico);
    const confirmNativo = jest.spyOn(window, 'confirm');
    menoresApi.cambiarEstadoMenor.mockResolvedValue({
      ...menorFicticio,
      activo: false,
    });
    const user = userEvent.setup();
    renderApp('/menores/menor-1');

    await user.click(await screen.findByRole('button', { name: 'Desactivar' }));
    const modal = screen.getByRole('alertdialog', { name: 'Desactivar ficha' });
    expect(menoresApi.cambiarEstadoMenor).not.toHaveBeenCalled();
    await user.click(within(modal).getByRole('button', { name: 'Desactivar' }));

    expect(confirmNativo).not.toHaveBeenCalled();
    expect(menoresApi.cambiarEstadoMenor).toHaveBeenCalledWith(
      'menor-1',
      false
    );
    expect(
      await screen.findByText('Ficha desactivada correctamente')
    ).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reactivar' })
    ).toBeInTheDocument();
  });

  test('la pestaña seleccionada se conserva en la URL y el historial describe los cambios', async () => {
    sesionComo(usuarioPsico);
    menoresApi.obtenerHistorial.mockResolvedValue([
      {
        _id: 'h1',
        fecha: '2026-10-21T12:00:00.000Z',
        accion: 'MENOR_ACTUALIZADO',
        usuario: { nombre: usuarioPsico.nombre },
        detalle: { campos: ['curso', 'apoderado.telefono'] },
      },
    ]);
    const user = userEvent.setup();
    const { router } = renderApp('/menores/menor-1');

    await user.click(await screen.findByRole('tab', { name: 'Historial' }));
    expect(router.state.location.search).toBe('?pestana=historial');
    expect(
      await screen.findByText('actualizó: curso, teléfono del apoderado')
    ).toBeInTheDocument();
  });
});

describe('Edición de la ficha', () => {
  test('envía solo los campos modificados y confirma el resultado', async () => {
    sesionComo(usuarioPsico);
    menoresApi.actualizarMenor.mockResolvedValue({
      ...menorFicticio,
      curso: '5° básico',
    });
    const user = userEvent.setup();
    renderApp('/menores/menor-1/editar');

    const curso = await screen.findByLabelText('Curso');
    expect(screen.getByLabelText('RUT *')).toHaveValue('12.345.678-5');
    expect(screen.getByLabelText('Fecha de nacimiento *')).toHaveValue(
      '2016-03-12'
    );
    await user.clear(curso);
    await user.type(curso, '5° básico');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(menoresApi.actualizarMenor).toHaveBeenCalledWith('menor-1', {
      curso: '5° básico',
    });
    expect(
      await screen.findByText('Cambios guardados correctamente')
    ).toBeInTheDocument();
  });

  test('indica cuando no hay cambios para guardar', async () => {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1/editar');

    await user.click(
      await screen.findByRole('button', { name: 'Guardar cambios' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No hay cambios para guardar.'
    );
    expect(menoresApi.actualizarMenor).not.toHaveBeenCalled();
  });
});

describe('RUT con formato automático', () => {
  async function campoRut() {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/nuevo');
    return { user, rut: await screen.findByLabelText('RUT *') };
  }

  test('formatea 212914541 como 21.291.454-1 mientras se escribe', async () => {
    const { user, rut } = await campoRut();
    await user.type(rut, '21291454');
    expect(rut).toHaveValue('2.129.145-4');
    await user.type(rut, '1');
    expect(rut).toHaveValue('21.291.454-1');
  });

  test('no acumula separadores al escribir con puntos y guion', async () => {
    const { user, rut } = await campoRut();
    await user.type(rut, '21..291--454-1');
    expect(rut).toHaveValue('21.291.454-1');
  });

  test('retroceso después del guion borra el dígito anterior', async () => {
    const { user, rut } = await campoRut();
    await user.type(rut, '212914541');
    // Cursor justo después del guion: "21.291.454-|1".
    await user.type(rut, '{Backspace}', {
      initialSelectionStart: 11,
      initialSelectionEnd: 11,
    });
    expect(rut).toHaveValue('2.129.145-1');
  });
});

describe('Registro según la edad', () => {
  async function completarSinApoderado(user, fechaNacimiento) {
    await user.type(
      screen.getByLabelText('Nombre completo *'),
      'Persona Ficticia'
    );
    await user.type(screen.getByLabelText('RUT *'), '212914541');
    await user.type(
      screen.getByLabelText('Fecha de nacimiento *'),
      fechaNacimiento
    );
    await user.type(
      screen.getByLabelText('Antecedentes relevantes *'),
      'Texto de ejemplo.'
    );
  }

  test('registra a una persona mayor de 18 años sin apoderado', async () => {
    sesionComo(usuarioPsico);
    menoresApi.crearMenor.mockResolvedValue({
      ...menorFicticio,
      _id: 'adulto-1',
    });
    const user = userEvent.setup();
    renderApp('/menores/nuevo');
    await screen.findByRole('heading', { name: 'Nuevo menor' });

    await completarSinApoderado(user, '1990-06-15');
    // Para un adulto los datos del apoderado dejan de ser obligatorios.
    expect(screen.getByLabelText('Nombre del apoderado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registrar menor' }));

    expect(menoresApi.crearMenor).toHaveBeenCalledWith(
      expect.objectContaining({
        rut: '21.291.454-1',
        fechaNacimiento: '1990-06-15',
        apoderado: null,
      })
    );
    expect(
      await screen.findByText('Menor registrado correctamente')
    ).toBeInTheDocument();
  });

  test('exige el apoderado a una persona menor de 18 años', async () => {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/nuevo');
    await screen.findByRole('heading', { name: 'Nuevo menor' });

    await completarSinApoderado(user, '2015-01-01');
    await user.click(screen.getByRole('button', { name: 'Registrar menor' }));

    expect(
      screen.getByText('El nombre del apoderado es obligatorio')
    ).toBeInTheDocument();
    expect(menoresApi.crearMenor).not.toHaveBeenCalled();
  });

  test('la ficha de una persona sin apoderado muestra un guion', async () => {
    sesionComo(usuarioPsico);
    menoresApi.obtenerMenor.mockResolvedValue({
      ...menorFicticio,
      edad: 36,
      apoderado: undefined,
    });
    renderApp('/menores/menor-1');

    const antecedentes = within(
      await screen.findByRole('region', { name: 'Antecedentes' })
    );
    expect(
      within(antecedentes.getByText('Apoderado').parentElement).getByText('—')
    ).toBeInTheDocument();
    // La cabecera muestra solo el curso, sin datos de apoderado.
    expect(screen.queryByText(/Apoderado:/)).not.toBeInTheDocument();
  });
});
