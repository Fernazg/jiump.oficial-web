import 'server-only';
import sharp, { type Metadata } from 'sharp';

/**
 * Optimización de fotos al subirlas (regla 2 del README: las fotos no se
 * retocan, solo se redimensionan).
 *  · El ORIGINAL se guarda tal como llegó, byte por byte.
 *  · Se crean versiones WebP y AVIF en varios anchos, sin recortar: se
 *    mantiene la proporción, nunca se agrandan, y solo se enderezan según la
 *    orientación que trae la cámara (EXIF). Las versiones no llevan los
 *    metadatos del original (ubicación GPS, cámara…).
 */
export const LIMITE_BYTES = 10 * 1024 * 1024;
export const ANCHOS = [480, 960, 1600] as const;

const FORMATOS: Record<string, { ext: string; mime: string }> = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
  heif: { ext: 'avif', mime: 'image/avif' }, // sharp informa AVIF como «heif»
};

export type Version = { ancho: number; webp: Buffer; avif: Buffer };
export type FotoProcesada = { ext: string; mime: string; ancho: number; alto: number; versiones: Version[] };

export class FotoInvalida extends Error {}

export async function procesarFoto(original: Buffer): Promise<FotoProcesada> {
  if (original.length === 0) throw new FotoInvalida('El archivo está vacío.');
  if (original.length > LIMITE_BYTES) throw new FotoInvalida('La foto pesa más de 10 MB.');

  let meta: Metadata;
  try {
    meta = await sharp(original, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new FotoInvalida('El archivo no es una imagen válida.');
  }
  const formato = meta.format && FORMATOS[meta.format];
  if (!formato || (meta.format === 'heif' && meta.compression !== 'av1')) {
    throw new FotoInvalida('Formato no permitido: usa JPG, PNG, WebP o AVIF.');
  }
  // Dimensiones como se ven (con la orientación de la cámara aplicada).
  const ancho = meta.autoOrient?.width ?? meta.width ?? 0;
  const alto = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!ancho || !alto) throw new FotoInvalida('No se pudo leer el tamaño de la imagen.');

  const anchos = [...new Set([...ANCHOS.filter((a) => a < ancho), Math.min(ancho, ANCHOS[ANCHOS.length - 1])])].sort((a, b) => a - b);
  const versiones: Version[] = [];
  for (const a of anchos) {
    const base = sharp(original, { limitInputPixels: 80_000_000 }).rotate().resize({ width: a, withoutEnlargement: true, fit: 'inside' });
    const [webp, avif] = await Promise.all([
      base.clone().webp({ quality: 82 }).toBuffer(),
      base.clone().avif({ quality: 55, effort: 3 }).toBuffer(),
    ]);
    versiones.push({ ancho: a, webp, avif });
  }
  return { ...formato, ancho, alto, versiones };
}
