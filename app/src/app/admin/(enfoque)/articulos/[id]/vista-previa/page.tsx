import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticuloCompleto } from '@/components/ArticuloCompleto';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { Encabezado, Pie } from '@/components/Marco';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicarArticulo } from '@/lib/admin/acciones-articulos';
import { articuloParaEditar, estadoVisible } from '@/lib/admin/articulos';
import { esUuid } from '@/lib/admin/bloques';
import { utcAChileLocal } from '@/lib/admin/hora-chile';
import { clientePanel } from '@/lib/admin/supabase-panel';
import { firmarFotos, fotosDeBloques } from '@/lib/datos';
import type { Articulo, Serie } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Vista previa' };

/**
 * Vista previa obligatoria: el artículo (o sus cambios sin publicar) con la
 * misma página que el sitio público. Al abrirla, la base registra que esta
 * persona vio ESTE contenido; recién entonces puede publicarlo.
 */
export default async function VistaPrevia({ params }: { params: Promise<{ id: string }> }) {
  await exigirSeccion('articulos');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await articuloParaEditar(id);
  if (!datos || datos.articulo.estado === 'papelera') notFound();
  const { articulo, cambios } = datos;
  const contenido = cambios ? { ...articulo, ...cambios } : articulo;

  const supabase = await clientePanel();
  // Registra la vista previa (la huella la calcula la base de datos).
  const { data: huella } = await supabase.rpc('huella_vigente_articulo', { p_articulo_id: id });
  const registro = huella
    ? await supabase.from('articulo_vistas_previas').insert({ articulo_id: id, huella })
    : { error: { message: 'sin huella' } };

  // Serie y artículos de la serie como se verán: los visibles + este.
  let serie: Serie | undefined;
  let hermanos: Pick<Articulo, 'id' | 'slug' | 'titulo' | 'parte'>[] = [];
  if (contenido.serie_id) {
    const [{ data: s }, { data: otros }] = await Promise.all([
      supabase.from('series').select('id, nombre, slug, descripcion, tipo, mes, color, icono, orden').eq('id', contenido.serie_id).maybeSingle(),
      supabase.from('articulos').select('id, slug, titulo, parte, estado, publicar_en').eq('serie_id', contenido.serie_id).neq('id', id),
    ]);
    serie = (s as Serie | null) ?? undefined;
    hermanos = [
      ...((otros ?? []) as (Pick<Articulo, 'id' | 'slug' | 'titulo' | 'parte'> & { estado: 'publicado'; publicar_en: string | null })[])
        .filter((a) => estadoVisible(a) === 'publicado'),
      { id, slug: articulo.slug, titulo: contenido.titulo, parte: contenido.parte },
    ].sort((a, b) => (a.parte ?? 0) - (b.parte ?? 0));
  }
  const cuerpo = Array.isArray(contenido.cuerpo) ? contenido.cuerpo : [];
  const fotos = await firmarFotos([contenido.portada_foto_id, ...fotosDeBloques(cuerpo)], supabase);
  const visible = estadoVisible(articulo);
  const publico = articulo.estado === 'publicado' || articulo.estado === 'programado';

  const paraSitio: Articulo = {
    ...contenido,
    cuerpo,
    estado: articulo.estado,
    // Fecha que mostrará: la de publicación, o «hoy» si se publica ahora.
    publicado_en: articulo.publicado_en ?? new Date().toISOString(),
  };

  return (
    <>
      <div className="relative z-50 border-b-2 border-turquesa bg-azul-profundo text-white" data-barra-vista-previa>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="text-[14px]">
            <strong className="font-ui">Vista previa</strong>
            <span className="text-white/80"> · así se verá en el sitio{cambios && publico ? ' con los cambios sin publicar' : ''}. {visible === 'publicado' && !cambios ? 'Ya está publicado.' : 'Aún no es visible para el público.'}</span>
            {registro.error && <span className="block text-turquesa-claro">No se pudo registrar la vista previa. Recarga la página.</span>}
          </div>
          <div className="flex flex-wrap items-start gap-2.5">
            <Link href={`/admin/articulos/${id}`} className="adm-boton bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.6)]">← Volver al editor</Link>
            {!registro.error && (visible !== 'publicado' || cambios) && (
              <Formulario accion={publicarArticulo} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="fecha" value={articulo.publicar_en ? utcAChileLocal(articulo.publicar_en) : ''} />
                {articulo.estado === 'programado' && visible === 'programado' ? (
                  <BotonEnviar name="modo" value="programar" className="adm-boton bg-white text-azul" pendiente="Guardando…">
                    {cambios ? 'Publicar cambios (mantener la fecha)' : 'Confirmar programación'}
                  </BotonEnviar>
                ) : (
                  <BotonEnviar name="modo" value="ahora" className="adm-boton bg-white text-azul" pendiente="Publicando…">
                    {cambios && publico ? 'Publicar los cambios ahora' : 'Publicar ahora'}
                  </BotonEnviar>
                )}
              </Formulario>
            )}
          </div>
        </div>
      </div>
      <Encabezado />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-articulo>
        <ArticuloCompleto articulo={paraSitio} serie={serie} hermanos={hermanos} fotos={fotos} />
      </main>
      <Pie />
    </>
  );
}
