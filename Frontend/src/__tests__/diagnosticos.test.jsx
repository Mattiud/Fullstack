import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as menoresApi from '../api/menores';
import * as diagnosticosApi from '../api/diagnosticos';
import * as sesionesApi from '../api/sesiones';
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
jest.mock('../api/diagnosticos');
jest.mock('../api/sesiones');

// Datos ficticios.
const menorFicticio = {
  _id: 'menor-1',
  nombre: 'Menor Ficticio Uno',
  rut: '12345678-5',
  edad: 10,
  fechaNacimiento: '2016-03-12T00:00:00.000Z',
  fechaIngreso: '2026-03-04T00:00:00.000Z',
  apoderado: {
    nombre: 'Apoderado Ficticio',
    parentesco: 'Madre',
    telefono: '+56 9 1234 5678',
  },
  antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
  profesionalesAsignados: [],
  activo: true,
};

const resumenVigente = {
  _id: 'diag-1',
  menor: 'menor-1',
  tipo: 'Tipo ficticio actual',
  fechaEvaluacion: '2026-10-01T00:00:00.000Z',
  estado: 'vigente',
  version: 2,
  actualizadoPor: { _id: 'psico-1', nombre: 'Profesional Ficticio' },
  updatedAt: '2026-11-02T14:04:00.000Z',
};

const detalleVigente = {
  ...resumenVigente,
  menor: { _id: 'menor-1', nombre: 'Menor Ficticio Uno' },
  instrumento: 'Instrumento ficticio',
  descripcion: 'Hallazgos ficticios actuales.',
  areasAfectadas: ['Lectura'],
  versiones: [
    {
      version: 1,
      tipo: 'Tipo ficticio anterior',
      fechaEvaluacion: '2026-09-01T00:00:00.000Z',
      descripcion: 'Hallazgos ficticios anteriores.',
      areasAfectadas: [],
      registradoPor: { _id: 'psico-1', nombre: 'Profesional Ficticio' },
      fecha: '2026-10-15T10:00:00.000Z',
    },
  ],
};

// Elige un tipo en el selector una vez cargadas las categorías.
async function elegirTipo(user, modal, nombre) {
  const selector = within(modal).getByLabelText('Tipo de diagnóstico *');
  await within(selector).findByRole('option', { name: 'Categoría ficticia' });
  await user.selectOptions(selector, nombre);
}

function sesionComo(usuario) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
}

beforeEach(() => {
  menoresApi.obtenerMenor.mockResolvedValue(menorFicticio);
  menoresApi.listarDocumentos.mockResolvedValue({
    documentos: [],
    limites: { maxBytes: 10485760, extensiones: ['.pdf'], mimes: [] },
  });
  menoresApi.listarMenores.mockResolvedValue({
    menores: [
      {
        _id: 'menor-1',
        nombre: 'Menor Ficticio Uno',
        edad: 10,
        apoderado: null,
        activo: true,
      },
    ],
    total: 1,
    pagina: 1,
    limite: 20,
  });
  diagnosticosApi.listarDiagnosticosMenor.mockResolvedValue([resumenVigente]);
  sesionesApi.listarSesionesMenor.mockResolvedValue([]);
  diagnosticosApi.listarDiagnosticos.mockResolvedValue({
    diagnosticos: [
      {
        ...resumenVigente,
        menor: { _id: 'menor-1', nombre: 'Menor Ficticio Uno' },
      },
    ],
    total: 1,
    pagina: 1,
    limite: 20,
  });
  diagnosticosApi.obtenerDiagnostico.mockResolvedValue(detalleVigente);
  diagnosticosApi.listarTiposDiagnostico.mockResolvedValue([
    { _id: 'tipo-1', nombre: 'Categoría ficticia', activo: true },
  ]);
  menoresApi.buscarMenores.mockImplementation(async (q) =>
    [
      { _id: 'menor-1', nombre: 'Menor Ficticio Uno', rut: '12345678-5' },
      { _id: 'menor-2', nombre: 'Menor Ficticio Dos', rut: '7654321-6' },
    ].filter(
      (m) =>
        m.nombre.toLowerCase().includes(q.toLowerCase()) ||
        m.rut.replace('-', '').startsWith(q.replace(/[.-]/g, ''))
    )
  );
});

