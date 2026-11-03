import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  apoderado: null,
  antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
  profesionalesAsignados: [],
  activo: true,
};

const diagnosticoVigente = {
  _id: 'diag-1',
  menor: 'menor-1',
  tipo: 'Tipo ficticio',
  fechaEvaluacion: '2026-10-01T00:00:00.000Z',
  estado: 'vigente',
  version: 2,
};

const profesional = { _id: 'psico-1', nombre: 'Profesional Ficticio' };

const resumenSesion = {
  _id: 'ses-1',
  menor: { _id: 'menor-1', nombre: 'Menor Ficticio Uno' },
  profesional,
  estado: 'planificada',
  fecha: '2099-01-15T00:00:00.000Z',
  horaInicio: '09:00',
  horaFin: '09:45',
  totalObjetivos: 2,
  objetivosLogrados: 0,
  totalActividades: 3,
  numero: 1,
  updatedAt: '2026-11-02T14:04:00.000Z',
};

function detalleSesion(cambios = {}) {
  return {
    _id: 'ses-1',
    menor: { _id: 'menor-1', nombre: 'Menor Ficticio Uno' },
    profesional,
    actualizadoPor: profesional,
    diagnostico: { ...diagnosticoVigente },
    diagnosticoVersion: 2,
    estado: 'planificada',
    fecha: '2099-01-15T00:00:00.000Z',
    horaInicio: '09:00',
    horaFin: '09:45',
    objetivos: [{ descripcion: 'Objetivo ficticio' }],
    actividades: ['Actividad ficticia'],
    numero: 3,
    updatedAt: '2026-11-02T14:04:00.000Z',
    ...cambios,
  };
}

function sesionComo(usuario) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
}

// La ficha del menor abierta en la pestaña "Sesiones".
async function esperarPestanaSesiones(router) {
  expect(
    await screen.findByRole('heading', { name: 'Menor Ficticio Uno · 10 años' })
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Sesiones (1)' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(router.state.location.pathname).toBe('/menores/menor-1');
  expect(router.state.location.search).toBe('?pestana=sesiones');
}

function region(nombre) {
  return screen.getByRole('region', { name: nombre });
}

beforeEach(() => {
  menoresApi.obtenerMenor.mockResolvedValue(menorFicticio);
  menoresApi.listarDocumentos.mockResolvedValue({
    documentos: [],
    limites: { maxBytes: 10485760, extensiones: ['.pdf'], mimes: [] },
  });
  diagnosticosApi.listarDiagnosticosMenor.mockResolvedValue([
    diagnosticoVigente,
  ]);
  sesionesApi.listarSesiones.mockResolvedValue({
    sesiones: [resumenSesion],
    total: 1,
    pagina: 1,
    limite: 20,
  });
  sesionesApi.listarSesionesMenor.mockResolvedValue([resumenSesion]);
  sesionesApi.obtenerContextoSesion.mockResolvedValue({
    _id: 'ses-0',
    fecha: '2026-10-20T00:00:00.000Z',
    horaInicio: '10:00',
    horaFin: '10:45',
    totalObjetivos: 3,
    objetivosLogrados: 2,
    observaciones: 'Observación previa ficticia.',
  });
  sesionesApi.obtenerSesion.mockResolvedValue({
    sesion: detalleSesion(),
    anterior: null,
  });
});

describe('Listado de sesiones', () => {
  test('muestra la agenda con fecha DD/MM/AAAA, menor, horario y estado', async () => {
    sesionComo(usuarioPsico);
    renderApp('/sesiones');

    expect(
      await screen.findByRole('heading', { name: 'Sesiones (1)' })
    ).toBeInTheDocument();
    const fila = screen
      .getByRole('link', { name: 'Menor Ficticio Uno' })
      .closest('tr');
    expect(within(fila).getByText('15/01/2099')).toBeInTheDocument();
    expect(within(fila).getByText('09:00 – 09:45')).toBeInTheDocument();
    expect(within(fila).getByText('2 objetivos')).toBeInTheDocument();
    expect(within(fila).getByText('Planificada')).toBeInTheDocument();
    expect(sesionesApi.listarSesiones).toHaveBeenCalledWith({
      vista: 'proximas',
      mias: false,
      pagina: 1,
    });
  });

  test('filtra por vista y por las sesiones del profesional', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp('/sesiones');
    await screen.findByRole('heading', { name: 'Sesiones (1)' });

    await user.click(screen.getByRole('button', { name: 'Anteriores' }));
    await waitFor(() =>
      expect(sesionesApi.listarSesiones).toHaveBeenLastCalledWith({
        vista: 'anteriores',
        mias: false,
        pagina: 1,
      })
    );
    await user.click(screen.getByRole('button', { name: 'Solo mis sesiones' }));
    await waitFor(() =>
      expect(sesionesApi.listarSesiones).toHaveBeenLastCalledWith({
        vista: 'anteriores',
        mias: true,
        pagina: 1,
      })
    );
  });

  test('el administrador consulta sin opciones de registro', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/sesiones');

    await screen.findByRole('heading', { name: 'Sesiones (1)' });
    expect(
      screen.queryByRole('button', { name: '+ Nueva sesión' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Solo mis sesiones' })
    ).not.toBeInTheDocument();
  });

  test('informa dentro de la página si no se puede cargar', async () => {
    sesionComo(usuarioPsico);
    sesionesApi.listarSesiones.mockRejectedValue(
      errorHttp(500, { error: 'Error interno del servidor' })
    );
    renderApp('/sesiones');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error interno del servidor'
    );
  });
});

