import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Con las suites en paralelo, 1 s (valor por defecto) para findBy/waitFor resultaba
// insuficiente en equipos cargados y producía fallas intermitentes.
configure({ asyncUtilTimeout: 3000 });
