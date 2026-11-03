import styled from 'styled-components';

// Tipo de un diagnóstico. Si se ingresó con «Otro» se indica, para no confundirlo
// con una categoría del administrador.

const Nota = styled.span`
  color: ${({ theme }) => theme.colores.textoSuave};
  font-size: 13px;
`;

export default function TipoDiagnostico({ diagnostico, detallado = false }) {
  return (
    <>
      {diagnostico.tipo || 'Sin tipo'}
      {diagnostico.tipo && diagnostico.tipoPersonalizado && (
        <Nota>
          {' '}
          {detallado ? '· Otro (ingresado por el profesional)' : '(Otro)'}
        </Nota>
      )}
    </>
  );
}
