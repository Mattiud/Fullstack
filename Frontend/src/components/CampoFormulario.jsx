import { useId } from 'react';
import { Campo, Entrada, ErrorCampo, Etiqueta, TextoAyuda } from './ui';

// Campo de texto con etiqueta, ayuda y mensaje de error asociados para lectores de pantalla.
export default function CampoFormulario({ etiqueta, error, ayuda, ...props }) {
  const id = useId();
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;

  return (
    <Campo>
      <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
      <Entrada
        id={id}
        $invalido={Boolean(error)}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [idAyuda, idError].filter(Boolean).join(' ') || undefined
        }
        {...props}
      />
      {ayuda && <TextoAyuda id={idAyuda}>{ayuda}</TextoAyuda>}
      {error && <ErrorCampo id={idError}>{error}</ErrorCampo>}
    </Campo>
  );
}
