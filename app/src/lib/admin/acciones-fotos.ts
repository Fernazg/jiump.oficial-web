'use server';

import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { permisoAccion } from './acceso';
import { esUuid } from './bloques';
import { firmarMiniaturas, rutaVersion, type FotoElegible } from './fotos';
import { dimensionesDe, EXTENSION, formatoDe, type Formato, MIME } from './imagen';
import { MetadatosNoRemovibles, quitarMetadatos } from './metadatos';
import { clientePanel } from './supabase-panel';

/**
 * Acciones de la biblioteca de fotos. Todas usan la sesión de la persona: el
 * bucket y la tabla «fotos» aplican los permisos (cada quien sube en su
 * carpeta; Editor y Eventos solo editan o borran las suyas).
 */

const texto = (d: FormData, k: string, max: number) => String(d.get(k) ?? '').trim().slice(0, max);

export type ResultadoSubida = { ok: true; foto: FotoElegible } | { ok: false; error: string };

const LIMITE_BYTES = 10 * 1024 * 1024;
const LIMITE_VERSION = 4 * 1024 * 1024;
const ANCHOS = [480, 960, 1600];

/**
 * Subir una foto. El navegador ya creó las versiones optimizadas (WebAssembly,
 * ver optimizar-navegador.ts); aquí se verifica todo con JavaScript puro, así
 * funciona en cualquier alojamiento:
 *  · el original es de verdad JPG, PNG, WebP o AVIF, de hasta 10 MB, y sus
 *    medidas coinciden con las informadas;
 *  · al original se le quitan los datos personales (GPS, EXIF, XMP…), sin
 *    recodificarlo; si no se puede, se rechaza;
 *  · cada versión es WebP o AVIF real, del ancho esperado y nunca más grande
 *    que el original.
 * Si el navegador no pudo crear versiones, se guarda solo el original.
 */
export async function subirFoto(datos: FormData): Promise<ResultadoSubida> {
  const acceso = await permisoAccion('fotos');
  if (!acceso) return { ok: false, error: 'No tienes permiso para subir fotos.' };

  const archivo = datos.get('archivo');
  const alt = texto(datos, 'texto_alternativo', 300);
  const credito = texto(datos, 'credito', 120) || null;
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: 'Elige una foto.' };
  const nombre = `«${archivo.name}»`;
  if (archivo.size > LIMITE_BYTES) return { ok: false, error: `${nombre} pesa más de 10 MB.` };
  if (!alt) return { ok: false, error: 'Escribe el texto alternativo: describe la foto para quienes no pueden verla.' };

  const recibido = new Uint8Array(await archivo.arrayBuffer());
  if (!formatoDe(recibido)) return { ok: false, error: `${nombre} no es una imagen JPG, PNG, WebP ni AVIF válida.` };
  // Privacidad: se quitan la ubicación GPS y demás datos personales (EXIF, XMP,
  // IPTC, comentarios) también del original, sin recodificar la imagen.
  let original: Uint8Array;
  let formato: Formato;
  try {
    ({ bytes: original, formato } = quitarMetadatos(recibido));
  } catch (e) {
    return { ok: false, error: `${nombre}: ${e instanceof MetadatosNoRemovibles ? e.message : 'no se pudieron quitar los datos personales de la foto.'}` };
  }
  const medidas = dimensionesDe(original, formato);
  if (!medidas || !medidas.ancho || !medidas.alto) return { ok: false, error: `${nombre}: no se pudo leer el tamaño de la imagen.` };

  // Medidas como se ven (con la orientación de la cámara): pueden venir giradas.
  const ancho = Number(datos.get('ancho'));
  const alto = Number(datos.get('alto'));
  const coincide = (ancho === medidas.ancho && alto === medidas.alto) || (ancho === medidas.alto && alto === medidas.ancho);
  const anchoReal = coincide ? ancho : medidas.ancho;
  const altoReal = coincide ? alto : medidas.alto;

  // Versiones optimizadas (opcionales): solo si son válidas y del ancho esperado.
  const esperados = [...new Set([...ANCHOS.filter((a) => a < anchoReal), Math.min(anchoReal, 1600)])];
  const versiones: { ancho: number; webp: Uint8Array; avif: Uint8Array }[] = [];
  if (coincide) {
    for (const a of esperados) {
      const w = datos.get(`webp-${a}`), v = datos.get(`avif-${a}`);
      if (!(w instanceof File) || !(v instanceof File) || w.size > LIMITE_VERSION || v.size > LIMITE_VERSION) { versiones.length = 0; break; }
      const bw = new Uint8Array(await w.arrayBuffer()), bv = new Uint8Array(await v.arrayBuffer());
      const dw = formatoDe(bw) === 'webp' ? dimensionesDe(bw, 'webp') : null;
      const dv = formatoDe(bv) === 'avif' ? dimensionesDe(bv, 'avif') : null;
      if (!dw || !dv || dw.ancho !== a || dv.ancho !== a) { versiones.length = 0; break; }
      versiones.push({ ancho: a, webp: bw, avif: bv });
    }
  }

  const supabase = await clientePanel();
  const id = crypto.randomUUID();
  const ruta = `${acceso.userId}/${id}.${EXTENSION[formato]}`;
  const subidas: string[] = [];
  const subir = async (destino: string, cuerpo: Uint8Array, tipo: string) => {
    const { error } = await supabase.storage.from('fotos').upload(destino, cuerpo, { contentType: tipo, upsert: false });
    if (error) throw new Error(error.message);
    subidas.push(destino);
  };
  try {
    await subir(ruta, original, MIME[formato]); // original sin metadatos personales; la imagen, intacta
    for (const v of versiones) {
      await subir(rutaVersion(ruta, v.ancho, 'webp'), v.webp, 'image/webp');
      await subir(rutaVersion(ruta, v.ancho, 'avif'), v.avif, 'image/avif');
    }
    const { error } = await supabase.from('fotos').insert({
      id, archivo: ruta, ancho: anchoReal, alto: altoReal, texto_alternativo: alt, credito, anchos: versiones.map((v) => v.ancho),
    });
    if (error) throw new Error(error.message);
  } catch {
    if (subidas.length) await supabase.storage.from('fotos').remove(subidas);
    return { ok: false, error: `No se pudo guardar ${nombre}. Inténtalo de nuevo.` };
  }

  const urls = await firmarMiniaturas(supabase, [{ archivo: ruta, anchos: versiones.map((v) => v.ancho) }]);
  return { ok: true, foto: { id, url: urls.get(ruta) ?? '', texto_alternativo: alt, ancho: anchoReal, alto: altoReal } };
}

