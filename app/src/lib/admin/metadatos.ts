/**
 * Quitar metadatos personales del ORIGINAL de una foto, sin recodificarla:
 * los píxeles quedan byte por byte iguales (regla 2: no se retoca). Solo se
 * eliminan los bloques de datos que acompañan a la imagen:
 *  · EXIF (ubicación GPS, cámara, fecha, número de serie…), XMP, IPTC y
 *    comentarios.
 *  · Se conserva el perfil de color (ICC) y, si la foto venía girada por la
 *    cámara, solo la marca de orientación, para que se siga viendo igual.
 * JavaScript puro: funciona en cualquier alojamiento.
 *
 * AVIF guarda los metadatos dentro de una estructura que no se puede editar
 * sin reescribir el archivo: si trae EXIF o XMP, se rechaza con un mensaje.
 */
import { formatoDe, type Formato } from './imagen';

export class MetadatosNoRemovibles extends Error {}

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, Math.min(b.length, i + n)));
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

function unir(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { salida.set(p, i); i += p.length; }
  return salida;
}

// -----------------------------------------------------------------------------
// Orientación EXIF (lo único que se conserva)
// -----------------------------------------------------------------------------
/** Lee la orientación (1–8) de un bloque TIFF/EXIF; 1 si no hay. */
function orientacionTiff(t: Uint8Array): number {
  if (t.length < 8) return 1;
  const le = ascii(t, 0, 2) === 'II';
  const r16 = (i: number) => (le ? t[i] | (t[i + 1] << 8) : u16be(t, i));
  const r32 = (i: number) => (le ? u32le(t, i) : u32be(t, i));
  const ifd = r32(4);
  if (ifd + 2 > t.length) return 1;
  const n = r16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) break;
    if (r16(e) === 0x0112) { const v = r16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
  }
  return 1;
}

/** TIFF mínimo (big-endian) con una sola etiqueta: Orientation. */
function tiffSoloOrientacion(o: number): Uint8Array {
  return new Uint8Array([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // «MM», 42, IFD0 en 8
    0x00, 0x01, //                                     1 entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // Orientation, SHORT, 1
    0x00, o, 0x00, 0x00, //                            valor
    0x00, 0x00, 0x00, 0x00, //                         sin más IFD
  ]);
}

// -----------------------------------------------------------------------------
// JPEG: se quitan APP1 (EXIF y XMP), APP13 (IPTC/Photoshop) y COM
// -----------------------------------------------------------------------------
function limpiarJpeg(b: Uint8Array): Uint8Array {
  if (!(b[0] === 0xff && b[1] === 0xd8)) throw new MetadatosNoRemovibles('El JPG no es válido.');
  const partes: Uint8Array[] = [b.subarray(0, 2)];
  let orientacion = 1;
  let i = 2;
  let insertarEn = 1; // después de APP0 (JFIF) si existe
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new MetadatosNoRemovibles('El JPG tiene una estructura inesperada.');
    const marca = b[i + 1];
    if (marca === 0xff) { i += 1; continue; } // relleno
    if (marca === 0xda) { partes.push(b.subarray(i)); break; } // inicio de los datos de imagen: el resto va intacto
    if (marca === 0xd9) { partes.push(b.subarray(i, i + 2)); break; }
    const largo = u16be(b, i + 2);
    if (largo < 2 || i + 2 + largo > b.length) throw new MetadatosNoRemovibles('El JPG está incompleto.');
    const segmento = b.subarray(i, i + 2 + largo);
    const datos = b.subarray(i + 4, i + 2 + largo);
    let quitar = false;
    if (marca === 0xe1) { // APP1: EXIF o XMP
      if (ascii(datos, 0, 6) === 'Exif\0\0') orientacion = orientacionTiff(datos.subarray(6));
      quitar = true;
    } else if (marca === 0xed || marca === 0xfe) { // APP13 (IPTC) y comentarios
      quitar = true;
    } else if (marca >= 0xe3 && marca <= 0xef && marca !== 0xee) {
      // Otros APPn de fabricantes (pueden traer datos del aparato). Se conservan
      // APP0 (JFIF), APP2 (perfil de color ICC) y APP14 (Adobe, color).
      quitar = true;
    }
    if (!quitar) {
      partes.push(segmento);
      if (marca === 0xe0) insertarEn = partes.length;
    }
    i += 2 + largo;
  }
  if (orientacion !== 1) {
    const tiff = tiffSoloOrientacion(orientacion);
    const largo = 2 + 6 + tiff.length;
    const app1 = unir([new Uint8Array([0xff, 0xe1, largo >> 8, largo & 0xff]), new TextEncoder().encode('Exif\0\0'), tiff]);
    partes.splice(insertarEn, 0, app1);
  }
  return unir(partes);
}

