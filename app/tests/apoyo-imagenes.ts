/**
 * Apoyo para probar la limpieza de metadatos: agrega a una foto real de JIUMP
 * (design/fotos) datos personales falsos de prueba (GPS, cámara, XMP,
 * comentario), como los que trae una foto recién sacada con el celular.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FOTO_JPG = fileURLToPath(new URL('../../design/fotos/784625ac3ebfe474ed6261cca016b8df.jpg', import.meta.url));
export const FOTO_PNG = fileURLToPath(new URL('../../design/fotos/1b16c658d676a48f9564e3144cfa63aa.png', import.meta.url));

const unir = (...p: Uint8Array[]) => { const s = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { s.set(x, i); i += x.length; } return s; };
const txt = (s: string) => new TextEncoder().encode(s);

/** TIFF/EXIF big-endian con orientación, marca de cámara y ubicación GPS. */
export function exifConGps(orientacion = 6): Uint8Array {
  const make = txt('CamaraDePrueba\0'); // 15 bytes
  // IFD0 en 8: 3 entradas (Make, Orientation, GPSInfo) → 2 + 36 + 4 = 42 → datos en 50
  const offMake = 50;
  const offGps = offMake + make.length + 1; // alineado a par
  const v = new DataView(new ArrayBuffer(offGps + 2 + 12 + 4));
  const b = new Uint8Array(v.buffer);
  b.set(txt('MM'), 0); v.setUint16(2, 42); v.setUint32(4, 8);
  v.setUint16(8, 3);
  const entrada = (k: number, tag: number, tipo: number, n: number, valor: number, corto = false) => {
    const e = 10 + k * 12; v.setUint16(e, tag); v.setUint16(e + 2, tipo); v.setUint32(e + 4, n);
    if (corto) v.setUint16(e + 8, valor); else v.setUint32(e + 8, valor);
  };
  entrada(0, 0x010f, 2, make.length, offMake);
  entrada(1, 0x0112, 3, 1, orientacion, true);
  entrada(2, 0x8825, 4, 1, offGps);
  v.setUint32(46, 0);
  b.set(make, offMake);
  // IFD GPS: GPSLatitudeRef = 'S'
  v.setUint16(offGps, 1);
  v.setUint16(offGps + 2, 0x0001); v.setUint16(offGps + 4, 2); v.setUint32(offGps + 6, 2); b.set(txt('S\0'), offGps + 10);
  v.setUint32(offGps + 14, 0);
  return b;
}

/** JPG real + EXIF con GPS + XMP + comentario (después del SOI). */
export function jpgConGps(orientacion = 6): Uint8Array {
  const original = new Uint8Array(readFileSync(FOTO_JPG));
  const seg = (marca: number, datos: Uint8Array) => unir(new Uint8Array([0xff, marca, (datos.length + 2) >> 8, (datos.length + 2) & 0xff]), datos);
  const exif = seg(0xe1, unir(txt('Exif\0\0'), exifConGps(orientacion)));
  const xmp = seg(0xe1, unir(txt('http://ns.adobe.com/xap/1.0/\0'), txt('<x:xmpmeta><exif:GPSLatitude>33,26.0S</exif:GPSLatitude></x:xmpmeta>')));
  const com = seg(0xfe, txt('Autor: persona de prueba'));
  return unir(original.subarray(0, 2), exif, xmp, com, original.subarray(2));
}

/** PNG real + bloque de texto y eXIf con GPS (antes de IEND). */
export function pngConMetadatos(): Uint8Array {
  const original = new Uint8Array(readFileSync(FOTO_PNG));
  const bloque = (tipo: string, datos: Uint8Array) => {
    const cab = new Uint8Array(8); new DataView(cab.buffer).setUint32(0, datos.length); cab.set(txt(tipo), 4);
    return unir(cab, datos, new Uint8Array(4)); // CRC no importa para estas pruebas
  };
  const fin = original.length - 12; // IEND
  return unir(original.subarray(0, fin), bloque('tEXt', txt('Author\0persona de prueba')), bloque('eXIf', exifConGps(1)), original.subarray(fin));
}

/** WebP con VP8X + datos de imagen + EXIF y XMP (estructura de prueba). */
export function webpConMetadatos(): Uint8Array {
  const bloque = (tipo: string, datos: Uint8Array) => {
    const cab = new Uint8Array(8); cab.set(txt(tipo), 0); new DataView(cab.buffer).setUint32(4, datos.length, true);
    return unir(cab, datos, datos.length % 2 ? new Uint8Array(1) : new Uint8Array(0));
  };
  const vp8x = new Uint8Array(10); vp8x[0] = 0x08 | 0x04; // tiene EXIF y XMP
  const cuerpo = unir(txt('WEBP'), bloque('VP8X', vp8x), bloque('VP8L', new Uint8Array([0x2f, 1, 2, 3, 4, 5, 6, 7, 8])), bloque('EXIF', exifConGps(1)), bloque('XMP ', txt('<x:xmpmeta/>')));
  const cab = new Uint8Array(8); cab.set(txt('RIFF'), 0); new DataView(cab.buffer).setUint32(4, cuerpo.length, true);
  return unir(cab, cuerpo);
}

/** Cabecera AVIF mínima con un ítem EXIF declarado (no se puede limpiar). */
export function avifConExif(): Uint8Array {
  return unir(new Uint8Array([0, 0, 0, 24]), txt('ftypavif'), new Uint8Array(12), new Uint8Array([0, 0, 0, 30]), txt('infe'), new Uint8Array([2, 0, 0, 0, 0, 1, 0, 0]), txt('Exif'), new Uint8Array(10));
}
