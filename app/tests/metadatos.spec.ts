import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { datosDeImagen, MetadatosNoRemovibles, quitarMetadatos, tieneMetadatosPersonales } from '../src/lib/admin/metadatos';
import { avifConExif, jpgConGps, pngConMetadatos, webpConMetadatos } from './apoyo-imagenes';

/**
 * Privacidad: al subir, el original pierde la ubicación GPS y demás datos
 * personales (EXIF, XMP, IPTC, comentarios), sin recodificar: la imagen queda
 * idéntica. Estas pruebas no usan el navegador.
 */
const contiene = (b: Uint8Array, s: string) => Buffer.from(b).includes(s);

test.describe('quitar metadatos personales del original', () => {
  test('JPG: quita GPS, cámara, XMP y comentario; conserva la orientación y la imagen intacta', () => {
    const sucio = jpgConGps(6);
    expect(tieneMetadatosPersonales(sucio)).toBe(true);
    const { bytes, formato } = quitarMetadatos(sucio);
    expect(formato).toBe('jpeg');
    expect(tieneMetadatosPersonales(bytes)).toBe(false);
    for (const s of ['CamaraDePrueba', 'GPSLatitude', 'persona de prueba', 'xmpmeta']) expect(contiene(bytes, s), s).toBe(false);
    expect(Buffer.compare(Buffer.from(datosDeImagen(bytes)), Buffer.from(datosDeImagen(sucio)))).toBe(0);
    // Solo queda la orientación (6 = girada por la cámara), para que se vea igual
    const i = Buffer.from(bytes).indexOf('Exif\0\0');
    expect(i).toBeGreaterThan(0);
    expect(bytes[i + 6 + 8 + 2 + 8 + 1]).toBe(6);
  });

  test('JPG sin orientación especial: no queda ningún EXIF', () => {
    const { bytes } = quitarMetadatos(jpgConGps(1));
    expect(contiene(bytes, 'Exif')).toBe(false);
  });

  test('PNG y WebP: se quitan los bloques de texto, EXIF y XMP', () => {
    for (const [nombre, sucio] of [['png', pngConMetadatos()], ['webp', webpConMetadatos()]] as const) {
      expect(tieneMetadatosPersonales(sucio), nombre).toBe(true);
      const { bytes } = quitarMetadatos(sucio);
      expect(tieneMetadatosPersonales(bytes), nombre).toBe(false);
      expect(contiene(bytes, 'persona de prueba') || contiene(bytes, 'CamaraDePrueba'), nombre).toBe(false);
      expect(Buffer.compare(Buffer.from(datosDeImagen(bytes)), Buffer.from(datosDeImagen(sucio))), nombre).toBe(0);
    }
  });

  test('AVIF con EXIF: se rechaza con un mensaje claro (no se puede limpiar sin alterarlo)', () => {
    expect(() => quitarMetadatos(avifConExif())).toThrow(MetadatosNoRemovibles);
    expect(() => quitarMetadatos(avifConExif())).toThrow(/Súbela como JPG o PNG/);
  });

  test('las fotos del seed (design/fotos) no traen metadatos personales', () => {
    const dir = fileURLToPath(new URL('../../design/fotos/', import.meta.url));
    const fotos = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/.test(f));
    expect(fotos.length).toBeGreaterThan(40);
    for (const f of fotos) expect(tieneMetadatosPersonales(new Uint8Array(readFileSync(dir + f))), f).toBe(false);
  });
});