// -----------------------------------------------------------------------------
// PNG: se quitan eXIf, tEXt, zTXt, iTXt y tIME (CRC de cada bloque intacto)
// -----------------------------------------------------------------------------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = TABLA_CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function limpiarPng(b: Uint8Array): Uint8Array {
  const partes: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let orientacion = 1;
  let insertarEn = -1;
  while (i + 12 <= b.length) {
    const largo = u32be(b, i);
    const tipo = ascii(b, i + 4, 4);
    const fin = i + 12 + largo;
    if (fin > b.length) throw new MetadatosNoRemovibles('El PNG está incompleto.');
    if (tipo === 'eXIf') orientacion = orientacionTiff(b.subarray(i + 8, i + 8 + largo));
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(tipo)) {
      partes.push(b.subarray(i, fin));
      if (tipo === 'IHDR') insertarEn = partes.length;
    }
    i = fin;
    if (tipo === 'IEND') break;
  }
  if (orientacion !== 1 && insertarEn > 0) {
    const tiff = tiffSoloOrientacion(orientacion);
    const cab = new Uint8Array(8);
    new DataView(cab.buffer).setUint32(0, tiff.length);
    cab.set(new TextEncoder().encode('eXIf'), 4);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(unir([cab.subarray(4), tiff])));
    partes.splice(insertarEn, 0, unir([cab, tiff, crc]));
  }
  return unir(partes);
}

// -----------------------------------------------------------------------------
// WebP: se quitan los bloques EXIF y XMP (y sus marcas en VP8X)
// -----------------------------------------------------------------------------
function limpiarWebp(b: Uint8Array): Uint8Array {
  const bloques: Uint8Array[] = [];
  let i = 12;
  let vp8x: Uint8Array | null = null;
  while (i + 8 <= b.length) {
    const tipo = ascii(b, i, 4);
    const largo = u32le(b, i + 4);
    const fin = i + 8 + largo + (largo % 2);
    if (i + 8 + largo > b.length) throw new MetadatosNoRemovibles('El WebP está incompleto.');
    const bloque = b.slice(i, Math.min(fin, b.length));
    if (tipo === 'VP8X') vp8x = bloque;
    if (tipo !== 'EXIF' && tipo !== 'XMP ') bloques.push(bloque);
    i = fin;
  }
  if (vp8x) vp8x[8] &= ~(0x08 | 0x04); // apaga las marcas «tiene EXIF» y «tiene XMP»
  const cuerpo = unir(bloques);
  const cab = new Uint8Array(12);
  cab.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(cab.buffer).setUint32(4, cuerpo.length + 4, true);
  cab.set(new TextEncoder().encode('WEBP'), 8);
  return unir([cab, cuerpo]);
}

// -----------------------------------------------------------------------------
// AVIF: solo se revisa (si trae EXIF o XMP, no se puede limpiar sin reescribir)
// -----------------------------------------------------------------------------
function avifTieneMetadatos(b: Uint8Array): boolean {
  // Busca entradas «infe» de tipo Exif o mime (XMP) en la caja de metadatos.
  const limite = Math.min(b.length, 64 * 1024);
  for (let i = 4; i + 16 < limite; i++) {
    if (b[i] === 0x69 && ascii(b, i, 4) === 'infe') {
      const cuerpo = ascii(b, i + 4, 40);
      if (cuerpo.includes('Exif') || cuerpo.includes('mime')) return true;
    }
  }
  return false;
}

export type ResultadoLimpieza = { bytes: Uint8Array; formato: Formato };

