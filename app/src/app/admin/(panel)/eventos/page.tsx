import type { Metadata } from 'next';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { ListaActividades } from '@/components/admin/eventos/ListaActividades';
import { exigirSeccion } from '@/lib/admin/acceso';
import { crearContenido, marcarProximo, moverDestacada } from '@/lib/admin/acciones-contenido';
import { listarActividades } from '@/lib/admin/eventos';

export const metadata: Metadata = { title: 'Eventos y actividades' };

const AVISOS: Record<string, string> = {
  eliminado: 'Actividad eliminada. Sus fotos siguen en la biblioteca.',
  ordenado: 'Orden de Inicio actualizado.',
  proximo: '«Próximo evento» actualizado.',
  'sin-proximo': 'Ya no hay «Próximo evento» marcado.',
};

export default async function Eventos({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('eventos');
  const { aviso } = await searchParams;
  const lista = await listarActividades();
  const destacadas = lista.filter((a) => a.destacar_inicio).sort((a, b) => a.orden_inicio - b.orden_inicio || a.titulo.localeCompare(b.titulo));

  return (
    <>
      <Encabezado />
      {aviso && AVISOS[aviso] && <p role="status" className="adm-ok">{AVISOS[aviso]}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <ListaActividades lista={lista} />
        <div className="flex min-w-0 flex-col gap-6">
          <section className="adm-caja flex flex-col gap-3 p-6" aria-labelledby="t-destacadas" data-destacadas>
            <h2 id="t-destacadas" className="adm-h2">Destacadas en Inicio</h2>
            <p className="text-[13px] text-texto-3">Se muestran en este orden en «Actividades destacadas» (solo las publicadas). Para destacar o quitar una, ábrela y marca «Destacar en Inicio».</p>
            {destacadas.length === 0 ? <p className="text-[14px] text-texto-3">Ninguna actividad destacada.</p> : (
              <ol className="divide-y divide-[#e7e9ec]">
                {destacadas.map((a, i) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]" data-destacada={a.slug}>
                    <span><strong className="mr-2 text-azul-oscuro">{i + 1}.</strong>{a.titulo}{a.estado !== 'publicado' && <span className="text-texto-3"> (borrador)</span>}</span>
                    <span className="flex gap-1">
                      <BotonAccion accion={moverDestacada.bind(null, a.id, -1)} className="adm-mini adm-mini-gris px-2.5" disabled={i === 0} data-subir={a.slug}>↑</BotonAccion>
                      <BotonAccion accion={moverDestacada.bind(null, a.id, 1)} className="adm-mini adm-mini-gris px-2.5" disabled={i === destacadas.length - 1} data-bajar={a.slug}>↓</BotonAccion>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="adm-caja flex flex-col gap-3 p-6" aria-labelledby="t-proximo" data-proximo>
            <h2 id="t-proximo" className="adm-h2">Próximo evento</h2>
            <p className="text-[13px] text-texto-3">Alimenta la barra y el bloque «Próximo evento» de Inicio (solo si está publicado). Puede haber uno solo.</p>
            <ul className="divide-y divide-[#e7e9ec]">
              {lista.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                  <span>{a.titulo}{a.es_proximo && <strong className="ml-2 text-rojo-oscuro">· Próximo evento</strong>}</span>
                  {a.es_proximo
                    ? <BotonAccion accion={marcarProximo.bind(null, a.id, false)} className="adm-mini adm-mini-gris" data-quitar-proximo={a.slug}>Quitar</BotonAccion>
                    : <BotonAccion accion={marcarProximo.bind(null, a.id, true)} className="adm-mini adm-mini-azul" data-marcar-proximo={a.slug}>Marcar como próximo</BotonAccion>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function Encabezado() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="adm-h1">Eventos y actividades</h1>
        <span className="text-[15px] text-texto-3">Las publicadas tienen su propia página y pueden aparecer en Inicio.</span>
      </div>
      <form action={crearContenido.bind(null, 'actividad')}>
        <button className="adm-boton adm-primario min-h-[46px] px-[22px] text-[15px]">+ Nuevo evento</button>
      </form>
    </div>
  );
}
