import { useRef, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/useAuth';
import { useNotificaciones } from '../context/useNotificaciones';
import { useCambiosSinGuardar } from '../hooks/useCambiosSinGuardar';
import { guardarDatosProfesionales } from '../api/auth';
import { erroresDeCampos, mensajeDeError } from '../api/client';
import {
  LIMITES_DATOS_PROFESIONALES as LIMITES,
  lineaProfesional,
} from '../constants/informes';
import {
  soloErrores,
  validarEmail,
  validarTelefono,
} from '../utils/validacion';
import CampoFormulario from '../components/CampoFormulario';
import EncabezadoPagina, { CuerpoPagina } from '../components/EncabezadoPagina';
import { Boton, Formulario, Tarjeta, TextoAyuda } from '../components/ui';

// Datos profesionales del psicopedagogo para el pie de página de sus informes PDF.
// Todos son opcionales; el nombre es el de la cuenta.

const Contenedor = styled(Tarjeta)`
  max-width: 560px;
  width: 100%;
  display: grid;
  gap: 16px;
`;

const VistaPie = styled.div`
  border-top: 1.5px solid ${({ theme }) => theme.colores.bordeSuave};
  padding-top: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colores.textoSuave};
  overflow-wrap: anywhere;
`;

const CAMPOS = ['tituloProfesional', 'registro', 'correo', 'telefono'];

function valoresDe(usuario) {
  return Object.fromEntries(
    CAMPOS.map((campo) => [campo, usuario.datosProfesionales?.[campo] ?? ''])
  );
}

export default function DatosProfesionales() {
  const { usuario, actualizarSesion } = useAuth();
  const { notificar } = useNotificaciones();
  const [originales, setOriginales] = useState(() => valoresDe(usuario));
  const [valores, setValores] = useState(originales);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const omitirRef = useRef(false);

  const hayCambios = CAMPOS.some(
    (campo) => valores[campo] !== originales[campo]
  );
  useCambiosSinGuardar(hayCambios, omitirRef);

  function handleChange(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
  }

  async function handleSubmit(evento) {
    evento.preventDefault();
    const nuevosErrores = soloErrores({
      correo: valores.correo.trim() ? validarEmail(valores.correo) : null,
      telefono: valores.telefono.trim()
        ? validarTelefono(valores.telefono)
        : null,
    });
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    setEnviando(true);
    try {
      const actualizado = await guardarDatosProfesionales(valores);
      actualizarSesion(actualizado);
      const guardados = valoresDe(actualizado);
      setOriginales(guardados);
      setValores(guardados);
      notificar({
        tipo: 'exito',
        mensaje:
          'Datos profesionales guardados. Se incluirán en los próximos PDF de sus informes.',
      });
    } catch (error) {
      setErrores(erroresDeCampos(error));
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(error, 'No fue posible guardar los datos'),
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Datos profesionales" />
      <CuerpoPagina>
        <Contenedor>
          <TextoAyuda as="p">
            Estos datos se imprimen en el pie de página de los PDF de los
            informes que usted crea, junto al pie institucional. Los PDF ya
            generados no cambian.
          </TextoAyuda>
          <Formulario onSubmit={handleSubmit} noValidate>
            <CampoFormulario
              etiqueta="Título profesional"
              name="tituloProfesional"
              maxLength={LIMITES.tituloProfesional}
              placeholder="Por ejemplo: Psicopedagoga"
              value={valores.tituloProfesional}
              onChange={handleChange}
              error={errores.tituloProfesional}
            />
            <CampoFormulario
              etiqueta="N.º de registro"
              name="registro"
              maxLength={LIMITES.registro}
              value={valores.registro}
              onChange={handleChange}
              error={errores.registro}
            />
            <CampoFormulario
              etiqueta="Correo de contacto"
              name="correo"
              type="email"
              maxLength={LIMITES.correo}
              value={valores.correo}
              onChange={handleChange}
              error={errores.correo}
            />
            <CampoFormulario
              etiqueta="Teléfono de contacto"
              name="telefono"
              type="tel"
              maxLength={LIMITES.telefono}
              value={valores.telefono}
              onChange={handleChange}
              error={errores.telefono}
            />
            <div>
              <TextoAyuda>Así se verá en el pie de página:</TextoAyuda>
              <VistaPie data-testid="vista-pie-profesional">
                {lineaProfesional(usuario.nombre, valores)}
              </VistaPie>
            </div>
            <Boton type="submit" disabled={enviando || !hayCambios}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </Formulario>
        </Contenedor>
      </CuerpoPagina>
    </>
  );
}