describe('Sesiones en la ficha del menor', () => {
  test('la pestaña muestra la cantidad y el historial numerado', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp('/menores/menor-1');

    await user.click(await screen.findByRole('tab', { name: 'Sesiones (1)' }));
    const fila = screen.getByText('Sesión 1').closest('tr');
    expect(within(fila).getByText('15/01/2099')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '+ Nueva sesión' })
    ).toHaveAttribute('href', '/sesiones/nueva?menor=menor-1');
  });
});

describe('Registro de una planificación', () => {
  test('valida los campos obligatorios sin enviar la solicitud', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp('/sesiones/nueva?menor=menor-1');

    await screen.findByRole('heading', {
      name: 'Nueva sesión — Menor Ficticio Uno',
    });
    await screen.findByText('Observación previa ficticia.');
    await user.click(screen.getByRole('button', { name: 'Guardar sesión' }));

    expect(screen.getByText('La fecha es obligatoria')).toBeInTheDocument();
    expect(
      screen.getByText('La hora de inicio es obligatoria')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Agregue al menos un objetivo')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Agregue al menos una actividad')
    ).toBeInTheDocument();
    expect(sesionesApi.crearSesion).not.toHaveBeenCalled();
  });

  test('registra la sesión asociada al menor y al diagnóstico vigente', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    sesionesApi.crearSesion.mockResolvedValue({
      sesion: detalleSesion(),
      anterior: null,
    });
    const { router } = renderApp('/sesiones/nueva?menor=menor-1');

    await screen.findByText('Observación previa ficticia.');
    // El diagnóstico vigente más reciente queda preseleccionado.
    expect(screen.getByLabelText('Diagnóstico asociado')).toHaveValue('diag-1');

    fireEvent.change(screen.getByLabelText('Fecha *'), {
      target: { value: '2099-01-15' },
    });
    fireEvent.change(screen.getByLabelText('Hora de inicio *'), {
      target: { value: '09:00' },
    });
    fireEvent.change(screen.getByLabelText('Hora de término *'), {
      target: { value: '09:45' },
    });
    const objetivos = region(/Objetivos de la sesión/);
    await user.click(
      within(objetivos).getByRole('button', { name: '+ agregar' })
    );
    await user.type(screen.getByLabelText('Objetivo 1'), 'Objetivo ficticio');
    const actividades = region(/Actividades planificadas/);
    await user.click(
      within(actividades).getByRole('button', { name: '+ agregar' })
    );
    await user.type(screen.getByLabelText('Actividad 1'), 'Actividad ficticia');
    await user.click(screen.getByRole('button', { name: 'Guardar sesión' }));

    await waitFor(() =>
      expect(sesionesApi.crearSesion).toHaveBeenCalledWith('menor-1', {
        fecha: '2099-01-15',
        horaInicio: '09:00',
        horaFin: '09:45',
        diagnostico: 'diag-1',
        objetivos: [{ descripcion: 'Objetivo ficticio' }],
        actividades: ['Actividad ficticia'],
        asistencia: null,
        observaciones: '',
        estado: 'planificada',
      })
    );
    // Una vez guardada vuelve a la pestaña "Sesiones" de la ficha, que recarga el listado.
    await esperarPestanaSesiones(router);
    expect(
      await screen.findByText('Sesión planificada correctamente')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Guardando…' })
    ).not.toBeInTheDocument();
    expect(sesionesApi.listarSesionesMenor).toHaveBeenCalledWith('menor-1');
  });

  test('muestra en la página los errores informados por el servidor', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    sesionesApi.crearSesion.mockRejectedValue(
      errorHttp(400, {
        error: 'Datos inválidos',
        detalles: {
          diagnostico: 'Seleccione un diagnóstico vigente de este menor',
        },
      })
    );
    renderApp('/sesiones/nueva?menor=menor-1');
    await screen.findByText('Observación previa ficticia.');

    fireEvent.change(screen.getByLabelText('Hora de inicio *'), {
      target: { value: '10:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(
      await screen.findByText('Seleccione un diagnóstico vigente de este menor')
    ).toBeInTheDocument();
    expect(screen.getByText('Datos inválidos')).toBeInTheDocument();
    expect(sesionesApi.crearSesion).toHaveBeenCalledWith(
      'menor-1',
      expect.objectContaining({ estado: 'borrador', horaInicio: '10:00' })
    );
    // Si falla, sigue en el formulario y se puede volver a intentar.
    expect(
      screen.getByRole('button', { name: 'Guardar borrador' })
    ).toBeEnabled();
    expect(screen.getByLabelText('Hora de inicio *')).toBeEnabled();
  });

  test('valida que la hora de término sea posterior a la de inicio', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp('/sesiones/nueva?menor=menor-1');
    await screen.findByText('Observación previa ficticia.');

    fireEvent.change(screen.getByLabelText('Hora de inicio *'), {
      target: { value: '10:00' },
    });
    fireEvent.change(screen.getByLabelText('Hora de término *'), {
      target: { value: '09:30' },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(
      screen.getByText('La hora de término debe ser posterior a la de inicio')
    ).toBeInTheDocument();
    expect(sesionesApi.crearSesion).not.toHaveBeenCalled();
  });
});

