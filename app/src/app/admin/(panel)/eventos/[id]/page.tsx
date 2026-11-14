import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorActividad } from '@/components/admin/eventos/EditorActividad';
import { ListaActividades } from '@/components/admin/eventos/ListaActividades';
import { exigirSeccion } from '@/lib/admin/acceso';
import { esUuid } from '@/lib/admin/bloques';
import { actividadParaEditar, fotosParaActividad, listarActividades, miniaturas, TIPOS_ACTIVIDAD, vistaPreviaContenidoAlDia } from '@/lib/admin/eventos';

export const metadata: Metadata = { title: 'Editar actividad' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> };

export default async function EditarActividad({ params, searchParams }: Props) {
  await exigirSeccion('eventos');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await actividadParaEditar(id);
  if (!datos) notFound();
  const { aviso } = await searchParams;
  const { actividad: a } = datos;
  const [lista, libres, elegidas, previaAlDia] = await Promise.all([
    listarActividades(), fotosParaActividad(id), miniaturas(datos.fotos), vistaPreviaContenidoAlDia('actividad', id),
  ]);
  // Fotos usadas en las secciones (bloques «imagen») para mostrarlas en el editor.
  const enBloques = datos.secciones.flatMap((s) => (Array.isArray(s.contenido) ? s.contenido : []))
    .flatMap((b) => (b.tipo === 'imagen' && b.foto_id ? [b.foto_id] : []));
  const extra = await miniaturas(enBloques.filter((x) => !datos.fotos.includes(x)));

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/eventos" className="text-[14px] font-semibold text-azul">← Eventos y actividades</Link>
        <h1 className="adm-h1">Eventos y actividades</h1>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="hidden xl:block"><ListaActividades lista={lista} actual={id} /></div>
        <EditorActividad
          key={a.actualizado_en}
          id={id}
          version={a.actualizado_en}
          estado={a.estado}
          previaAlDia={previaAlDia}
          tipos={TIPOS_ACTIVIDAD.some((t) => t.clave === a.tipo) ? TIPOS_ACTIVIDAD : [...TIPOS_ACTIVIDAD, { clave: a.tipo, nombre: a.tipo }]}
          fotosElegidas={[...elegidas, ...extra]}
          fotosLibres={libres}
          aviso={aviso ?? null}
          inicial={{
            titulo: a.titulo, slug: a.slug, tipo: a.tipo, anio: String(a.anio),
            fecha_precision: a.fecha_precision, fecha_inicio: a.fecha_precision === 'mes' ? (a.fecha_inicio ?? '').slice(0, 7) : a.fecha_inicio ?? '',
            fecha_fin: a.fecha_fin ?? '', lugar: a.lugar ?? '', zona: a.zona ?? '', introduccion: a.introduccion ?? '',
            lema: a.lema ?? '', cita_texto: a.cita_texto ?? '', cita_referencia: a.cita_referencia ?? '', abreviatura: a.abreviatura ?? '',
            destacar_inicio: a.destacar_inicio, portada_foto_id: a.portada_foto_id, fotos: datos.fotos,
            secciones: datos.secciones, enlaces: datos.enlaces,
          }}
        />
      </div>
    </>
  );
}
