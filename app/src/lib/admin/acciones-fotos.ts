'use server';

import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { permisoAccion } from './acceso';
import { esUuid } from './bloques';
import { firmarMiniaturas, rutaVersion, type FotoElegible } from './fotos';
import { FotoInvalida, LIMITE_BYTES, procesarFoto } from './optimizar';
import { clientePanel } from './supabase-panel';

/**
 * Acciones de la biblioteca de fotos. Todas usan la sesión de la persona: el
 * bucket y la tabla «fotos» aplican los permisos (cada quien sube en su
 * carpeta; Editor y Eventos solo editan o borran las suyas).
 */

const texto = (d: FormData, k: string, max: number) => String(d.get(k) ?? '').trim().slice(0, max);

export type ResultadoSubida = { ok: true; foto: FotoElegible } | { ok: false; error: string };

export async function subirFoto(datos: FormData): Promise<ResultadoSubida> {
  const acceso = await permisoAccion('fotos');
  if (!acceso) return { ok: false, error: 'No tienes permiso para subir fotos.' };

  const archivo = datos.get('archivo');
  const alt = texto(datos, 'texto_alternativo', 300);
  const credito = texto(datos, 'credito', 120) || null;
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: 'Elige una foto.' };
  if (archivo.size > LIMITE_BYTES) return { ok: false, error: `«${archivo.name}» pesa más de 10 MB.` };
  if (!alt) return { ok: false, error: 'Escribe el texto alternativo: describe la foto para quienes no pueden verla.' };

  let procesada;
  try {
    procesada = await procesarFoto(Buffer.from(await archivo.arrayBuffer()));
  } catch (e) {
    return { ok: false, error: e instanceof FotoInvalida ? `«${archivo.name}»: ${e.message}` : 'No se pudo procesar la foto.' };
  }

  const supabase = await clientePanel();
  const id = crypto.randomUUID();
  const ruta = `${acceso.userId}/${id}.${procesada.ext}`;
  const subidas: string[] = [];
  const subir = async (destino: string, cuerpo: Buffer, tipo: string) => {
    const { error } = await supabase.storage.from('fotos').upload(destino, cuerpo, { contentType: tipo, upsert: false });
    if (error) throw new Error(error.message);
    subidas.push(destino);
  };
  try {
    await subir(ruta, Buffer.from(await archivo.arrayBuffer()), procesada.mime); // original, sin cambios
    for (const v of procesada.versiones) {
      await subir(rutaVersion(ruta, v.ancho, 'webp'), v.webp, 'image/webp');
      await subir(rutaVersion(ruta, v.ancho, 'avif'), v.avif, 'image/avif');
    }
    const { error } = await supabase.from('fotos').insert({
      id, archivo: ruta, ancho: procesada.ancho, alto: procesada.alto, texto_alternativo: alt, credito,
      anchos: procesada.versiones.map((v) => v.ancho),
    });
    if (error) throw new Error(error.message);
  } catch {
    if (subidas.length) await supabase.storage.from('fotos').remove(subidas);
    return { ok: false, error: `No se pudo guardar «${archivo.name}». Inténtalo de nuevo.` };
  }

  const urls = await firmarMiniaturas(supabase, [{ archivo: ruta, anchos: procesada.versiones.map((v) => v.ancho) }]);
  return { ok: true, foto: { id, url: urls.get(ruta) ?? '', texto_alternativo: alt, ancho: procesada.ancho, alto: procesada.alto } };
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
