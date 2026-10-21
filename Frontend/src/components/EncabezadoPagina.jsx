import styled from 'styled-components';

const Barra = styled.header`
  min-height: 58px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 10px 20px;

  @media (max-width: ${({ theme }) => theme.movil}) {
    padding: 10px 16px;
  }
`;

const TituloPagina = styled.h1`
  flex: 1;
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  min-width: 160px;
`;

export const CuerpoPagina = styled.div`
  padding: 20px;
  display: grid;
  gap: 18px;
  min-width: 0;

  @media (max-width: ${({ theme }) => theme.movil}) {
    padding: 16px;
  }
`;

// Barra superior de cada pantalla: título y acciones a la derecha.
export default function EncabezadoPagina({ titulo, children }) {
  return (
    <Barra>
      <TituloPagina>{titulo}</TituloPagina>
      {children}
    </Barra>
  );
}
