import { NOMBRES_ROLES } from '../constants/auth';

// En la interfaz las fechas se muestran como DD/MM/AAAA. No se usa Intl con
// 'es-CL' porque separa con guiones (23-10-2026) y abrevia el año con hora.
const dosDigitos = (numero) => String(numero).padStart(2, '0');

function fechaValida(valor) {
  const fecha = valor ? new Date(valor) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}

// Fecha y hora de un evento (accesos, historial, documentos): DD/MM/AAAA HH:mm, hora local.
export function formatearFecha(valor) {
  const fecha = fechaValida(valor);
  if (!fecha) return '—';
  const dia = `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
  return `${dia} ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
}

// Las fechas del perfil (nacimiento, ingreso) se guardan a medianoche UTC: DD/MM/AAAA.
export function formatearDia(valor) {
  const fecha = fechaValida(valor);
  if (!fecha) return '—';
  return `${dosDigitos(fecha.getUTCDate())}/${dosDigitos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
}

// AAAA-MM-DD para los campos de tipo fecha.
export function fechaParaCampo(valor) {
  const fecha = fechaValida(valor);
  return fecha ? fecha.toISOString().slice(0, 10) : '';
}

// Fecha de hoy según el reloj local, en AAAA-MM-DD (toISOString daría la de UTC,
// que en Chile ya es el día siguiente desde las 20:00 o 21:00).
export function hoyParaCampo(ahora = new Date()) {
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function iniciales(nombre) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

const NOMBRES_CAMPOS = {
  nombre: 'nombre',
  rut: 'RUT',
  fechaNacimiento: 'fecha de nacimiento',
  establecimiento: 'establecimiento',
  curso: 'curso',
  fechaIngreso: 'fecha de ingreso',
  antecedentesRelevantes: 'antecedentes relevantes',
  'apoderado.nombre': 'nombre del apoderado',
  'apoderado.parentesco': 'parentesco',
  'apoderado.telefono': 'teléfono del apoderado',
  tipo: 'tipo de diagnóstico',
  fechaEvaluacion: 'fecha de evaluación',
  instrumento: 'instrumento aplicado',
  descripcion: 'descripción y hallazgos',
  areasAfectadas: 'áreas afectadas',
  fecha: 'fecha',
  horaInicio: 'hora de inicio',
  horaFin: 'hora de término',
  diagnostico: 'diagnóstico asociado',
  objetivos: 'objetivos',
  logroObjetivos: 'logro de objetivos',
  actividades: 'actividades',
  asistencia: 'asistencia',
  observaciones: 'observaciones',
  fechaInforme: 'fecha del informe',
  motivoConsulta: 'motivo de consulta',
  analisisCuantitativo: 'análisis cuantitativo',
  analisisCualitativo: 'análisis cualitativo',
  conclusion: 'conclusión psicopedagógica',
  'sugerencias.familia': 'sugerencias (familia)',
  'sugerencias.escuela': 'sugerencias (escuela)',
  'sugerencias.nino': 'sugerencias (niño)',
  instrumentoEvaluativo: 'instrumento evaluativo',
  areasEvaluacion: 'áreas de evaluación',
  tablasCuantitativas: 'tablas de resultados cuantitativos',
  objetivoEvaluacion: 'objetivo de la evaluación',
  areasCualitativas: 'áreas del análisis cualitativo',
};

function tipoDocumento(detalle) {
  return detalle.tipo ? ` (${detalle.tipo.toUpperCase()})` : '';
}

function listaCampos(detalle) {
  return (detalle.campos ?? [])
    .map((campo) => NOMBRES_CAMPOS[campo] ?? campo)
    .join(', ');
}

// Un diagnóstico vigente en v1 que se "actualiza" es un borrador que se publicó.
function describirDiagnostico(accion, detalle) {
  const borrador = detalle.estado === 'borrador';
  if (accion === 'DIAGNOSTICO_CREADO') {
    return borrador
      ? 'registró un borrador de diagnóstico'
      : `registró un diagnóstico (v${detalle.version})`;
  }
  if (borrador)
    return `actualizó un borrador de diagnóstico: ${listaCampos(detalle)}`;
  if (detalle.version === 1)
    return 'guardó un borrador como diagnóstico vigente (v1)';
  return `actualizó un diagnóstico (v${detalle.version}): ${listaCampos(detalle)}`;
}

function describirSesion(accion, detalle) {
  const borrador = detalle.estado === 'borrador';
  if (accion === 'SESION_CREADA') {
    return borrador ? 'registró un borrador de sesión' : 'planificó una sesión';
  }
  if (detalle.publicada) return 'guardó un borrador como sesión planificada';
  return `actualizó ${borrador ? 'un borrador de sesión' : 'una sesión'}: ${listaCampos(detalle)}`;
}

// Descripción de un evento del historial de un expediente.
export function describirHistorial({ accion, detalle = {} }) {
  switch (accion) {
    case 'MENOR_CREADO':
      return 'registró la ficha';
    case 'MENOR_ACTUALIZADO':
      return `actualizó: ${(detalle.campos ?? [])
        .map((campo) => NOMBRES_CAMPOS[campo] ?? campo)
        .join(', ')}`;
    case 'MENOR_ESTADO':
      return detalle.activo ? 'reactivó la ficha' : 'desactivó la ficha';
    case 'PROFESIONALES_ASIGNADOS':
      return 'modificó los profesionales asignados';
    case 'DOCUMENTO_SUBIDO':
      return `adjuntó un documento${tipoDocumento(detalle)}`;
    case 'DOCUMENTO_ELIMINADO':
      return `eliminó un documento${tipoDocumento(detalle)}`;
    case 'DIAGNOSTICO_CREADO':
    case 'DIAGNOSTICO_ACTUALIZADO':
      return describirDiagnostico(accion, detalle);
    case 'SESION_CREADA':
    case 'SESION_ACTUALIZADA':
      return describirSesion(accion, detalle);
    case 'INFORME_CREADO':
      return 'registró un informe psicopedagógico';
    case 'INFORME_ACTUALIZADO':
      return `actualizó un informe psicopedagógico: ${listaCampos(detalle)}`;
    case 'INFORME_PDF_GENERADO':
      return `generó el PDF de un informe (versión ${detalle.version})`;
    default:
      return accion;
  }
}

function nombreDe(usuariosPorId, id) {
  return usuariosPorId.get(id)?.nombre ?? 'una cuenta';
}

// Descripción legible de un registro de auditoría (acciones de Backend/src/models/AuditLog.js).
export function describirAuditoria(registro, usuariosPorId = new Map()) {
  const { accion, resultado, recurso, recursoId, detalle = {} } = registro;
  const afectado = nombreDe(usuariosPorId, recursoId);

  switch (accion) {
    case 'LOGIN_EXITOSO':
      return 'inicio de sesión exitoso';
    case 'LOGIN_FALLIDO':
      return 'intento de inicio de sesión fallido';
    case 'INTENTOS_EXCEDIDOS':
      return 'bloqueo por exceso de intentos';
    case 'LOGOUT':
      return 'cierre de sesión';
    case 'CAMBIO_PASSWORD':
      return resultado === 'fallo'
        ? 'intento fallido de cambio de contraseña'
        : 'cambió su contraseña';
    case 'ACCESO_NO_AUTENTICADO':
      return 'acceso sin sesión válida';
    case 'ACCESO_DENEGADO':
      return recurso === 'menor'
        ? 'acceso denegado a un expediente'
        : 'acceso denegado';
    case 'ORIGEN_RECHAZADO':
      return 'solicitud rechazada desde otro origen';
    case 'USUARIO_CREADO':
      return `creó la cuenta de ${afectado} (${NOMBRES_ROLES[detalle.rol] ?? detalle.rol})`;
    case 'USUARIO_ACTUALIZADO':
      if (detalle.rol) return `cambió el rol de ${afectado}`;
      if (detalle.activo === false) return `desactivó la cuenta de ${afectado}`;
      if (detalle.activo === true) return `activó la cuenta de ${afectado}`;
      return `actualizó la cuenta de ${afectado}`;
    case 'USUARIO_ELIMINADO':
      return `eliminó la cuenta de ${detalle.nombre ?? afectado}`;
    case 'PASSWORD_TEMPORAL_ASIGNADA':
      return `asignó una contraseña temporal a ${afectado}`;
    case 'MENOR_CONSULTADO':
      return 'consultó un expediente';
    case 'DOCUMENTO_CONSULTADO':
      return `visualizó un documento${tipoDocumento(detalle)}`;
    case 'DOCUMENTO_DESCARGADO':
      return `descargó un documento${tipoDocumento(detalle)}`;
    case 'DIAGNOSTICO_CONSULTADO':
      return 'consultó un diagnóstico';
    case 'SESION_CONSULTADA':
      return 'consultó una sesión';
    case 'INFORME_CONSULTADO':
      return 'consultó un informe';
    case 'DATOS_PROFESIONALES_ACTUALIZADOS':
      return 'actualizó sus datos profesionales';
    case 'INFORME_PDF_DESCARGADO':
      return detalle.modo === 'descarga'
        ? `descargó el PDF de un informe (versión ${detalle.version})`
        : `visualizó el PDF de un informe (versión ${detalle.version})`;
    case 'TIPO_DIAGNOSTICO_CREADO':
      return 'agregó una categoría de tipo de diagnóstico';
    case 'TIPO_DIAGNOSTICO_ELIMINADO':
      return detalle.nombre
        ? `eliminó la categoría de tipo de diagnóstico «${detalle.nombre}»`
        : 'eliminó una categoría de tipo de diagnóstico';
    case 'TIPO_DIAGNOSTICO_ACTUALIZADO':
      if (detalle.campos?.includes('nombre'))
        return 'renombró una categoría de tipo de diagnóstico';
      return detalle.activo
        ? 'reactivó una categoría de tipo de diagnóstico'
        : 'desactivó una categoría de tipo de diagnóstico';
    case 'CONFIG_INFORMES_ACTUALIZADA':
      return 'actualizó la configuración de informes';
    case 'LOGO_INFORMES_ACTUALIZADO':
      return 'cambió el logo de los informes';
    case 'LOGO_INFORMES_ELIMINADO':
      return 'eliminó el logo de los informes';
    case 'MENOR_CREADO':
    case 'MENOR_ACTUALIZADO':
    case 'MENOR_ESTADO':
    case 'PROFESIONALES_ASIGNADOS':
    case 'DOCUMENTO_SUBIDO':
    case 'DOCUMENTO_ELIMINADO':
    case 'DIAGNOSTICO_CREADO':
    case 'DIAGNOSTICO_ACTUALIZADO':
    case 'SESION_CREADA':
    case 'SESION_ACTUALIZADA':
    case 'INFORME_CREADO':
    case 'INFORME_ACTUALIZADO':
    case 'INFORME_PDF_GENERADO':
      return `${describirHistorial(registro)} de un expediente`;
    default:
      return accion;
  }
}