describe('Detalle y registro post-sesión', () => {
  test('antes de la fecha, el registro post-sesión está bloqueado', async () => {
    sesionComo(usuarioPsico);
    renderApp('/menores/menor-1/sesiones/ses-1');

    await screen.findByRole('heading', {
      name: 'Sesión 3 — Menor Ficticio Uno',
    });
    expect(
      screen.getByText('Se habilita desde la fecha de la sesión.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asistió' })).toBeDisabled();
    expect(screen.getByLabelText('Observaciones')).toBeDisabled();
  });

  test('desde la fecha registra asistencia y logro con control de versión', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    sesionesApi.obtenerSesion.mockResolvedValue({
      sesion: detalleSesion({ fecha: '2026-01-10T00:00:00.000Z' }),
      anterior: null,
    });
    sesionesApi.actualizarSesion.mockResolvedValue({
      sesion: detalleSesion({
        fecha: '2026-01-10T00:00:00.000Z',
        asistencia: 'asistio',
        objetivos: [{ descripcion: 'Objetivo ficticio', logrado: true }],
        updatedAt: '2026-11-02T15:00:00.000Z',
      }),
      anterior: null,
      campos: ['asistencia', 'logroObjetivos'],
    });
    const { router } = renderApp('/menores/menor-1/sesiones/ses-1');
    await screen.findByRole('heading', {
      name: 'Sesión 3 — Menor Ficticio Uno',
    });

    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    await user.click(screen.getByRole('button', { name: 'Logrado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(sesionesApi.actualizarSesion).toHaveBeenCalledWith(
        'menor-1',
        'ses-1',
        {
          asistencia: 'asistio',
          objetivos: [{ descripcion: 'Objetivo ficticio', logrado: true }],
        },
        '2026-11-02T14:04:00.000Z'
      )
    );
    await esperarPestanaSesiones(router);
    expect(
      await screen.findByText('Cambios guardados correctamente')
    ).toBeInTheDocument();
  });

  test('el administrador ve la planificación en modo de solo lectura', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/menores/menor-1/sesiones/ses-1');

    await screen.findByRole('heading', {
      name: 'Sesión 3 — Menor Ficticio Uno',
    });
    expect(screen.getByLabelText('Fecha *')).toBeDisabled();
    expect(screen.getByLabelText('Objetivo 1')).toHaveValue(
      'Objetivo ficticio'
    );
    expect(
      screen.queryByRole('button', { name: /Guardar/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ agregar' })
    ).not.toBeInTheDocument();
  });

  test('el administrador no puede abrir el registro de una sesión nueva', async () => {
    sesionComo(usuarioAdmin);
    renderApp('/sesiones/nueva?menor=menor-1');

    expect(
      await screen.findByRole('heading', { name: 'Acceso no autorizado' })
    ).toBeInTheDocument();
    expect(sesionesApi.crearSesion).not.toHaveBeenCalled();
  });
});

