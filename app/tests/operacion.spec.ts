import { expect, test } from '@playwright/test';
import { onRequestError } from '../src/instrumentation';

/** Operación: el registro de errores deja una línea útil y sin datos personales. */
test('un error del servidor queda en el registro con su código para soporte, sin datos personales', () => {
  const lineas: string[] = [];
  const original = console.error;
  console.error = (x: unknown) => { lineas.push(String(x)); };
  try {
    const error = Object.assign(new Error('No se pudo leer el menú: fetch failed'), { digest: '3780725453' });
    onRequestError(error, { path: '/articulos?q=correo@ejemplo.cl&token=secreto', method: 'GET' }, { routePath: '/(sitio)/articulos', routeType: 'render' });
  } finally {
    console.error = original;
  }
  expect(lineas).toHaveLength(1);
  const linea = JSON.parse(lineas[0]) as Record<string, string>;
  expect(linea).toMatchObject({
    nivel: 'error', origen: 'jiump-sitio', digest: '3780725453', mensaje: 'No se pudo leer el menú: fetch failed',
    metodo: 'GET', ruta: '/articulos', pagina: '/(sitio)/articulos', tipo: 'render',
  });
  // De la dirección solo queda la ruta: nada de lo que venía en los parámetros.
  expect(lineas[0]).not.toContain('correo@ejemplo.cl');
  expect(lineas[0]).not.toContain('secreto');
});

test('un error que no es un Error también se registra, y el mensaje se recorta', () => {
  const lineas: string[] = [];
  const original = console.error;
  console.error = (x: unknown) => { lineas.push(String(x)); };
  try { onRequestError('x'.repeat(2000), { path: '/', method: 'POST' }, {}); } finally { console.error = original; }
  const linea = JSON.parse(lineas[0]) as Record<string, string | null>;
  expect(linea.mensaje).toHaveLength(500);
  expect(linea.digest).toBeNull();
});
