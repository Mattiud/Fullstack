import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as menoresApi from '../api/menores';
import * as diagnosticosApi from '../api/diagnosticos';
import * as sesionesApi from '../api/sesiones';
import * as informesApi from '../api/informes';
import * as actividadApi from '../api/actividad';
import { hoyParaCampo } from '../utils/formato';
import { etiquetaDia, inicioSemana, sumarDias } from '../utils/calendario';
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
jest.mock('../api/informes');
jest.mock('../api/actividad');

// Datos ficticios, con fechas relativas al día en que corre la prueba.
const hoy = hoyParaCampo();
const menor = { _id: 'menor-1', nombre: 'Menor Ficticio Uno' };

function sesion(id, fecha, estado, cambios = {}) {
  return {
    _id: id,
    menor,
    fecha: `${fecha}T00:00:00.000Z`,
    horaInicio: '09:00',
    horaFin: '09:45',
    estado,
    primerObjetivo: null,
    ...cambios,
  };
}

const sesiones = [
  sesion('s-hoy', hoy, 'planificada', {
    primerObjetivo: 'Comprensión lectora',
  }),
  sesion('s-borrador', sumarDias(hoy, 1), 'borrador'),
  // Fuera de la semana actual: no cuenta en el indicador, pero es una próxima sesión.
  sesion('s-lejana', sumarDias(inicioSemana(hoy), 14), 'planificada'),
];

const informeDelMes = {
  _id: 'informe-1',
  menor,
  fechaInforme: `${hoy}T00:00:00.000Z`,
  ultimoPdf: { version: 1 },
  pdfDesactualizado: false,
};

const actividadPsico = [
  {
    _id: 'a1',
    fecha: '2026-11-09T14:04:00.000Z',
    accion: 'MENOR_ACTUALIZADO',
    detalle: { campos: ['curso'] },
    usuario: { nombre: 'Profesional Ficticio' },
    menor,
    afectado: null,
  },
];

beforeEach(() => {
  menoresApi.listarMenores.mockResolvedValue({ menores: [], total: 6 });
  diagnosticosApi.listarDiagnosticos.mockResolvedValue({
    diagnosticos: [],
    total: 4,
  });
  sesionesApi.obtenerCalendario.mockResolvedValue(sesiones);
  informesApi.listarInformes.mockImplementation(async ({ estado }) =>
    estado === 'pendientes'
      ? { informes: [], total: 2 }
      : { informes: [informeDelMes], total: 1 }
  );
  actividadApi.obtenerActividadReciente.mockResolvedValue(actividadPsico);
});

function iniciar(usuario) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
  const user = userEvent.setup();
  const { router } = renderApp('/');
  return { user, router };
}

function indicador(nombre) {
  return screen.getByRole('link', { name: new RegExp(nombre) });
}