describe('Listado de diagnósticos', () => {
  test('muestra cada diagnóstico con su menor y permite abrir el detalle', async () => {
    sesionComo(usuarioPsico);
    renderApp('/diagnosticos');

    expect(
      await screen.findByRole('heading', { name: 'Diagnósticos (1)' })
    ).toBeInTheDocument();
    const fila = screen
      .getByRole('link', { name: 'Menor Ficticio Uno' })
      .closest('tr');
    expect(within(fila).getByText('Tipo ficticio actual')).toBeInTheDocument();
    expect(within(fila).getByText('Vigente')).toBeInTheDocument();
    expect(within(fila).getByText('v2')).toBeInTheDocument();
    expect(
      within(fila).getByRole('link', {
        name: 'Ver diagnóstico de Menor Ficticio Uno',
      })
    ).toHaveAttribute('href', '/menores/menor-1/diagnosticos/diag-1');
    expect(screen.getByRole('link', { name: 'Diagnósticos' })).toHaveClass(
      'active'
    );
  });

  test('indica cuando no hay registros y filtra por estado', async () => {
    diagnosticosApi.listarDiagnosticos.mockResolvedValue({
      diagnosticos: [],
      total: 0,
      pagina: 1,
      limite: 20,
    });
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/diagnosticos');

    expect(
      await screen.findByText('Aún no hay diagnósticos registrados.')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Borradores' }));
    await waitFor(() =>
      expect(diagnosticosApi.listarDiagnosticos).toHaveBeenLastCalledWith({
        estado: 'borrador',
        pagina: 1,
      })
    );
  });

  test('el administrador consulta pero no ve la opción de registrar', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/diagnosticos');

    await screen.findByRole('heading', { name: 'Diagnósticos (1)' });
    expect(
      screen.queryByRole('button', { name: '+ Nuevo diagnóstico' })
    ).not.toBeInTheDocument();
  });

  test('desde el listado se elige el menor antes de guardar', async () => {
    diagnosticosApi.crearDiagnostico.mockResolvedValue({
      ...detalleVigente,
      _id: 'diag-9',
      version: 1,
      versiones: [],
    });
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/diagnosticos');

    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    const modal = screen.getByRole('dialog', { name: 'Nuevo diagnóstico' });
    await elegirTipo(user, modal, 'Categoría ficticia');
    await user.type(
      within(modal).getByLabelText('Fecha de evaluación *'),
      '2026-10-01'
    );
    await user.type(
      within(modal).getByLabelText('Descripción y hallazgos *'),
      'Texto.'
    );
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );

    expect(within(modal).getByText('Seleccione el menor')).toBeInTheDocument();
    expect(diagnosticosApi.crearDiagnostico).not.toHaveBeenCalled();

    await user.type(
      within(modal).getByRole('combobox', { name: 'Menor *' }),
      'uno'
    );
    await user.click(
      await within(modal).findByRole('option', {
        name: 'Menor Ficticio Uno RUT 12.345.678-5',
      })
    );
    expect(within(modal).queryByRole('listbox')).not.toBeInTheDocument();
    expect(
      within(modal).getByText('Menor Ficticio Uno · RUT 12.345.678-5')
    ).toBeInTheDocument();
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );

    await waitFor(() =>
      expect(diagnosticosApi.crearDiagnostico).toHaveBeenCalledWith(
        'menor-1',
        expect.objectContaining({
          tipo: 'Categoría ficticia',
          tipoPersonalizado: false,
          estado: 'vigente',
        })
      )
    );
    expect(
      await screen.findByText('Diagnóstico registrado correctamente')
    ).toBeInTheDocument();
    expect(diagnosticosApi.obtenerDiagnostico).toHaveBeenCalledWith(
      'menor-1',
      'diag-9'
    );
  });
});

