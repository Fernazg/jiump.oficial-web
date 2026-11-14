import type { Metadata } from 'next';
import Link from 'next/link';
import { Confirmar } from '@/components/admin/Confirmar';
import { SelectorAuto } from '@/components/admin/SelectorAuto';
import { exigirSeccion } from '@/lib/admin/acceso';
import { crearArticulo, eliminarDefinitivo, moverAPapelera, restaurarDePapelera } from '@/lib/admin/acciones-articulos';
import {
  diasEnPapelera, ESTADOS, estadoInfo, estadoVisible, listarArticulos, nombreSerie, seriesYTemas, type FilaArticulo,
} from '@/lib/admin/articulos';
import { fechaChile, fechaHoraChile } from '@/lib/admin/hora-chile';
import { clientePanel } from '@/lib/admin/supabase-panel';

export const metadata: Metadata = { title: 'Artículos' };

type Props = { searchParams: Promise<{ q?: string; estado?: string; serie?: string; tema?: string; aviso?: string }> };

const AVISOS: Record<string, string> = {
  papelera: 'El artículo pasó a la papelera. Puedes recuperarlo durante 30 días.',
  eliminado: 'El artículo se eliminó definitivamente.',
};

function fechaDe(a: FilaArticulo): string {
  if (a.estado === 'papelera') return `Quedan ${diasEnPapelera(a.en_papelera_desde)} días`;
  if (estadoVisible(a) === 'programado' && a.publicar_en) return fechaHoraChile(a.publicar_en);
  if (a.publicado_en && estadoVisible(a) === 'publicado') return fechaChile(a.publicado_en);
  return `Editado ${fechaChile(a.actualizado_en)}`;
}