describe('Panel de inicio del psicopedagogo', () => {
  test('muestra los cuatro indicadores con los datos del sistema', async () => {
    iniciar(usuarioPsico);
    await screen.findByRole('heading', { name: 'Panel de inicio' });
    await waitFor(() =>
      expect(indicador('Menores activos')).toHaveTextContent('6')
    );
    const indicadores = within(
      screen.getByLabelText('Indicadores')
    ).getAllByRole('link');
    expect(indicadores.map((i) => i.firstChild.textContent)).toEqual([
      'Menores activos',
      'Sesiones esta semana',
      'Informes pendientes',
      'Diagnósticos vigentes',
    ]);
    // Solo la sesión planificada de esta semana cuenta.
    expect(indicador('Sesiones esta semana')).toHaveTextContent('1');
    expect(indicador('Informes pendientes')).toHaveTextContent('2');
    expect(indicador('Diagnósticos vigentes')).toHaveTextContent('4');
    expect(indicador('Menores activos')).toHaveAttribute('href', '/menores');
    expect(indicador('Informes pendientes')).toHaveAttribute(
      'href',
      '/informes'
    );

    expect(menoresApi.listarMenores).toHaveBeenCalledWith({
      estado: 'activos',
    });
    expect(diagnosticosApi.listarDiagnosticos).toHaveBeenCalledWith({
      estado: 'vigente',
    });
    const lunes = inicioSemana(hoy);
    expect(sesionesApi.obtenerCalendario).toHaveBeenCalledWith({
      desde: lunes,
      hasta: sumarDias(lunes, 41),
    });
    expect(informesApi.listarInformes).toHaveBeenCalledWith({
      estado: 'pendientes',
    });
    expect(informesApi.listarInformes).toHaveBeenCalledWith({
      mes: hoy.slice(0, 7),
    });
  });

  test('lista las próximas sesiones, los informes del mes y la actividad', async () => {
    iniciar(usuarioPsico);
    const proximas = await screen.findByRole('region', {
      name: 'Próximas sesiones',
    });
    const filas = await within(proximas).findAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent(
      `Menor Ficticio Uno · Comprensión lectora${etiquetaDia(hoy)} · 09:00 – 09:45`
    );
    expect(filas[0]).toHaveTextContent('Planificada');
    expect(filas[1]).toHaveTextContent('Borrador');
    expect(within(filas[0]).getByRole('link')).toHaveAttribute(
      'href',
      '/menores/menor-1/sesiones/s-hoy'
    );
    expect(
      within(proximas).getByRole('link', { name: 'Ver calendario →' })
    ).toHaveAttribute('href', '/calendario');

    const informes = screen.getByRole('region', { name: 'Informes del mes' });
    const informe = await within(informes).findByRole('link');
    expect(informe).toHaveTextContent('Menor Ficticio Uno —');
    expect(informe).toHaveTextContent('PDF v1');
    expect(informe).toHaveAttribute(
      'href',
      '/menores/menor-1/informes/informe-1'
    );

    const actividad = screen.getByRole('region', {
      name: 'Actividad reciente (trazabilidad)',
    });
    expect(
      await within(actividad).findByText(
        /Profesional Ficticio actualizó: curso · Menor Ficticio Uno ·/
      )
    ).toBeInTheDocument();
  });

  test('ofrece «+ Nueva sesión» y el buscador abre la ficha del menor', async () => {
    menoresApi.buscarMenores.mockResolvedValue([
      { ...menor, rut: '12345678-5' },
    ]);
    menoresApi.obtenerMenor.mockResolvedValue({
      ...menor,
      rut: '12345678-5',
      fechaNacimiento: '2016-03-12T00:00:00.000Z',
      fechaIngreso: '2026-03-04T00:00:00.000Z',
      antecedentesRelevantes: 'Antecedentes ficticios.',
      profesionalesAsignados: [],
      activo: true,
    });
    menoresApi.listarDocumentos.mockResolvedValue({
      documentos: [],
      limites: { maxBytes: 1, extensiones: [], mimes: [] },
    });
    diagnosticosApi.listarDiagnosticosMenor.mockResolvedValue([]);
    sesionesApi.listarSesionesMenor.mockResolvedValue([]);
    informesApi.listarInformesMenor.mockResolvedValue([]);

    const { user, router } = iniciar(usuarioPsico);
    expect(
      await screen.findByRole('link', { name: '+ Nueva sesión' })
    ).toHaveAttribute('href', '/sesiones/nueva');

    await user.type(
      screen.getByRole('combobox', { name: 'Buscar menor' }),
      'Ficticio'
    );
    await user.click(
      await screen.findByRole('option', { name: /Menor Ficticio Uno/ })
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/menores/menor-1')
    );
  });

  test('muestra estados vacíos y de error en cada panel sin afectar a los demás', async () => {
    sesionesApi.obtenerCalendario.mockResolvedValue([]);
    informesApi.listarInformes.mockResolvedValue({ informes: [], total: 0 });
    actividadApi.obtenerActividadReciente.mockRejectedValue(
      errorHttp(500, { error: 'Error interno del servidor' })
    );
    iniciar(usuarioPsico);

    expect(
      await screen.findByText('No hay sesiones próximas registradas.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('No hay informes con fecha de este mes.')
    ).toBeInTheDocument();
    const actividad = screen.getByRole('region', {
      name: 'Actividad reciente (trazabilidad)',
    });
    expect(await within(actividad).findByRole('alert')).toHaveTextContent(
      'Error interno del servidor'
    );
    expect(indicador('Sesiones esta semana')).toHaveTextContent('0');
    expect(indicador('Menores activos')).toHaveTextContent('6');
  });

  test('un indicador que no se puede cargar se marca como no disponible', async () => {
    diagnosticosApi.listarDiagnosticos.mockRejectedValue(
      errorHttp(500, { error: 'Error interno del servidor' })
    );
    iniciar(usuarioPsico);
    await waitFor(() =>
      expect(indicador('Diagnósticos vigentes')).toHaveTextContent(
        'No disponible'
      )
    );
    expect(indicador('Menores activos')).toHaveTextContent('6');
  });
});

describe('Panel de inicio del administrador', () => {
  test('no muestra informes ni «+ Nueva sesión» y ve los cambios administrativos', async () => {
    actividadApi.obtenerActividadReciente.mockResolvedValue([
      {
        _id: 'a2',
        fecha: '2026-11-09T15:00:00.000Z',
        accion: 'USUARIO_ACTUALIZADO',
        detalle: { activo: false },
        usuario: { nombre: 'Admin Ficticio' },
        menor: null,
        afectado: { _id: 'psico-1', nombre: 'Profesional Ficticio' },
      },
    ]);
    iniciar(usuarioAdmin);
    await screen.findByRole('heading', { name: 'Panel de inicio' });
    await waitFor(() =>
      expect(indicador('Menores activos')).toHaveTextContent('6')
    );

    const indicadores = within(
      screen.getByLabelText('Indicadores')
    ).getAllByRole('link');
    expect(indicadores.map((i) => i.firstChild.textContent)).toEqual([
      'Menores activos',
      'Sesiones esta semana',
      'Diagnósticos vigentes',
    ]);
    expect(
      screen.queryByRole('region', { name: 'Informes del mes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '+ Nueva sesión' })
    ).not.toBeInTheDocument();
    expect(informesApi.listarInformes).not.toHaveBeenCalled();

    // Consulta las próximas sesiones y la actividad del sistema.
    expect(
      await screen.findByText(/Menor Ficticio Uno · Comprensión lectora/)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Admin Ficticio desactivó la cuenta de Profesional Ficticio ·/
      )
    ).toBeInTheDocument();
  });
});