describe('Diagnósticos en la ficha del menor', () => {
  test('el resumen muestra el diagnóstico vigente y la pestaña su cantidad', async () => {
    sesionComo(usuarioPsico);
    renderApp('/menores/menor-1');

    const panel = (
      await screen.findByRole('heading', { name: 'Diagnóstico vigente' })
    ).closest('section');
    expect(
      within(panel).getByRole('link', { name: 'Tipo ficticio actual' })
    ).toHaveAttribute('href', '/menores/menor-1/diagnosticos/diag-1');
    expect(
      within(panel).getByText(/v2 · Profesional Ficticio/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Diagnósticos (1)' })
    ).toBeInTheDocument();
  });

  test('valida los campos obligatorios antes de registrar', async () => {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1?pestana=diagnosticos');

    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    const modal = screen.getByRole('dialog', {
      name: 'Nuevo diagnóstico — Menor Ficticio Uno',
    });
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );

    expect(
      within(modal).getByText(/Debes completar los campos obligatorios/)
    ).toBeInTheDocument();
    expect(
      within(modal).getByText('El tipo de diagnóstico es obligatorio')
    ).toBeInTheDocument();
    expect(
      within(modal).getByText('La fecha de evaluación es obligatoria')
    ).toBeInTheDocument();
    expect(diagnosticosApi.crearDiagnostico).not.toHaveBeenCalled();
  });

  test('registra el diagnóstico asociado al menor de la ficha', async () => {
    diagnosticosApi.crearDiagnostico.mockResolvedValue({
      ...detalleVigente,
      _id: 'diag-2',
      version: 1,
    });
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1?pestana=diagnosticos');

    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    const modal = screen.getByRole('dialog');
    await elegirTipo(user, modal, 'Categoría ficticia');
    await user.type(
      within(modal).getByLabelText('Fecha de evaluación *'),
      '2026-10-20'
    );
    await user.type(
      within(modal).getByLabelText('Instrumento aplicado'),
      'Prueba X'
    );
    await user.type(
      within(modal).getByLabelText('Descripción y hallazgos *'),
      'Hallazgos.'
    );
    await user.click(within(modal).getByRole('button', { name: 'Lectura' }));
    await user.click(within(modal).getByRole('button', { name: '+ otra' }));
    await user.type(
      within(modal).getByLabelText('Nombre de la otra área'),
      'Memoria{Enter}'
    );
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );

    await waitFor(() =>
      expect(diagnosticosApi.crearDiagnostico).toHaveBeenCalledWith('menor-1', {
        tipo: 'Categoría ficticia',
        tipoPersonalizado: false,
        fechaEvaluacion: '2026-10-20',
        instrumento: 'Prueba X',
        descripcion: 'Hallazgos.',
        areasAfectadas: ['Lectura', 'Memoria'],
        estado: 'vigente',
      })
    );
    expect(
      await screen.findByText('Diagnóstico registrado correctamente')
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // El listado se vuelve a pedir para reflejar el registro.
    expect(diagnosticosApi.listarDiagnosticosMenor).toHaveBeenCalledTimes(2);
  });

  test('un borrador puede guardarse incompleto', async () => {
    diagnosticosApi.crearDiagnostico.mockResolvedValue({
      ...detalleVigente,
      estado: 'borrador',
      version: 0,
    });
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1?pestana=diagnosticos');

    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    const modal = screen.getByRole('dialog');
    await elegirTipo(user, modal, 'Categoría ficticia');
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar borrador' })
    );

    await waitFor(() =>
      expect(diagnosticosApi.crearDiagnostico).toHaveBeenCalledWith(
        'menor-1',
        expect.objectContaining({
          tipo: 'Categoría ficticia',
          estado: 'borrador',
        })
      )
    );
    expect(
      await screen.findByText('Borrador guardado correctamente')
    ).toBeInTheDocument();
  });

  test('pide confirmación al cerrar con cambios y conserva los datos si falla el guardado', async () => {
    diagnosticosApi.crearDiagnostico.mockRejectedValue(
      Object.assign(new Error('Network Error'), { request: {} })
    );
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1?pestana=diagnosticos');

    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    const modal = screen.getByRole('dialog');
    await elegirTipo(user, modal, 'Categoría ficticia');
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar borrador' })
    );

    expect(
      await screen.findByText('No se pudo conectar con el servidor')
    ).toBeInTheDocument();
    expect(within(modal).getByLabelText('Tipo de diagnóstico *')).toHaveValue(
      'Categoría ficticia'
    );

    await user.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    const aviso = screen.getByRole('alertdialog', {
      name: 'Cambios sin guardar',
    });
    await user.click(
      within(aviso).getByRole('button', { name: 'Seguir editando' })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Cerrar' }));
    await user.click(
      within(
        screen.getByRole('alertdialog', { name: 'Cambios sin guardar' })
      ).getByRole('button', { name: 'Descartar cambios' })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('el administrador no ve la opción de registrar en la ficha', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/menores/menor-1?pestana=diagnosticos');

    expect(await screen.findByText('Tipo ficticio actual')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ Nuevo diagnóstico' })
    ).not.toBeInTheDocument();
  });
});

describe('Tipo de diagnóstico en el formulario', () => {
  async function abrirFormulario() {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1?pestana=diagnosticos');
    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    return { user, modal: screen.getByRole('dialog') };
  }

  async function completarObligatorios(user, modal) {
    await user.type(
      within(modal).getByLabelText('Fecha de evaluación *'),
      '2026-10-20'
    );
    await user.type(
      within(modal).getByLabelText('Descripción y hallazgos *'),
      'Hallazgos.'
    );
  }

  test('ofrece las categorías del administrador y la opción «Otro»', async () => {
    const { modal } = await abrirFormulario();
    const selector = within(modal).getByLabelText('Tipo de diagnóstico *');

    await within(selector).findByRole('option', { name: 'Categoría ficticia' });
    expect(
      within(selector)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Seleccionar…', 'Categoría ficticia', 'Otro']);
    expect(
      within(modal).queryByLabelText('Especifique el tipo de diagnóstico *')
    ).not.toBeInTheDocument();
  });

  test('con «Otro» exige el tipo y lo envía como personalizado', async () => {
    diagnosticosApi.crearDiagnostico.mockResolvedValue({
      ...detalleVigente,
      tipo: 'Tipo personalizado ficticio',
      tipoPersonalizado: true,
      version: 1,
    });
    const { user, modal } = await abrirFormulario();
    await elegirTipo(user, modal, 'Otro');
    const campoOtro = within(modal).getByLabelText(
      'Especifique el tipo de diagnóstico *'
    );
    expect(campoOtro).toHaveFocus();
    await completarObligatorios(user, modal);

    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );
    expect(
      within(modal).getByText('El tipo de diagnóstico es obligatorio')
    ).toBeInTheDocument();

    // No puede repetir una categoría de la lista.
    await user.type(campoOtro, 'categoría FICTICIA');
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );
    expect(
      within(modal).getByText(
        'Ese tipo ya está en la lista; selecciónelo directamente'
      )
    ).toBeInTheDocument();
    expect(diagnosticosApi.crearDiagnostico).not.toHaveBeenCalled();

    await user.clear(campoOtro);
    await user.type(campoOtro, 'Tipo personalizado ficticio');
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );
    await waitFor(() =>
      expect(diagnosticosApi.crearDiagnostico).toHaveBeenCalledWith(
        'menor-1',
        expect.objectContaining({
          tipo: 'Tipo personalizado ficticio',
          tipoPersonalizado: true,
          estado: 'vigente',
        })
      )
    );
  });

  test('si no cargan las categorías lo informa, permite reintentar y «Otro» sigue disponible', async () => {
    diagnosticosApi.listarTiposDiagnostico.mockRejectedValueOnce(
      errorHttp(500, { error: 'Error interno' })
    );
    const { user, modal } = await abrirFormulario();

    expect(await within(modal).findByText(/Error interno/)).toBeInTheDocument();
    const selector = within(modal).getByLabelText('Tipo de diagnóstico *');
    expect(
      within(selector).getByRole('option', { name: 'Otro' })
    ).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Reintentar' }));
    expect(
      await within(selector).findByRole('option', {
        name: 'Categoría ficticia',
      })
    ).toBeInTheDocument();
    expect(within(modal).queryByText(/Error interno/)).not.toBeInTheDocument();
  });
});

