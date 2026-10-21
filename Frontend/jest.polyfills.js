// jsdom no expone TextEncoder/TextDecoder, que usan react-router y la validación de contraseñas.
import { TextDecoder, TextEncoder } from 'node:util';

Object.assign(globalThis, { TextDecoder, TextEncoder });
