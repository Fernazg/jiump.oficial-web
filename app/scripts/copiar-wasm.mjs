// Copia los codificadores WebAssembly (WebP y AVIF) a public/wasm para que el
// panel los sirva desde el propio sitio. Se ejecuta antes de compilar o de
// `npm run dev`. Los .wasm no se suben al repositorio (public/wasm está en .gitignore).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(app, 'public', 'wasm');
mkdirSync(destino, { recursive: true });
for (const [origen, nombre] of [
  ['node_modules/@jsquash/webp/codec/enc/webp_enc.wasm', 'webp_enc.wasm'],
  ['node_modules/@jsquash/avif/codec/enc/avif_enc.wasm', 'avif_enc.wasm'],
]) {
  copyFileSync(join(app, origen), join(destino, nombre));
}
console.log('Codificadores WebAssembly copiados a public/wasm');