describe('Hora de término propuesta', () => {
  async function abrirNueva() {
    sesionComo(usuarioPsico);
    renderApp('/sesiones/nueva?menor=menor-1');
    await screen.findByText('Observación previa ficticia.');
  }

  const cambiarHora = (etiqueta, valor) =>
    fireEvent.change(screen.getByLabelText(etiqueta), {
      target: { value: valor },
    });

  test('propone 45 minutos después del inicio y se puede editar', async () => {
    await abrirNueva();

    cambiarHora('Hora de inicio *', '10:00');
    expect(screen.getByLabelText('Hora de término *')).toHaveValue('10:45');

    // Mientras no se modifique, sigue al inicio.
    cambiarHora('Hora de inicio *', '10:15');
    expect(screen.getByLabelText('Hora de término *')).toHaveValue('11:00');

    // Una hora de término ingresada a mano se respeta.
    cambiarHora('Hora de término *', '11:30');
    cambiarHora('Hora de inicio *', '10:30');
    expect(screen.getByLabelText('Hora de término *')).toHaveValue('11:30');
  });

  test('no propone una hora que pase de medianoche', async () => {
    await abrirNueva();

    cambiarHora('Hora de inicio *', '23:30');
    expect(screen.getByLabelText('Hora de término *')).toHaveValue('');
  });

  test('en una sesión planificada no cambia la hora de término', async () => {
    sesionComo(usuarioPsico);
    renderApp('/menores/menor-1/sesiones/ses-1');
    await screen.findByRole('heading', {
      name: 'Sesión 3 — Menor Ficticio Uno',
    });

    cambiarHora('Hora de inicio *', '09:15');
    expect(screen.getByLabelText('Hora de término *')).toHaveValue('09:45');
  });
});

describe('Colores de los estados', () => {
  test('«Planificada» usa el color principal y la asistencia su color', async () => {
    sesionComo(usuarioPsico);
    sesionesApi.listarSesiones.mockResolvedValue({
      sesiones: [{ ...resumenSesion, asistencia: 'inasistencia' }],
      total: 1,
      pagina: 1,
      limite: 20,
    });
    renderApp('/sesiones');

    const fila = (
      await screen.findByRole('link', { name: 'Menor Ficticio Uno' })
    ).closest('tr');
    expect(within(fila).getByText('Planificada')).toHaveStyle({
      color: '#b8496f',
      borderColor: '#b8496f',
    });
    expect(within(fila).getByText('Inasistencia')).toHaveStyle({
      color: '#a33333',
      backgroundColor: '#fdf5f5',
    });
  });

  test('la asistencia elegida en el registro post-sesión toma su color', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    sesionesApi.obtenerSesion.mockResolvedValue({
      sesion: detalleSesion({ fecha: '2026-01-10T00:00:00.000Z' }),
      anterior: null,
    });
    renderApp('/menores/menor-1/sesiones/ses-1');
    await screen.findByRole('heading', {
      name: 'Sesión 3 — Menor Ficticio Uno',
    });

    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    expect(screen.getByRole('button', { name: 'Asistió' })).toHaveStyle({
      color: '#05603a',
      backgroundColor: '#ecfdf3',
    });
  });
});
