// Cabeceras de seguridad para los archivos estáticos en Cloudflare.
//
// En Cloudflare, los archivos estáticos (logos, /_next/static, codificadores
// WebAssembly) se entregan directo, sin pasar por Next.js ni por el Worker, así
// que no reciben las cabeceras de next.config.ts. Cloudflare las toma de un
// archivo `_headers` junto a los estáticos. Este script lo genera desde la
// MISMA fuente que usa Next.js (src/lib/seguridad/cabeceras.ts), para que
// nunca queden distintas. Se ejecuta en `npm run cf:build`.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cabecerasFijas } from '../src/lib/seguridad/cabeceras.ts';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const lineas = cabecerasFijas(true).map(({ key, value }) => `  ${key}: ${value}`);
writeFileSync(join(app, '.open-next', 'assets', '_headers'), `/*\n${lineas.join('\n')}\n`);
console.log('Cabeceras de seguridad de los estáticos escritas en .open-next/assets/_headers');
