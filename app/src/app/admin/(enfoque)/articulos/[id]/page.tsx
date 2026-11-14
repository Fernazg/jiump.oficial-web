import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Confirmar } from '@/components/admin/Confirmar';
import { Editor } from '@/components/admin/editor/Editor';
import { exigirSeccion } from '@/lib/admin/acceso';
import { restaurarDePapelera } from '@/lib/admin/acciones-articulos';
import { articuloParaEditar, bibliotecaFotos, diasEnPapelera, estadoVisible, nombreSerie, seriesYTemas, versiones, vistaPreviaAlDia } from '@/lib/admin/articulos';
import { esUuid } from '@/lib/admin/bloques';
import { utcAChileLocal } from '@/lib/admin/hora-chile';

export const metadata: Metadata = { title: 'Editar artículo' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> };

export default async function EditarArticulo({ params, searchParams }: Props) {
  const acceso = await exigirSeccion('articulos');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await articuloParaEditar(id);
  if (!datos) notFound();
  const { articulo, cambios, temas: temasArticulo } = datos;
  const { aviso } = await searchParams;

  if (articulo.estado === 'papelera') {
    return (
      <main id="contenido" className="mx-auto mt-10 w-full max-w-[560px] px-5">
        <div className="adm-caja p-8 text-center">
          <h1 className="adm-h1">«{articulo.titulo}» está en la papelera</h1>
          <p className="mt-3 text-texto-2">Se eliminará definitivamente en {diasEnPapelera(articulo.en_papelera_desde)} días. Restáuralo para volver a editarlo.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/admin/articulos?estado=papelera" className="adm-boton adm-secundario">Ir a la papelera</Link>
            <Confirmar boton="Restaurar" claseBoton="adm-boton adm-primario" titulo={`¿Restaurar «${articulo.titulo}»?`} confirmar="Sí, restaurar"
              peligro={false} accion={restaurarDePapelera.bind(null, id)}>
              Vuelve como borrador. Para publicarlo hará falta revisar la vista previa.
            </Confirmar>
          </div>
        </div>
      </main>
    );
  }

  const [{ series, temas }, historial, fotos, previaAlDia] = await Promise.all([
    seriesYTemas(), versiones(id, acceso.userId), bibliotecaFotos(), vistaPreviaAlDia(id),
  ]);
  const base = cambios ?? articulo;
  const publico = articulo.estado === 'publicado' || articulo.estado === 'programado';

  return (
    <Editor
      id={id}
      inicial={{
        titulo: base.titulo, bajada: base.bajada ?? '', autor: base.autor ?? '', slug: articulo.slug,
        serie_id: base.serie_id, parte: base.parte, portada_foto_id: base.portada_foto_id,
        destacado_inicio: articulo.destacado_inicio, temas: temasArticulo, cuerpo: Array.isArray(base.cuerpo) ? base.cuerpo : [],
      }}
      version={publico && cambios ? cambios.actualizado_en : articulo.actualizado_en}
      estado={articulo.estado}
      estadoVisible={estadoVisible(articulo)}
      publicarEn={articulo.publicar_en ? utcAChileLocal(articulo.publicar_en) : null}
      publicarEnIso={articulo.publicar_en}
      hayCambiosPendientes={publico && Boolean(cambios)}
      previaAlDia={previaAlDia}
      series={series.map((s) => ({ id: s.id, nombre: nombreSerie(s) }))}
      temas={temas.map((t) => ({ id: t.id, nombre: t.nombre }))}
      fotos={fotos}
      historial={historial}
      aviso={aviso ?? null}
      slugPublico={articulo.slug}
    />
  );
}