describe('Búsqueda del menor al registrar desde el listado', () => {
  async function abrirDesdeListado() {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/diagnosticos');
    await user.click(
      await screen.findByRole('button', { name: '+ Nuevo diagnóstico' })
    );
    const modal = screen.getByRole('dialog');
    return {
      user,
      modal,
      buscador: within(modal).getByRole('combobox', { name: 'Menor *' }),
    };
  }

  test('al escribir un nombre despliega los menores que coinciden', async () => {
    const { user, modal, buscador } = await abrirDesdeListado();
    await user.type(buscador, 'ficticio');

    expect(buscador).toHaveAttribute('aria-expanded', 'true');
    expect(
      await within(modal).findByRole('option', {
        name: 'Menor Ficticio Uno RUT 12.345.678-5',
      })
    ).toBeInTheDocument();
    expect(
      within(modal).getByRole('option', {
        name: 'Menor Ficticio Dos RUT 7.654.321-6',
      })
    ).toBeInTheDocument();
    expect(menoresApi.buscarMenores).toHaveBeenLastCalledWith('ficticio');

    // Los resultados se actualizan a medida que se escribe.
    await user.type(buscador, ' dos');
    await waitFor(() =>
      expect(
        within(within(modal).getByRole('listbox')).getAllByRole('option')
      ).toHaveLength(1)
    );
    expect(
      within(modal).getByRole('option', { name: /Menor Ficticio Dos/ })
    ).toBeInTheDocument();
  });

  test('al escribir un RUT despliega el menor y con el teclado se selecciona', async () => {
    const { user, modal, buscador } = await abrirDesdeListado();
    await user.type(buscador, '12.345');

    await within(modal).findByRole('option', { name: /Menor Ficticio Uno/ });
    expect(
      within(within(modal).getByRole('listbox')).getAllByRole('option')
    ).toHaveLength(1);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(
      within(modal).getByText('Menor Ficticio Uno · RUT 12.345.678-5')
    ).toBeInTheDocument();
    expect(
      within(modal).queryByRole('combobox', { name: 'Menor *' })
    ).not.toBeInTheDocument();
    // Enter en el buscador no envía el formulario.
    expect(diagnosticosApi.crearDiagnostico).not.toHaveBeenCalled();

    await user.click(
      within(modal).getByRole('button', {
        name: 'Cambiar menor (Menor Ficticio Uno)',
      })
    );
    expect(
      within(modal).getByRole('combobox', { name: 'Menor *' })
    ).toHaveFocus();
  });

  test('sin coincidencias muestra un mensaje y la lista se cierra al salir del campo', async () => {
    const { user, modal, buscador } = await abrirDesdeListado();
    await user.type(buscador, 'inexistente');

    expect(
      await within(modal).findByText('No se encontraron menores')
    ).toBeInTheDocument();
    await user.tab();
    expect(buscador).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(modal).queryByText('No se encontraron menores')
    ).not.toBeInTheDocument();
  });

  test('informa los errores de la búsqueda', async () => {
    menoresApi.buscarMenores.mockRejectedValue(
      Object.assign(new Error('Network Error'), { request: {} })
    );
    const { user, modal, buscador } = await abrirDesdeListado();
    await user.type(buscador, 'uno');

    expect(within(modal).getByText('Buscando…')).toBeInTheDocument();
    expect(
      await within(modal).findByText('No se pudo conectar con el servidor')
    ).toBeInTheDocument();
  });
});

