import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as menoresApi from '../api/menores';
import * as sesionesApi from '../api/sesiones';
import {
  errorHttp,
  renderApp,
  usuarioAdmin,
  usuarioPsico,
} from '../test-utils';
import { inicioSemana, sumarDias } from '../utils/calendario';
import { hoyParaCampo } from '../utils/formato';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');
jest.mock('../api/menores');
jest.mock('../api/diagnosticos');
jest.mock('../api/sesiones');

// Datos ficticios. La semana del 16 al 22 de noviembre de 2026.
const RUTA = '/calendario?vista=semana&fecha=2026-11-18';
const profesional = { _id: 'psico-1', nombre: 'Profesional Ficticio' };

function sesion(cambios = {}) {
  return {
    _id: 'ses-1',
    menor: { _id: 'menor-1', nombre: 'Menor Ficticio Uno' },
    profesional,
    estado: 'planificada',
    fecha: '2026-11-17T00:00:00.000Z',
    horaInicio: '09:00',
    horaFin: '09:45',
    primerObjetivo: 'Objetivo ficticio',
    totalObjetivos: 1,
    objetivosLogrados: 0,
    totalActividades: 2,
    ...cambios,
  };
}

function sesionComo(usuario) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
}

const ultimaConsulta = () => sesionesApi.obtenerCalendario.mock.lastCall[0];

beforeEach(() => {
  sesionesApi.obtenerCalendario.mockResolvedValue([
    sesion(),
    sesion({
      _id: 'ses-2',
      menor: { _id: 'menor-2', nombre: 'Menor Ficticio Dos' },
      fecha: '2026-11-19T00:00:00.000Z',
      horaInicio: '16:00',
      horaFin: '16:45',
      asistencia: 'inasistencia',
    }),
  ]);
  menoresApi.buscarMenores.mockResolvedValue([
    { _id: 'menor-1', nombre: 'Menor Ficticio Uno', rut: '12345678-5' },
  ]);
});

describe('Calendario semanal', () => {
  test('muestra cada sesión en su día con menor, horario, objetivo y profesional', async () => {
    sesionComo(usuarioPsico);
    renderApp(RUTA);

    expect(
      await screen.findByRole('heading', { name: '16/11/2026 – 20/11/2026' })
    ).toBeInTheDocument();
    const martes = await screen.findByRole('group', { name: 'Mar 17/11' });
    const bloque = within(martes).getByRole('link', {
      name: /Menor Ficticio Uno/,
    });
    expect(bloque).toHaveAttribute('href', '/menores/menor-1/sesiones/ses-1');
    expect(within(bloque).getByText('Objetivo ficticio')).toBeInTheDocument();
    expect(
      within(bloque).getByText('Profesional Ficticio')
    ).toBeInTheDocument();
    expect(within(bloque).getByText('Planificada')).toBeInTheDocument();
    // Se expande al pasar el mouse, sin el aviso nativo del navegador.
    expect(bloque).not.toHaveAttribute('title');
    expect(bloque).toHaveAccessibleName(/Objetivo: Objetivo ficticio/);
    expect(
      within(screen.getByRole('group', { name: 'Jue 19/11' })).getByRole(
        'link',
        { name: /Menor Ficticio Dos.*Inasistencia/ }
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Lun 16/11' })).queryByRole(
        'link'
      )
    ).not.toBeInTheDocument();
    // Sin sesiones el fin de semana, solo se muestran de lunes a viernes.
    expect(
      screen.queryByRole('group', { name: 'Sáb 21/11' })
    ).not.toBeInTheDocument();
    expect(sesionesApi.obtenerCalendario).toHaveBeenCalledWith({
      desde: '2026-11-16',
      hasta: '2026-11-22',
      mias: false,
      borradores: false,
      menor: null,
    });
    // Cada sesión aparece una sola vez.
    expect(screen.getAllByRole('link', { name: /Ver sesión/ })).toHaveLength(2);
  });

  test('agrega el sábado solo si esa semana tiene sesiones ese día', async () => {
    sesionComo(usuarioPsico);
    sesionesApi.obtenerCalendario.mockResolvedValue([
      sesion({ fecha: '2026-11-21T00:00:00.000Z' }),
    ]);
    renderApp(RUTA);

    const sabado = await screen.findByRole('group', { name: 'Sáb 21/11' });
    expect(within(sabado).getByRole('link')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Dom 22/11' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '16/11/2026 – 21/11/2026' })
    ).toBeInTheDocument();
  });

  test('los borradores sin horario aparecen en su fila', async () => {
    sesionComo(usuarioPsico);
    sesionesApi.obtenerCalendario.mockResolvedValue([
      sesion({ estado: 'borrador', horaInicio: undefined, horaFin: undefined }),
    ]);
    renderApp(RUTA);

    const fila = await screen.findByRole('group', {
      name: 'Sin horario Mar 17/11',
    });
    expect(
      within(fila).getByRole('link', { name: /Borrador/ })
    ).toBeInTheDocument();
  });

  test('navega entre semanas y vuelve a hoy', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp(RUTA);
    await screen.findByRole('group', { name: 'Mar 17/11' });

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(
      await screen.findByRole('heading', { name: '23/11/2026 – 27/11/2026' })
    ).toBeInTheDocument();
    expect(ultimaConsulta()).toMatchObject({
      desde: '2026-11-23',
      hasta: '2026-11-29',
    });

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await waitFor(() =>
      expect(ultimaConsulta()).toMatchObject({ desde: '2026-11-09' })
    );

    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    const lunes = inicioSemana(hoyParaCampo());
    await waitFor(() =>
      expect(ultimaConsulta()).toMatchObject({
        desde: lunes,
        hasta: sumarDias(lunes, 6),
      })
    );
  });
});

