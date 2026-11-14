import Link from 'next/link';
import { EstadoVacio, Flecha, Foto } from '@/components/Basicos';
import { Bloques, indiceDeBloques } from '@/components/Bloques';
import { IconoAntorcha, IconoLibro, IconoTexto } from '@/components/Iconos';
import { BarraLectura, TamanoTexto } from '@/components/Lectura';
import { fechaLarga, nombreMes } from '@/lib/formato';
import type { Articulo, FotoFirmada, Serie } from '@/lib/tipos';

/**
 * Página completa de un artículo. La usan el sitio público y la vista previa
 * del panel /admin, para que la vista previa se vea exactamente igual.
 */
export function ArticuloCompleto({ articulo, serie, hermanos, fotos }: {
  articulo: Articulo;
  serie: Serie | undefined;
  /** Artículos de la misma serie (incluido este), ordenados por parte. */
  hermanos: Pick<Articulo, 'id' | 'slug' | 'titulo' | 'parte'>[];
  fotos: Map<string, FotoFirmada>;
}) {
  const total = Math.max(0, ...hermanos.map((a) => a.parte ?? 0));
  const siguiente = hermanos.find((a) => (a.parte ?? 0) > (articulo.parte ?? 0));
  const cuerpo = Array.isArray(articulo.cuerpo) ? articulo.cuerpo : [];
  const indice = indiceDeBloques(cuerpo);
  const portada = fotos.get(articulo.portada_foto_id ?? '');

  const rojo = serie?.color === 'rojo';
  const azulPalabra = serie?.color === 'azul';
  const tono = rojo ? 'rojo' : 'azul';
  // Fecha: en una serie del mes se muestra el mes de la serie; si no, la fecha de publicación.
  const fecha = serie?.tipo === 'mes' ? nombreMes(serie.mes) : articulo.publicado_en ? fechaLarga(articulo.publicado_en) : null;
  const meta = [
    articulo.autor,
    fecha,
    cuerpo.length > 0 ? `${articulo.minutos_lectura} min de lectura` : null,
    indice.length > 0 ? `${indice.length} ${indice.length === 1 ? 'sección' : 'secciones'}` : null,
  ].filter(Boolean);

  return (
    <>
    <article>
      {cuerpo.length > 0 && <BarraLectura color={tono} />}

      {/* Cabecera según la serie: Biblia en azul Palabra; Reforma en blanco con detalles rojos */}
      <header className={azulPalabra ? 'bg-azul text-white' : `bg-white ${rojo ? 'border-b border-linea' : ''}`}>
        <div className="contenedor grid gap-10 py-14 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <nav aria-label="Ruta" className={`t-meta font-normal ${azulPalabra ? 'text-white/85' : 'text-texto-2'}`}>
              <Link href="/articulos" className="underline underline-offset-2">Artículos</Link>
              {serie && <> / <Link href={`/articulos?serie=${serie.slug}`} className="underline underline-offset-2">{[nombreMes(serie.mes), serie.nombre].filter(Boolean).join(' · ')}</Link></>}
            </nav>
            {serie && articulo.parte && (
              <p className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 font-ui text-[13px] font-semibold ${azulPalabra ? 'bg-white/15 text-white' : rojo ? 'bg-rojo-claro text-rojo-oscuro' : 'bg-azul-claro text-azul-oscuro'}`}>
                {rojo ? <IconoAntorcha tam={14} /> : <IconoLibro tam={14} />} Parte {articulo.parte} de {total}
              </p>
            )}
            <h1 className="t-h1 mt-4 max-w-[18ch]">{articulo.titulo}</h1>
            {articulo.bajada && <p className={`t-entradilla mt-4 max-w-[48ch] ${azulPalabra ? 'text-white/90' : 'text-texto-2'}`}>{articulo.bajada}</p>}
            {meta.length > 0 && (
              <p className={`t-meta mt-5 flex flex-wrap gap-x-3 font-normal ${azulPalabra ? 'text-white/85' : 'text-texto-2'}`}>
                {meta.map((m, i) => <span key={i}>{i > 0 && <span aria-hidden className="mr-3">·</span>}{m}</span>)}
              </p>
            )}
            {serie && total > 1 && (
              <div className="mt-6 flex gap-2" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={`h-1 w-14 rounded-full ${i + 1 === articulo.parte ? (azulPalabra ? 'bg-white' : 'bg-rojo') : (azulPalabra ? 'bg-white/30' : 'bg-rojo-claro')}`} />
                ))}
              </div>
            )}
          </div>
          {portada && <Foto foto={portada} prioridad className="w-full max-w-[300px] rounded-[18px] shadow-[var(--shadow-tarjeta)] lg:w-[300px]" tamanos="300px" />}
        </div>
      </header>

      <div className="contenedor grid gap-12 py-14 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="order-2 lg:order-1">
          <div className="space-y-8 lg:sticky lg:top-28">
            {indice.length > 0 && (
              <nav aria-label="En este artículo">
                <p className="t-etiqueta text-texto-2">En este artículo</p>
                <ol className="mt-3 space-y-2 border-l border-linea">
                  {indice.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="-ml-px flex gap-2 border-l-2 border-transparent pl-3 text-[14px] leading-snug text-texto-2 hover:border-azul hover:text-azul">
                        <span className={rojo ? 'text-rojo-oscuro' : 'text-azul-oscuro'}>{String(s.numero).padStart(2, '0')}</span> {s.texto}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {serie && hermanos.length > 1 && (
              <nav aria-label={`Serie ${serie.nombre}`}>
                <p className="t-etiqueta text-texto-2">Serie · {serie.nombre}</p>
                <ol className="mt-3 space-y-1.5">
                  {hermanos.map((h) => (
                    <li key={h.id}>
                      <Link href={`/articulos/${h.slug}`} aria-current={h.id === articulo.id ? 'page' : undefined}
                        className={`flex gap-3 rounded-xl px-3 py-2 text-[14px] leading-snug ${h.id === articulo.id ? (rojo ? 'bg-rojo-claro font-semibold' : 'bg-azul-claro font-semibold') : 'hover:bg-gris-claro'}`}>
                        <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white ${rojo ? 'bg-rojo' : 'bg-azul'}`}>{h.parte}</span>
                        {h.titulo}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {cuerpo.length > 0 && (
              <div>
                <p className="t-etiqueta mb-3 text-texto-2">Tamaño del texto</p>
                <TamanoTexto />
              </div>
            )}
          </div>
        </aside>

        <div id="cuerpo-articulo" className="order-1 max-w-[720px] lg:order-2">
          {cuerpo.length > 0 ? (
            <Bloques bloques={cuerpo} fotos={fotos} tono={tono} />
          ) : (
            <EstadoVacio icono={<IconoTexto />} titulo="Este artículo aún no tiene su texto publicado"
              acciones={[{ texto: 'Ver todos los artículos', href: '/articulos' }]}>
              El equipo lo completará desde el panel.
            </EstadoVacio>
          )}

          {serie && (
            <footer className="mt-16 border-t border-linea pt-8">
              {articulo.parte && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="t-h4">Terminaste la parte {articulo.parte} de {total}</p>
                  <a href="#contenido" className={`font-ui text-[14px] font-semibold ${rojo ? 'text-rojo-oscuro' : 'text-azul'}`}>↑ Volver arriba</a>
                </div>
              )}
              {siguiente && (
                <Link href={`/articulos/${siguiente.slug}`} data-siguiente
                  className={`levantar mt-5 block rounded-[20px] px-6 py-6 text-white ${rojo ? 'bg-rojo' : 'bg-azul'}`}>
                  <span className="t-etiqueta text-white/85">Sigue leyendo · Parte {siguiente.parte} de {total}</span>
                  <span className="t-h3 mt-2 block">{siguiente.titulo}</span>
                  <span className="mt-3 inline-flex gap-1 font-ui text-[14px] font-semibold">Leer ahora <Flecha /></span>
                </Link>
              )}
              <Link href={`/articulos?serie=${serie.slug}`} className={`mt-6 inline-block font-ui text-[14px] font-semibold underline underline-offset-2 ${rojo ? 'text-rojo-oscuro' : 'text-azul'}`}>
                Ver todos los artículos de {serie.nombre}
              </Link>
            </footer>
          )}
        </div>
      </div>
    </article>
    </>
  );
}