export async function editarFoto(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!(await permisoAccion('fotos'))) return { error: 'No tienes permiso para editar fotos.' };
  const id = texto(datos, 'id', 40);
  const alt = texto(datos, 'texto_alternativo', 300);
  if (!esUuid(id)) return { error: 'Foto no válida.' };
  if (!alt) return { error: 'El texto alternativo es obligatorio.' };
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('fotos')
    .update({ texto_alternativo: alt, credito: texto(datos, 'credito', 120) || null }).eq('id', id).select('id');
  if (error) return { error: 'No se pudo guardar.' };
  if (!data?.length) return { error: 'Solo puedes editar las fotos que subiste tú.' };
  return { ok: 'Foto guardada.' };
}

/**
 * Eliminar una foto: la quita de la biblioteca y de donde se use (las
 * portadas quedan sin foto). La interfaz avisa antes qué contenido la usa.
 */
export async function eliminarFoto(id: string, volverA: string): Promise<EstadoFormulario> {
  if (!(await permisoAccion('fotos'))) return { error: 'No tienes permiso para eliminar fotos.' };
  if (!esUuid(id)) return { error: 'Foto no válida.' };
  const supabase = await clientePanel();
  const { data: foto } = await supabase.from('fotos').select('archivo, anchos').eq('id', id).maybeSingle();
  if (!foto) return { error: 'La foto ya no existe.' };
  const { data, error } = await supabase.from('fotos').delete().eq('id', id).select('id');
  if (error) return { error: 'No se pudo eliminar la foto.' };
  if (!data?.length) return { error: 'Solo puedes eliminar las fotos que subiste tú.' };
  const anchos = (foto.anchos ?? []) as number[];
  await supabase.storage.from('fotos').remove([
    foto.archivo, ...anchos.flatMap((a) => [rutaVersion(foto.archivo, a, 'webp'), rutaVersion(foto.archivo, a, 'avif')]),
  ]);
  redirect(`${volverA.startsWith('/admin/') ? volverA : '/admin/fotos'}${volverA.includes('?') ? '&' : '?'}aviso=foto-eliminada`);
}
