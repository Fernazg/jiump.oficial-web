/**
 * Verificación de imágenes en el servidor, en JavaScript puro (sin librerías
 * nativas): funciona igual en Cloudflare, Vercel o un servidor propio.
 * Lee el tipo real del archivo (por sus primeros bytes, no por el nombre) y
 * su ancho y alto desde la cabecera, sin decodificar la imagen.
 */
export type Formato = 'jpeg' | 'png' | 'webp' | 'avif';
export const EXTENSION: Record<Formato, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' };
export const MIME: Record<Formato, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

export function formatoDe(b: Uint8Array): Formato | null {
  if (b.length < 16) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (ascii(b, 4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(b, 8, 4))) return 'avif';
  return null;
}

/** Ancho y alto guardados en la cabecera (sin aplicar la orientación EXIF). */
export function dimensionesDe(b: Uint8Array, f: Formato): { ancho: number; alto: number } | null {
  try {
    if (f === 'png') return { ancho: u32be(b, 16), alto: u32be(b, 20) };
    if (f === 'jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const marca = b[i + 1];
        if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
        const largo = u16be(b, i + 2);
        // SOF0..SOF15 (salvo DHT, JPG y DAC): ahí van alto y ancho.
        if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
          return { alto: u16be(b, i + 5), ancho: u16be(b, i + 7) };
        }
        i += 2 + largo;
      }
      return null;
    }
    if (f === 'webp') {
      const tipo = ascii(b, 12, 4);
      if (tipo === 'VP8X') return { ancho: u24le(b, 24) + 1, alto: u24le(b, 27) + 1 };
      if (tipo === 'VP8L') {
        const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
        return { ancho: (v & 0x3fff) + 1, alto: ((v >>> 14) & 0x3fff) + 1 };
      }
      if (tipo === 'VP8 ') return { ancho: u16le(b, 26) & 0x3fff, alto: u16le(b, 28) & 0x3fff };
      return null;
    }
    // AVIF (ISOBMFF): la caja «ispe» trae ancho y alto de la imagen.
    for (let i = 4; i + 16 < b.length && i < 4096; i++) {
      if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') return { ancho: u32be(b, i + 8), alto: u32be(b, i + 12) };
    }
    return null;
  } catch {
    return null;
  }
}