describe('Detalle y edición', () => {
  test('muestra el diagnóstico completo y permite consultar la versión anterior', async () => {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1/diagnosticos/diag-1');

    expect(
      await screen.findByText('Hallazgos ficticios actuales.')
    ).toBeInTheDocument();
    expect(screen.getByText('Instrumento ficticio')).toBeInTheDocument();
    expect(screen.getByText('v2 (actual)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver v1' }));
    expect(
      screen.getByText('Hallazgos ficticios anteriores.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Está viendo la versión v1/)).toBeInTheDocument();
    // Una versión anterior no se edita.
    expect(
      screen.queryByRole('button', { name: 'Editar' })
    ).not.toBeInTheDocument();
  });

  test('la edición carga los datos actuales y envía solo los cambios', async () => {
    diagnosticosApi.actualizarDiagnostico.mockResolvedValue({
      ...detalleVigente,
      instrumento: 'Instrumento corregido',
      version: 3,
      updatedAt: '2026-11-02T15:00:00.000Z',
    });
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1/diagnosticos/diag-1');

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByLabelText('Tipo de diagnóstico *')).toHaveValue(
      'Tipo ficticio actual'
    );
    expect(
      within(modal).getByText(/se crea la versión v3/)
    ).toBeInTheDocument();
    expect(
      within(modal).queryByRole('button', { name: 'Guardar borrador' })
    ).not.toBeInTheDocument();

    const instrumento = within(modal).getByLabelText('Instrumento aplicado');
    await user.clear(instrumento);
    await user.type(instrumento, 'Instrumento corregido');
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );

    await waitFor(() =>
      expect(diagnosticosApi.actualizarDiagnostico).toHaveBeenCalledWith(
        'menor-1',
        'diag-1',
        { instrumento: 'Instrumento corregido' },
        '2026-11-02T14:04:00.000Z'
      )
    );
    expect(
      await screen.findByText('Diagnóstico actualizado (v3)')
    ).toBeInTheDocument();
    expect(screen.getByText('Instrumento corregido')).toBeInTheDocument();
  });

  test('informa si otra persona modificó el diagnóstico', async () => {
    diagnosticosApi.actualizarDiagnostico.mockRejectedValue(
      errorHttp(409, {
        error: 'El diagnóstico fue modificado por otra persona.',
      })
    );
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1/diagnosticos/diag-1');

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const modal = screen.getByRole('dialog');
    await user.type(within(modal).getByLabelText('Instrumento aplicado'), ' 2');
    await user.click(
      within(modal).getByRole('button', { name: 'Guardar diagnóstico' })
    );

    expect(
      await screen.findByText('El diagnóstico fue modificado por otra persona.')
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('muestra el tipo personalizado y al editar lo carga en «Otro»', async () => {
    diagnosticosApi.obtenerDiagnostico.mockResolvedValue({
      ...detalleVigente,
      tipo: 'Tipo personalizado ficticio',
      tipoPersonalizado: true,
    });
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1/diagnosticos/diag-1');

    expect(
      await screen.findByText(/Otro \(ingresado por el profesional\)/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const modal = screen.getByRole('dialog');
    const selector = within(modal).getByLabelText('Tipo de diagnóstico *');
    expect(
      within(selector).getByRole('option', { name: 'Otro' }).selected
    ).toBe(true);
    expect(
      within(modal).getByLabelText('Especifique el tipo de diagnóstico *')
    ).toHaveValue('Tipo personalizado ficticio');
  });

  test('un tipo cuya categoría ya no está en la lista se conserva al editar', async () => {
    sesionComo(usuarioPsico);
    const user = userEvent.setup();
    renderApp('/menores/menor-1/diagnosticos/diag-1');

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const selector = within(screen.getByRole('dialog')).getByLabelText(
      'Tipo de diagnóstico *'
    );
    expect(
      await within(selector).findByRole('option', {
        name: 'Tipo ficticio actual (ya no está en la lista)',
      })
    ).toBeInTheDocument();
    expect(selector).toHaveValue('Tipo ficticio actual');
  });

  test('el administrador ve el detalle sin la opción de editar', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/menores/menor-1/diagnosticos/diag-1');

    await screen.findByText('Hallazgos ficticios actuales.');
    expect(
      screen.queryByRole('button', { name: 'Editar' })
    ).not.toBeInTheDocument();
  });

  test('muestra el error si no tiene acceso al diagnóstico', async () => {
    diagnosticosApi.obtenerDiagnostico.mockRejectedValue(
      errorHttp(403, {
        error: 'No tiene permisos para acceder a este expediente',
      })
    );
    sesionComo(usuarioPsico);
    renderApp('/menores/menor-2/diagnosticos/diag-1');

    expect(
      await screen.findByText(
        'No tiene permisos para acceder a este expediente'
      )
    ).toBeInTheDocument();
  });
});

describe('Tipos de diagnóstico', () => {
  test('el administrador agrega categorías', async () => {
    diagnosticosApi.crearTipoDiagnostico.mockResolvedValue({
      _id: 'tipo-2',
      nombre: 'Otra categoría',
      activo: true,
    });
    sesionComo(usuarioAdmin);
    const user = userEvent.setup();
    renderApp('/tipos-diagnostico');

    expect(await screen.findByText('Categoría ficticia')).toBeInTheDocument();
    expect(diagnosticosApi.listarTiposDiagnostico).toHaveBeenCalledWith({
      incluirInactivas: true,
    });
    await user.type(
      screen.getByLabelText('Nombre de la categoría *'),
      'Otra categoría'
    );
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(diagnosticosApi.crearTipoDiagnostico).toHaveBeenCalledWith(
      'Otra categoría'
    );
    expect(await screen.findByText('Otra categoría')).toBeInTheDocument();
  });

  test('el psicopedagogo no accede a la gestión de categorías', async () => {
    sesionComo(usuarioPsico);
    renderApp('/tipos-diagnostico');

    expect(
      await screen.findByRole('heading', { name: /no autorizado|sin permiso/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Tipos de diagnóstico' })
    ).not.toBeInTheDocument();
  });
});