/** Devuelve el archivo sin metadatos personales, o lanza MetadatosNoRemovibles. */
export function quitarMetadatos(original: Uint8Array): ResultadoLimpieza {
  const formato = formatoDe(original);
  if (!formato) throw new MetadatosNoRemovibles('El archivo no es una imagen JPG, PNG, WebP ni AVIF válida.');
  if (formato === 'avif') {
    if (avifTieneMetadatos(original)) {
      throw new MetadatosNoRemovibles('Esta foto AVIF trae datos personales (como la ubicación) que no se pueden quitar sin alterarla. Súbela como JPG o PNG.');
    }
    return { bytes: original, formato };
  }
  const bytes = formato === 'jpeg' ? limpiarJpeg(original) : formato === 'png' ? limpiarPng(original) : limpiarWebp(original);
  if (tieneMetadatosPersonales(bytes)) throw new MetadatosNoRemovibles('No se pudieron quitar los datos personales de la foto.');
  return { bytes, formato };
}

/**
 * ¿Trae metadatos personales? (EXIF con algo más que la orientación, XMP,
 * IPTC, comentarios o textos). Se usa para verificar y en las pruebas.
 */
export function tieneMetadatosPersonales(b: Uint8Array): boolean {
  const formato = formatoDe(b);
  if (formato === 'jpeg') {
    let i = 2;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff) return true;
      const marca = b[i + 1];
      if (marca === 0xff) { i += 1; continue; }
      if (marca === 0xda || marca === 0xd9) return false;
      const largo = u16be(b, i + 2);
      const datos = b.subarray(i + 4, i + 2 + largo);
      if (marca === 0xed || marca === 0xfe) return true;
      if (marca === 0xe1) {
        if (ascii(datos, 0, 6) !== 'Exif\0\0') return true; // XMP
        const tiff = datos.subarray(6);
        if (tiff.length > tiffSoloOrientacion(1).length) return true; // EXIF con más que la orientación
      }
      i += 2 + largo;
    }
    return false;
  }
  if (formato === 'png') {
    let i = 8;
    while (i + 12 <= b.length) {
      const largo = u32be(b, i);
      const tipo = ascii(b, i + 4, 4);
      if (['tEXt', 'zTXt', 'iTXt', 'tIME'].includes(tipo)) return true;
      if (tipo === 'eXIf' && largo > tiffSoloOrientacion(1).length) return true;
      i += 12 + largo;
      if (tipo === 'IEND') break;
    }
    return false;
  }
  if (formato === 'webp') {
    let i = 12;
    while (i + 8 <= b.length) {
      const tipo = ascii(b, i, 4);
      if (tipo === 'EXIF' || tipo === 'XMP ') return true;
      const largo = u32le(b, i + 4);
      i += 8 + largo + (largo % 2);
    }
    return false;
  }
  if (formato === 'avif') return avifTieneMetadatos(b);
  return true;
}

/** Píxeles intactos: el bloque de datos de imagen es idéntico (para las pruebas). */
export function datosDeImagen(b: Uint8Array): Uint8Array {
  const f = formatoDe(b);
  if (f === 'jpeg') {
    for (let i = 2; i + 4 <= b.length;) {
      if (b[i + 1] === 0xda) return b.subarray(i);
      if (b[i + 1] === 0xff) { i += 1; continue; }
      i += 2 + u16be(b, i + 2);
    }
  }
  if (f === 'png') {
    const idat: Uint8Array[] = [];
    for (let i = 8; i + 12 <= b.length;) {
      const largo = u32be(b, i);
      if (ascii(b, i + 4, 4) === 'IDAT') idat.push(b.subarray(i + 8, i + 8 + largo));
      i += 12 + largo;
    }
    return unir(idat);
  }
  if (f === 'webp') {
    for (let i = 12; i + 8 <= b.length;) {
      const tipo = ascii(b, i, 4);
      const largo = u32le(b, i + 4);
      if (tipo === 'VP8 ' || tipo === 'VP8L') return b.subarray(i + 8, i + 8 + largo);
      i += 8 + largo + (largo % 2);
    }
  }
  return b;
}
