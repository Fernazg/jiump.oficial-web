import type { Metadata } from 'next';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { exigirPagina } from '@/lib/paginas';
import Link from 'next/link';
import { EstadoVacio, Flecha, Foto } from '@/components/Basicos';
import { IconoAntorcha, IconoBuscar, IconoLibro } from '@/components/Iconos';
import { FilaArticulo, NumeroParte } from '@/components/Tarjetas';
import { articulos, articulosDeTema, buscarArticulos, firmarFotos, series, temas } from '@/lib/datos';
import { fechaLarga, nombreMes } from '@/lib/formato';
import type { Articulo, FotoFirmada, Serie } from '@/lib/tipos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Artículos' };

type Busqueda = { q?: string; serie?: string; tema?: string };

export default async function Articulos({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { vistaPrevia } = await exigirPagina('articulos');
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const [todos, listaSeries, listaTemas] = await Promise.all([articulos(), series(), temas()]);
  const serieDe = new Map(listaSeries.map((s) => [s.id, s]));
  const totalSerie = (s: Serie) => Math.max(0, ...todos.filter((a) => a.serie_id === s.id).map((a) => a.parte ?? 0));

  // Resultado filtrado: búsqueda, serie o tema
  const filtroSerie = params.serie ? listaSeries.find((s) => s.slug === params.serie) : undefined;
  const filtroTema = params.tema ? listaTemas.find((t) => t.slug === params.tema) : undefined;
  let resultado: { titulo: string; lista: Articulo[] } | null = null;
  if (q) resultado = { titulo: `Resultados para «${q}»`, lista: await buscarArticulos(q) };
  else if (filtroSerie) resultado = {
    titulo: filtroSerie.nombre,
    lista: todos.filter((a) => a.serie_id === filtroSerie.id).sort((a, b) => (a.parte ?? 0) - (b.parte ?? 0)),
  };
  else if (filtroTema) resultado = { titulo: filtroTema.nombre, lista: await articulosDeTema(filtroTema.id) };

  const seriesMes = listaSeries.filter((s) => s.tipo === 'mes' && todos.some((a) => a.serie_id === s.id));
  const anteriores = todos.filter((a) => !seriesMes.some((s) => s.id === a.serie_id));
  const chips = [
    ...listaSeries.filter((s) => s.tipo === 'tematica').map((s) => ({ texto: s.nombre, href: `/articulos?serie=${s.slug}`, serie: true })),
    ...listaTemas.map((t) => ({ texto: t.nombre, href: `/articulos?tema=${t.slug}`, serie: false })),
  ];
  const fotos = await firmarFotos(todos.map((a) => a.portada_foto_id));

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <section className="contenedor pb-10 pt-16 sm:pt-20">
        <h1 className="t-h1 max-w-[16ch]">Reflexiones y enseñanzas para fortalecer tu fe</h1>
        <form action="/articulos" role="search" className="relative mt-8 max-w-[880px]">
          <label htmlFor="q" className="sr-only">Buscar artículos</label>
          <IconoBuscar className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-texto-2" tam={20} />
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por tema, serie o pasaje"
            className="h-14 w-full rounded-full border border-linea bg-white pl-13 pr-32 text-[17px] outline-none focus:border-azul focus:ring-2 focus:ring-azul-claro" />
          <button type="submit" className="boton boton-primario absolute right-1.5 top-1/2 min-h-11 -translate-y-1/2 px-5">Buscar</button>
        </form>
      </section>

      {resultado ? (
        <section className="contenedor pb-24" data-resultado>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="t-h3">{resultado.titulo}</h2>
            <Link href="/articulos" className="enlace">Ver todos los artículos</Link>
          </div>
          {resultado.lista.length > 0 ? (
            <ul className="mt-6 divide-y divide-linea">
              {resultado.lista.map((a) => (
                <li key={a.id}><FilaArticulo articulo={a} serie={serieDe.get(a.serie_id ?? '')} /></li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EstadoVacio icono={<IconoBuscar />} titulo={q ? `No encontramos artículos con «${q}»` : 'Aún no hay artículos publicados aquí'}
                acciones={[{ texto: 'Ver todos los artículos', href: '/articulos' }, ...(q ? [{ texto: 'Limpiar búsqueda', href: '/articulos', secundario: true }] : [])]}>
                {q ? 'Revisa cómo está escrita la palabra o prueba con otra. También puedes explorar las series del mes.' : null}
              </EstadoVacio>
            </div>
          )}
        </section>
      ) : (
        <>
          {todos.length === 0 && (
            <section className="contenedor pb-24">
              <EstadoVacio icono={<IconoLibro />} titulo="Aún no hay artículos publicados" />
            </section>
          )}

          {seriesMes.map((s) => (
            <SerieDelMes key={s.id} serie={s} total={totalSerie(s)} fotos={fotos}
              lista={todos.filter((a) => a.serie_id === s.id).sort((a, b) => (a.parte ?? 0) - (b.parte ?? 0))} />
          ))}

          {anteriores.length > 0 && (
            <section className="contenedor py-20" data-seccion="anteriores">
              <h2 className="t-h2">Artículos anteriores</h2>
              <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {anteriores.map((a) => {
                  const s = serieDe.get(a.serie_id ?? '');
                  const f = fotos.get(a.portada_foto_id ?? '');
                  return (
                    <li key={a.id}>
                      <Link href={`/articulos/${a.slug}`} data-articulo={a.slug} className="levantar group block">
                        {f ? <Foto foto={f} className="aspect-[16/9] w-full rounded-[18px] object-cover" tamanos="(max-width: 640px) 90vw, 30vw" />
                          : <div className="aspect-[16/9] rounded-[18px] bg-azul-claro" aria-hidden><span className="franja-corta m-5 block" /></div>}
                        {s && <p className="t-meta mt-3 text-azul-oscuro">{s.nombre}</p>}
                        <h3 className="t-h4 mt-1 group-hover:text-azul">{a.titulo}</h3>
                        {a.publicado_en && <p className="t-meta mt-1 font-normal text-texto-2">{fechaLarga(a.publicado_en)}</p>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {chips.length > 0 && (
            <section className="contenedor pb-24">
              <p className="t-etiqueta text-texto-2">Series y temas anteriores</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Link key={c.href} href={c.href}
                    className={`rounded-full px-4 py-2 font-ui text-[14px] font-semibold ${c.serie ? 'bg-azul-claro text-azul-oscuro' : 'text-texto shadow-[inset_0_0_0_1px_var(--color-linea)]'}`}>
                    {c.texto}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function SerieDelMes({ serie, lista, total, fotos }: { serie: Serie; lista: Articulo[]; total: number; fotos: Map<string, FotoFirmada> }) {
  const rojo = serie.color === 'rojo';
  const afiche = lista.map((a) => fotos.get(a.portada_foto_id ?? '')).find(Boolean);
  const mes = nombreMes(serie.mes);
  return (
    <section className={`border-t-4 py-20 ${rojo ? 'border-rojo bg-white' : 'border-azul bg-gris-claro'}`} data-serie={serie.slug}>
      <div className="contenedor">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex gap-5">
            <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-white ${rojo ? 'bg-rojo' : 'bg-azul'}`}>
              {rojo ? <IconoAntorcha /> : <IconoLibro />}
            </span>
            <div>
              {mes && <p className={`t-etiqueta ${rojo ? 'text-rojo-oscuro' : 'text-azul-oscuro'}`}>{mes}</p>}
              <h2 className="t-h2 mt-2">{serie.nombre}</h2>
              {serie.descripcion && <p className="medida mt-3 text-texto-2">{serie.descripcion}</p>}
            </div>
          </div>
          <p className={`rounded-full px-4 py-2 font-ui text-[13px] font-semibold ${rojo ? 'bg-rojo-claro text-rojo-oscuro' : 'bg-azul-claro text-azul-oscuro'}`}>
            {lista.length} {lista.length === 1 ? 'artículo' : 'artículos'} · léelos en orden
          </p>
        </div>

        {rojo ? (
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-center">
            {afiche && <Foto foto={afiche} className="w-full max-w-[380px] rounded-[22px] shadow-[var(--shadow-tarjeta)]" tamanos="380px" />}
            <div>
              <ul className="space-y-3">
                {lista.map((a) => (
                  <li key={a.id} className="tarjeta px-4"><FilaArticulo articulo={a} serie={serie} total={total} /></li>
                ))}
              </ul>
              <Link href={`/articulos/${lista[0].slug}`} className="boton boton-rojo mt-6">Comienza por la parte {lista[0].parte ?? 1} <Flecha /></Link>
            </div>
          </div>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {lista.map((a) => (
              <li key={a.id}>
                <Link href={`/articulos/${a.slug}`} data-articulo={a.slug} className="levantar group block">
                  <div className="relative">
                    <NumeroParte parte={a.parte} color={serie.color} tam="grande" />
                    <span className="t-etiqueta absolute left-4 top-4 text-[11px] text-white/90">{serie.nombre}</span>
                  </div>
                  <p className="t-meta mt-3 text-azul-oscuro">Parte {a.parte} de {total}</p>
                  <h3 className="t-h4 mt-1 group-hover:text-azul">{a.titulo}</h3>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