describe('Calendario mensual', () => {
  test('muestra la grilla del mes y «+N más» abre la semana del día', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    sesionesApi.obtenerCalendario.mockResolvedValue(
      ['08:00', '09:00', '10:00', '11:00'].map((hora, i) =>
        sesion({
          _id: `ses-${i}`,
          horaInicio: hora,
          horaFin: hora.replace(':00', ':45'),
        })
      )
    );
    const { router } = renderApp(RUTA);
    await screen.findByRole('group', { name: 'Mar 17/11' });

    await user.click(screen.getByRole('button', { name: 'Mes' }));
    expect(
      await screen.findByRole('heading', { name: 'Noviembre 2026' })
    ).toBeInTheDocument();
    expect(ultimaConsulta()).toMatchObject({
      desde: '2026-10-26',
      hasta: '2026-12-06',
    });
    const dia = await screen.findByRole('group', { name: '17/11/2026' });
    expect(within(dia).getAllByRole('link')).toHaveLength(3);
    // El bloque compacto del mes no se expande: conserva el aviso con el detalle.
    expect(within(dia).getAllByRole('link')[0]).toHaveAttribute(
      'title',
      expect.stringContaining('Profesional: Profesional Ficticio')
    );

    await user.click(
      within(dia).getByRole('button', {
        name: 'Ver 1 sesión más del 17/11/2026',
      })
    );
    expect(router.state.location.search).toBe('?vista=semana&fecha=2026-11-17');
    const martes = await screen.findByRole('group', { name: 'Mar 17/11' });
    expect(within(martes).getAllByRole('link')).toHaveLength(4);
  });

  test('navega entre meses', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp('/calendario?vista=mes&fecha=2026-12-10');

    await screen.findByRole('heading', { name: 'Diciembre 2026' });
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(
      await screen.findByRole('heading', { name: 'Enero 2027' })
    ).toBeInTheDocument();
    expect(ultimaConsulta()).toMatchObject({
      desde: '2026-12-28',
      hasta: '2027-02-07',
    });
  });
});

describe('Filtros y permisos', () => {
  test('el psicopedagogo filtra por sus sesiones, por borradores y por menor', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    renderApp(RUTA);
    await screen.findByRole('group', { name: 'Mar 17/11' });

    await user.click(screen.getByRole('button', { name: 'Solo mis sesiones' }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ mias: true }));
    await user.click(screen.getByRole('button', { name: 'Sin planificar' }));
    await waitFor(() =>
      expect(ultimaConsulta()).toMatchObject({ mias: true, borradores: true })
    );

    await user.type(
      screen.getByRole('combobox', { name: /Filtrar por menor/ }),
      'Ficticio'
    );
    await user.click(
      await screen.findByRole('option', { name: /Menor Ficticio Uno/ })
    );
    await waitFor(() =>
      expect(ultimaConsulta()).toMatchObject({ menor: 'menor-1' })
    );
  });

  test('el administrador consulta sin «+ Sesión» ni «Solo mis sesiones»', async () => {
    sesionComo(usuarioAdmin);
    renderApp(RUTA);

    await screen.findByRole('group', { name: 'Mar 17/11' });
    expect(
      screen.queryByRole('button', { name: '+ Sesión' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Solo mis sesiones' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sin planificar' })
    ).toBeInTheDocument();
  });

  test('el psicopedagogo puede abrir el registro de una sesión', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    const { router } = renderApp(RUTA);
    await screen.findByRole('group', { name: 'Mar 17/11' });

    await user.click(screen.getByRole('button', { name: '+ Sesión' }));
    expect(router.state.location.pathname).toBe('/sesiones/nueva');
  });
});

describe('Estados de carga, vacío y error', () => {
  test('muestra la carga mientras consulta', async () => {
    sesionComo(usuarioPsico);
    sesionesApi.obtenerCalendario.mockReturnValue(new Promise(() => {}));
    renderApp(RUTA);

    expect(await screen.findByText('Cargando calendario…')).toBeInTheDocument();
  });

  test('informa cuando no hay sesiones en el período', async () => {
    sesionComo(usuarioPsico);
    sesionesApi.obtenerCalendario.mockResolvedValue([]);
    renderApp(RUTA);

    expect(
      await screen.findByText('No hay sesiones en este período.')
    ).toBeInTheDocument();
    // La grilla se sigue mostrando para navegar.
    expect(
      screen.getByRole('group', { name: 'Lun 16/11' })
    ).toBeInTheDocument();
  });

  test('muestra el error dentro de la página y permite reintentar', async () => {
    const user = userEvent.setup();
    sesionComo(usuarioPsico);
    sesionesApi.obtenerCalendario
      .mockRejectedValueOnce(
        errorHttp(500, { error: 'Error interno del servidor' })
      )
      .mockResolvedValue([sesion()]);
    renderApp(RUTA);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error interno del servidor'
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('link', { name: /Menor Ficticio Uno/ })
    ).toBeInTheDocument();
  });
});