export default async function Articulos({ searchParams }: Props) {
  await exigirSeccion('articulos');
  const f = await searchParams;
  const estadoFiltro = ESTADOS.some((e) => e.clave === f.estado) ? f.estado : undefined;
  const [lista, { series, temas }] = await Promise.all([
    listarArticulos({ ...f, estado: estadoFiltro }),
    seriesYTemas(),
  ]);
  const serieDe = new Map(series.map((s) => [s.id, s]));

  // Miniaturas de portada (URL firmadas con la sesión de la persona).
  const supabase = await clientePanel();
  const portadas = [...new Set(lista.map((a) => a.portada_foto_id).filter((x): x is string => Boolean(x)))];
  const miniaturas = new Map<string, { url: string; alt: string }>();
  if (portadas.length) {
    const { data: fotos } = await supabase.from('fotos').select('id, archivo, texto_alternativo').in('id', portadas);
    const fs = (fotos ?? []) as { id: string; archivo: string; texto_alternativo: string }[];
    const { data: firmas } = await supabase.storage.from('fotos').createSignedUrls(fs.map((x) => x.archivo), 3600);
    const porRuta = new Map((firmas ?? []).map((x) => [x.path, x.signedUrl]));
    for (const x of fs) if (porRuta.get(x.archivo)) miniaturas.set(x.id, { url: porRuta.get(x.archivo)!, alt: x.texto_alternativo });
  }

  const enlace = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: f.q, serie: f.serie, tema: f.tema, estado: estadoFiltro, ...cambios })) if (v) p.set(k, v);
    return `/admin/articulos${p.size ? `?${p}` : ''}`;
  };
  const volver = enlace({});

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="adm-h1">Artículos</h1>
          <span className="text-[15px] text-texto-3">Escribe, revisa y publica sin tocar código.</span>
        </div>
        <form action={crearArticulo}><button className="adm-boton adm-primario min-h-[46px] px-[22px] text-[15px]">+ Nuevo artículo</button></form>
      </div>

      {f.aviso && AVISOS[f.aviso] && <p role="status" className="adm-ok">{AVISOS[f.aviso]}</p>}

      {/* Buscador y filtros */}
      <form action="/admin/articulos" role="search" className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-white p-3">
        {estadoFiltro && <input type="hidden" name="estado" value={estadoFiltro} />}
        <label className="flex min-h-11 flex-[1_1_260px] items-center gap-2 rounded-xl border border-[#cdd1d6] px-3.5">
          <span aria-hidden className="text-texto-3">⌕</span>
          <span className="sr-only">Buscar artículos</span>
          <input type="search" name="q" defaultValue={f.q} placeholder="Buscar por título, autor o texto…" className="w-full bg-transparent text-[14px] outline-none" />
        </label>
        <SelectorAuto name="serie" etiqueta="Serie" defaultValue={f.serie}>
          <option value="">Todas</option>
          {series.map((s) => <option key={s.id} value={s.id}>{nombreSerie(s)}</option>)}
          <option value="sin-serie">Sin serie</option>
        </SelectorAuto>
        <SelectorAuto name="tema" etiqueta="Tema" defaultValue={f.tema}>
          <option value="">Todos</option>
          {temas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </SelectorAuto>
        <button className="adm-boton adm-secundario min-h-11">Buscar</button>
      </form>
      <nav aria-label="Filtrar por estado" className="-mt-2 flex flex-wrap gap-2">
        <Link href={enlace({ estado: undefined })} aria-current={!estadoFiltro ? 'true' : undefined} className="adm-filtro">Todos</Link>
        {ESTADOS.map((e) => (
          <Link key={e.clave} href={enlace({ estado: e.clave })} aria-current={estadoFiltro === e.clave ? 'true' : undefined} className="adm-filtro">
            {e.nombre}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-6">
        {/* Lista */}
        <section className="adm-caja min-w-0 flex-[3_1_560px] px-2 pb-4 pt-2" aria-label="Lista de artículos">
          <table className="w-full border-collapse text-[14px]" data-lista-articulos>
            <thead className="hidden text-left text-texto-3 sm:table-header-group">
              <tr>
                <th className="px-3 py-3.5 font-semibold">Artículo</th>
                <th className="px-3 py-3.5 font-semibold">Estado</th>
                <th className="px-3 py-3.5 font-semibold">Fecha</th>
                <th className="px-3 py-3.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const serie = a.serie_id ? serieDe.get(a.serie_id) : undefined;
                const mini = a.portada_foto_id ? miniaturas.get(a.portada_foto_id) : undefined;
                const visible = estadoVisible(a);
                return (
                  <tr key={a.id} data-articulo={a.slug} className="adm-fila grid grid-cols-[1fr_auto] border-t border-[#e7e9ec] sm:table-row">
                    <td className="col-span-2 px-3 pb-1 pt-3 sm:p-3">
                      <div className="flex items-center gap-3">
                        {mini
                          // eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado)
                          ? <img src={mini.url} alt="" className="h-[46px] w-16 shrink-0 rounded-[10px] object-cover" />
                          : <div aria-hidden className={`h-[46px] w-16 shrink-0 rounded-[10px] ${serie?.color === 'rojo' ? 'bg-rojo' : 'bg-[#0b4a73]'}`} />}
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <strong className="text-[15px] leading-snug">{a.titulo}</strong>
                          <span className="text-[12.5px] text-texto-3">
                            {serie ? `${nombreSerie(serie)}${a.parte ? ` · Parte ${a.parte}` : ''}` : 'Sin serie'}
                            {a.cambios && <span className="ml-1.5 font-semibold text-[#7a4b00]">· cambios sin publicar</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 sm:p-3"><span className={`adm-chip ${estadoInfo(visible).chip}`}>{estadoInfo(visible).nombre}</span></td>
                    <td className="px-3 py-1.5 text-right text-texto-3 sm:p-3 sm:text-left">{fechaDe(a)}</td>
                    <td className="col-span-2 px-3 pb-3 pt-1 sm:p-3 sm:text-right">
                      <div className="flex flex-wrap gap-1 sm:justify-end">
                        {a.estado === 'papelera' ? (
                          <>
                            <Confirmar boton="Restaurar" claseBoton="adm-mini adm-mini-azul" titulo={`¿Restaurar «${a.titulo}»?`}
                              confirmar="Sí, restaurar" peligro={false} accion={restaurarDePapelera.bind(null, a.id)}>
                              Vuelve como borrador (o en revisión, si lo estaba). Para que se vea en el sitio habrá que publicarlo de nuevo, con vista previa.
                            </Confirmar>
                            <Confirmar boton="Eliminar definitivamente" etiqueta={`Eliminar definitivamente ${a.titulo}`}
                              titulo={`¿Eliminar «${a.titulo}» para siempre?`} confirmar="Sí, eliminar para siempre"
                              accion={eliminarDefinitivo.bind(null, a.id)}>
                              Esta acción no se puede deshacer: se borran el artículo y su historial de versiones.
                            </Confirmar>
                          </>
                        ) : (
                          <>
                            <Link href={`/admin/articulos/${a.id}`} className="adm-mini adm-mini-azul">Editar</Link>
                            <Link href={`/admin/articulos/${a.id}/vista-previa`} className="adm-mini adm-mini-gris">Vista previa</Link>
                            <Confirmar boton="Eliminar" etiqueta={`Eliminar ${a.titulo}`} titulo={`¿Eliminar «${a.titulo}»?`}
                              accion={moverAPapelera.bind(null, a.id, volver)}>
                              El artículo dejará de verse en la web y pasará a la papelera. Podrás recuperarlo durante 30 días.
                            </Confirmar>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length === 0 && (
            <p className="p-6 text-center text-texto-3" data-sin-resultados>
              {estadoFiltro === 'papelera' ? 'La papelera está vacía.' : 'No hay artículos que coincidan con la búsqueda.'}
            </p>
          )}
          <p className="mx-3 mt-3 text-[13px] text-texto-3">
            Mostrando {lista.length} {lista.length === 1 ? 'artículo' : 'artículos'}
            {estadoFiltro === 'papelera'
              ? ' · la papelera se vacía sola: cada artículo se borra 30 días después de eliminarlo.'
              : ' · cada serie mensual tiene color, ícono y orden de partes propios.'}
          </p>
        </section>

        {/* Series y categorías */}
        <aside className="adm-caja flex min-w-0 flex-[1_1_280px] flex-col gap-3 p-[22px]" aria-labelledby="t-series">
          <div className="flex items-center justify-between gap-2">
            <h2 id="t-series" className="font-titulo text-[18px] font-extrabold">Series y categorías</h2>
            <Link href="/admin/articulos/series" className="adm-boton adm-borde-azul min-h-9 px-3 text-[13px]">+ Agregar</Link>
          </div>
          {series.map((s) => (
            <Link key={s.id} href={enlace({ serie: s.id, estado: undefined })} className="flex justify-between gap-3 border-t border-[#e7e9ec] py-2.5 text-[14px] hover:text-azul">
              <span>
                {s.color !== 'neutro' && <span aria-hidden className={`mr-2 inline-block size-2.5 rounded-full ${s.color === 'rojo' ? 'bg-rojo' : 'bg-azul'}`} />}
                {nombreSerie(s)}
              </span>
              <span className="text-texto-3">{s.total}</span>
            </Link>
          ))}
          {temas.length > 0 && (
            <span className="text-[13px] text-texto-3">Temas: {temas.map((t) => t.nombre).join(' · ')}</span>
          )}
          <span className="rounded-[10px] bg-gris-claro p-2.5 text-[12.5px] leading-normal text-texto-3">
            Una serie con artículos no se puede borrar: primero hay que moverlos a otra.
          </span>
        </aside>
      </div>
    </>
  );
}
