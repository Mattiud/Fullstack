const request = require('supertest');
const AuditLog = require('../src/models/AuditLog');
const { ROLES } = require('../src/config/roles');
const { app, usarBaseDeDatosDePrueba, crearUsuario, iniciarSesion } = require('./helpers');

usarBaseDeDatosDePrueba();

const RUTA = '/api/actividad-reciente';

// Datos ficticios: los RUT son válidos según el dígito verificador pero no corresponden a nadie.
function datosMenor(cambios = {}) {
  return {
    nombre: 'Menor Ficticio Uno',
    rut: '12.345.678-5',
    fechaNacimiento: '2016-03-12',
    fechaIngreso: '2026-03-04',
    apoderado: { nombre: 'Apoderado Ficticio', parentesco: 'Madre', telefono: '+56 9 1234 5678' },
    antecedentesRelevantes: 'Antecedentes de ejemplo sin datos reales.',
    ...cambios,
  };
}

let psico;
let adminAgent;
let psicoAgent;
let otroAgent;
let menor;

beforeEach(async () => {
  const admin = await crearUsuario({ rol: ROLES.ADMIN });
  psico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  const otroPsico = await crearUsuario({ rol: ROLES.PSICOPEDAGOGO });
  adminAgent = await iniciarSesion(admin.email);
  psicoAgent = await iniciarSesion(psico.email);
  otroAgent = await iniciarSesion(otroPsico.email);

  // Cada psicopedagogo queda asignado al menor que registra.
  menor = (await psicoAgent.post('/api/menores').send(datosMenor())).body.menor;
  await otroAgent
    .post('/api/menores')
    .send(datosMenor({ nombre: 'Menor Ficticio Dos', rut: '7.654.321-6' }));
});

describe('Actividad reciente', () => {
  test('el psicopedagogo solo ve los cambios de sus menores, con el nombre del menor', async () => {
    await psicoAgent.patch(`/api/menores/${menor._id}`).send({ curso: '5° básico' });
    // Las consultas no son cambios y no se muestran.
    await psicoAgent.get(`/api/menores/${menor._id}`);

    const res = await psicoAgent.get(RUTA);
    expect(res.status).toBe(200);
    const acciones = res.body.actividad.map((r) => r.accion);
    expect(acciones).toEqual(['MENOR_ACTUALIZADO', 'MENOR_CREADO']);
    expect(res.body.actividad[0]).toMatchObject({
      usuario: { nombre: psico.nombre },
      menor: { _id: menor._id, nombre: 'Menor Ficticio Uno' },
      detalle: { campos: ['curso'] },
      afectado: null,
    });
    // El menor del otro profesional no aparece.
    expect(JSON.stringify(res.body)).not.toContain('Menor Ficticio Dos');
    expect(JSON.stringify(res.body)).not.toContain('5° básico');
  });

  test('el administrador ve los cambios de todos los expedientes y los administrativos', async () => {
    await adminAgent.post('/api/tipos-diagnostico').send({ nombre: 'Categoría ficticia' });
    const res = await adminAgent.get(RUTA);
    expect(res.status).toBe(200);
    const acciones = res.body.actividad.map((r) => r.accion);
    expect(acciones[0]).toBe('TIPO_DIAGNOSTICO_CREADO');
    expect(acciones.filter((a) => a === 'MENOR_CREADO')).toHaveLength(2);
    // Sin inicios de sesión ni consultas.
    expect(acciones.some((a) => a.startsWith('LOGIN') || a.endsWith('CONSULTADO'))).toBe(false);
    expect(await AuditLog.countDocuments({ accion: 'LOGIN_EXITOSO' })).toBe(3);
  });

  test('muestra el nombre de la cuenta afectada en los cambios de usuarios', async () => {
    await adminAgent.patch(`/api/users/${psico._id}`).send({ activo: false });
    const res = await adminAgent.get(RUTA);
    expect(res.body.actividad[0]).toMatchObject({
      accion: 'USUARIO_ACTUALIZADO',
      afectado: { nombre: psico.nombre },
      menor: null,
    });
  });

  test('entrega como máximo los 6 cambios más recientes', async () => {
    for (let i = 0; i < 8; i += 1) {
      await psicoAgent.patch(`/api/menores/${menor._id}`).send({ curso: `${i}° básico` });
    }
    const res = await psicoAgent.get(RUTA);
    expect(res.body.actividad).toHaveLength(6);
    const fechas = res.body.actividad.map((r) => new Date(r.fecha).getTime());
    expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
  });

  test('un usuario no autenticado recibe 401', async () => {
    expect((await request(app).get(RUTA)).status).toBe(401);
  });
});
