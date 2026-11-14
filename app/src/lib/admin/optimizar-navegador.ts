/**
 * Optimización de fotos EN EL NAVEGADOR de quien sube (WebAssembly).
 * No depende del alojamiento ni de servicios pagados: el servidor solo
 * verifica y guarda. Reglas del README: el original se guarda sin cambios y
 * las versiones solo se redimensionan (sin recortar, sin agrandar), enderezadas
 * según la orientación de la cámara y sin sus metadatos (ubicación, cámara…).
 *
 * Codificadores: los de Squoosh (jSquash, licencia Apache 2.0), en su versión
 * de un solo hilo. Los .wasm se sirven desde /wasm (scripts/copiar-wasm.mjs).
 */
import avifFabrica from '@jsquash/avif/codec/enc/avif_enc.js';
import webpFabrica from '@jsquash/webp/codec/enc/webp_enc.js';
import { defaultOptions as avifPorDefecto } from '@jsquash/avif/meta.js';
import { defaultOptions as webpPorDefecto } from '@jsquash/webp/meta.js';

export const ANCHOS = [480, 960, 1600] as const;

export type VersionNavegador = { ancho: number; webp: Blob; avif: Blob };
export type FotoOptimizada = { ancho: number; alto: number; versiones: VersionNavegador[] };

/** Anchos a generar: los de la lista menores que el original, más uno del tamaño del original (máx. 1600). */
export function anchosPara(anchoOriginal: number): number[] {
  return [...new Set([...ANCHOS.filter((a) => a < anchoOriginal), Math.min(anchoOriginal, ANCHOS[ANCHOS.length - 1])])].sort((a, b) => a - b);
}

type Codificador = { encode(data: BufferSource, w: number, h: number, opciones: Record<string, unknown>): Uint8Array | null };
const fabrica = (f: unknown) => f as (opciones: { locateFile: (p: string) => string }) => Promise<Codificador>;
let codificadores: Promise<{ webp: Codificador; avif: Codificador }> | null = null;
function cargar() {
  codificadores ??= Promise.all([
    fabrica(webpFabrica)({ locateFile: () => '/wasm/webp_enc.wasm' }),
    fabrica(avifFabrica)({ locateFile: () => '/wasm/avif_enc.wasm' }),
  ]).then(([webp, avif]) => ({ webp, avif }));
  return codificadores;
}

const OPCIONES_WEBP = { ...webpPorDefecto, quality: 82 };
const OPCIONES_AVIF = { ...avifPorDefecto, quality: 55, speed: 8 };

export async function optimizarEnNavegador(archivo: File, alAvanzar?: (texto: string) => void): Promise<FotoOptimizada> {
  // Decodifica respetando la orientación EXIF de la cámara.
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const ancho = imagen.width;
  const alto = imagen.height;
  const { webp, avif } = await cargar();

  const versiones: VersionNavegador[] = [];
  for (const a of anchosPara(ancho)) {
    alAvanzar?.(`optimizando ${a} px…`);
    await new Promise((r) => setTimeout(r, 0)); // deja actualizar la pantalla
    const h = Math.max(1, Math.round((alto * a) / ancho));
    const lienzo = document.createElement('canvas');
    lienzo.width = a;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('El navegador no permite procesar imágenes.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, 0, 0, a, h);
    const pixeles = ctx.getImageData(0, 0, a, h);
    const bw = webp.encode(pixeles.data, a, h, OPCIONES_WEBP);
    const bv = avif.encode(pixeles.data, a, h, OPCIONES_AVIF);
    if (!bw || !bv) throw new Error('No se pudo optimizar la foto.');
    versiones.push({ ancho: a, webp: new Blob([new Uint8Array(bw)], { type: 'image/webp' }), avif: new Blob([new Uint8Array(bv)], { type: 'image/avif' }) });
  }
  imagen.close();
  return { ancho, alto, versiones };
}
