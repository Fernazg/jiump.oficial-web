import Link from 'next/link';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { exigirPagina } from '@/lib/paginas';
import { Etiqueta, EstadoVacio, Flecha, Foto, Pastilla } from '@/components/Basicos';
import { IconoCalendario } from '@/components/Iconos';
import { Cifras, Destacado, QueHacemos } from '@/components/SeccionesPagina';
import { FilaArticulo, NumeroParte, TarjetaActividad } from '@/components/Tarjetas';
import {
  actividades, albumes, articulos, configuracion, firmarFotos, institucional, series, seccionesDePagina,
} from '@/lib/datos';
import { etiquetaActividad, fechaActividad, nombreMes } from '@/lib/formato';
import { fotosDeSecciones, seccion, texto } from '@/lib/secciones';
import type { Articulo, FotoFirmada, Serie } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

/** Título de portada si la sección no trae uno: el nombre del movimiento (README). */
const NOMBRE_MOVIMIENTO = 'Jóvenes unidos para adorar a Cristo';

export default async function Inicio() {
  const { vistaPrevia } = await exigirPagina('inicio');
  const [secs, inst, acts, arts, listaSeries, albs, conf] = await Promise.all([
    seccionesDePagina('inicio'), institucional(), actividades(), articulos(), series(), albumes(), configuracion(),
  ]);

  const portada = seccion(secs, 'portada');
  const presentacion = seccion(secs, 'presentacion');
  const cifras = inst.filter((i) => i.tipo === 'cifra');
  const destacadas = acts.filter((a) => a.destacar_inicio).sort((a, b) => a.orden_inicio - b.orden_inicio).slice(0, 4);
  const proximo = acts.find((a) => a.es_proximo);
  const recientes = arts.slice(0, 4);
  const serieDe = new Map(listaSeries.map((s) => [s.id, s]));
  const seriesMes = listaSeries.filter((s) => s.tipo === 'mes');
  const albumesConFotos = albs.filter((a) => a.portada_foto_id || a.fotoIds.length > 0).slice(0, 5);

  const fotos = await firmarFotos([
    ...fotosDeSecciones(secs),
    ...destacadas.map((a) => a.portada_foto_id),
    proximo?.portada_foto_id,
    ...recientes.map((a) => a.portada_foto_id),
    ...albumesConFotos.map((a) => a.portada_foto_id ?? a.fotoIds[0]),
  ]);
  const fotoPortada = portada ? fotos.get(String(portada.contenido.foto_id ?? '')) : undefined;
  const totalSerie = (s?: Serie) => (s ? Math.max(0, ...arts.filter((a) => a.serie_id === s.id).map((a) => a.parte ?? 0)) : 0);

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      {proximo && conf.mostrar_barra_proximo_evento && (
        <Link href={`/eventos/${proximo.slug}`} data-barra-proximo
          className="block bg-azul text-white">
          <span className="contenedor flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 font-ui text-[14px] font-semibold">
            <Pastilla tono="rojo">Próximo</Pastilla>
            <span>{proximo.titulo}{fechaActividad(proximo) ? ` · ${fechaActividad(proximo)}` : ''}</span>
            <Flecha />
          </span>
        </Link>
      )}

      {/* Portada */}
      <section className="relative isolate overflow-hidden bg-azul-profundo text-white">
        {fotoPortada && <Foto foto={fotoPortada} prioridad className="absolute inset-0 -z-10 size-full object-cover" tamanos="100vw" />}
        <div className="velo absolute inset-0 -z-10" />
        <div className={`contenedor flex flex-col justify-end ${fotoPortada ? 'min-h-[640px] sm:min-h-[720px]' : 'min-h-[460px] sm:min-h-[520px]'} pb-16 pt-28 sm:pb-20`}>
          <span className="franja-corta mb-6" aria-hidden />
          <h1 className="t-display max-w-[13ch]">{texto(portada?.contenido.titulo) ?? NOMBRE_MOVIMIENTO}</h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/eventos" className="boton boton-primario max-sm:w-full">Próximos eventos <Flecha /></Link>
            <Link href="/nosotros" className="boton boton-borde-claro max-sm:w-full">Conócenos</Link>
          </div>
        </div>
      </section>

      {/* Presentación + cifras (textos oficiales; solo si existen) */}
      {(presentacion || cifras.length > 0) && (
        <section className="contenedor grid gap-10 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center" data-seccion="presentacion">
          <div>
            {texto(presentacion?.contenido.etiqueta) && <p className="t-meta text-azul-oscuro">{texto(presentacion?.contenido.etiqueta)}</p>}
            {texto(presentacion?.contenido.texto) && <p className="mt-3 font-titulo text-[24px] font-bold leading-snug sm:text-[28px]">{texto(presentacion?.contenido.texto)}</p>}
          </div>
          <Cifras cifras={cifras} />
        </section>
      )}

      <QueHacemos seccion={seccion(secs, 'que_hacemos')} fotos={fotos} />
      <Destacado seccion={seccion(secs, 'destacado')} fotos={fotos} />

      {/* Actividades destacadas */}
      {destacadas.length > 0 && (
        <section className="contenedor py-20" data-seccion="actividades-destacadas">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Etiqueta>Actividades destacadas {destacadas[0].anio}</Etiqueta>
              <h2 className="t-h2 mt-3">Lo que vivimos este año</h2>
            </div>
            <Link href="/eventos" className="enlace">Todas las actividades <Flecha /></Link>
          </div>
          <div className="carrusel mt-10 auto-cols-[85%] gap-4 sm:auto-cols-[60%] lg:grid-flow-row lg:grid-cols-12 lg:auto-cols-auto lg:gap-5 lg:overflow-visible">
            {destacadas.map((a, i) => (
              <div key={a.id} className={i === 0 || i === 3 ? 'lg:col-span-7' : 'lg:col-span-5'}>
                <TarjetaActividad actividad={a} foto={fotos.get(a.portada_foto_id ?? '')} grande={i === 0 || i === 3} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Eventos */}
      <section className="bg-gris-claro py-20" data-seccion="eventos">
        <div className="contenedor">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="t-h2">Eventos</h2>
            <Link href="/eventos" className="enlace">Ver calendario <Flecha /></Link>
          </div>
          <div className="mt-8">
            {proximo ? (
              <Link href={`/eventos/${proximo.slug}`} className="tarjeta levantar flex items-center gap-5 p-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-azul-claro text-azul"><IconoCalendario /></span>
                <span>
                  <span className="t-meta block text-azul-oscuro">Próximo · {etiquetaActividad(proximo)}</span>
                  <span className="t-h4 block">{proximo.titulo}</span>
                  {(fechaActividad(proximo) || proximo.lugar) && (
                    <span className="t-meta block text-texto-2">{[fechaActividad(proximo), proximo.lugar].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
              </Link>
            ) : (
              <EstadoVacio compacto icono={<IconoCalendario />} titulo="Aún no hay eventos programados"
                acciones={[{ texto: 'Ver actividades', href: '/eventos#actividades' }, { texto: 'Ir a la galería', href: '/galeria', secundario: true }]}>
                Cuando se confirme la próxima actividad la publicaremos aquí.
              </EstadoVacio>
            )}
          </div>
        </div>
      </section>

      {/* Artículos recientes */}
      <section className="contenedor py-20" data-seccion="articulos-recientes">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="t-h2">Artículos recientes</h2>
          <Link href="/articulos" className="boton boton-primario">Todos los artículos <Flecha /></Link>
        </div>
        {recientes.length === 0 ? (
          <div className="mt-8">
            <EstadoVacio icono={<NumeroVacio />} titulo="Aún no hay artículos publicados" />
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
            <ArticuloDestacado articulo={recientes[0]} serie={serieDe.get(recientes[0].serie_id ?? '')}
              total={totalSerie(serieDe.get(recientes[0].serie_id ?? ''))} foto={fotos.get(recientes[0].portada_foto_id ?? '')} />
            <div>
              <ul className="divide-y divide-linea">
                {recientes.slice(1).map((a) => (
                  <li key={a.id}><FilaArticulo articulo={a} serie={serieDe.get(a.serie_id ?? '')} /></li>
                ))}
              </ul>
              {seriesMes.length > 0 && (
                <div className="mt-6">
                  <p className="t-etiqueta text-texto-2">Series del mes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {seriesMes.map((s) => (
                      <Link key={s.id} href={`/articulos?serie=${s.slug}`}
                        className={`rounded-full px-3 py-1.5 font-ui text-[13px] font-semibold ${s.color === 'rojo' ? 'bg-rojo-claro text-rojo-oscuro' : 'bg-azul-claro text-azul-oscuro'}`}>
                        {[nombreMes(s.mes), s.nombre].filter(Boolean).join(' · ')} ({arts.filter((a) => a.serie_id === s.id).length})
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Momentos JIUMP */}
      {albumesConFotos.length > 0 && (
        <section className="contenedor pb-24" data-seccion="momentos">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="t-h2">Momentos JIUMP</h2>
            <Link href="/galeria" className="enlace">Ir a la galería <Flecha /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {albumesConFotos.map((a, i) => {
              const f = fotos.get(a.portada_foto_id ?? a.fotoIds[0]);
              return (
                <Link key={a.id} href={`/galeria/${a.slug}`}
                  className={`levantar relative isolate flex min-h-[220px] items-end overflow-hidden rounded-[22px] bg-azul-profundo p-5 text-white ${i === 0 ? 'sm:col-span-2 lg:row-span-2 lg:min-h-[460px]' : ''}`}>
                  {f && <Foto foto={f} className="absolute inset-0 -z-10 size-full object-cover" tamanos="(max-width: 640px) 90vw, 50vw" />}
                  <div className="velo absolute inset-0 -z-10" />
                  <span>
                    <span className="t-meta block text-white/80">Álbum</span>
                    <span className="font-titulo text-[22px] font-bold leading-tight">{a.titulo}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function NumeroVacio() {
  return <span className="font-titulo text-[22px] font-extrabold">0</span>;
}

function ArticuloDestacado({ articulo, serie, total, foto }: {
  articulo: Articulo; serie?: Serie; total: number; foto?: FotoFirmada;
}) {
  const rojo = serie?.color === 'rojo';
  return (
    <Link href={`/articulos/${articulo.slug}`} data-articulo={articulo.slug} className="group block">
      <div className="relative overflow-hidden rounded-[22px]">
        {foto ? (
          <Foto foto={foto} className="aspect-[16/11] w-full object-cover" tamanos="(max-width: 1024px) 90vw, 50vw" />
        ) : (
          <NumeroParte parte={articulo.parte} color={serie?.color ?? 'azul'} tam="grande" />
        )}
        {serie && <span className="absolute left-4 top-4"><Pastilla tono={rojo ? 'rojo' : 'azul'}>{serie.nombre}</Pastilla></span>}
      </div>
      {serie && articulo.parte && (
        <p className={`t-meta mt-4 ${rojo ? 'text-rojo-oscuro' : 'text-azul-oscuro'}`}>{serie.nombre} · Parte {articulo.parte} de {total}</p>
      )}
      <h3 className="t-h3 mt-1 group-hover:text-azul">{articulo.titulo}</h3>
    </Link>
  );
}
