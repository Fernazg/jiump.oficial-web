import Link from 'next/link';
import { boton, lista, objeto, texto } from '@/lib/secciones';
import type { FotoFirmada, Institucional, SeccionPagina } from '@/lib/tipos';
import { Etiqueta, Flecha, Foto } from './Basicos';

/**
 * Secciones editables desde «Administrar página web». Cada una se muestra solo
 * si existe en la base (página publicada + sección visible); si falta algún
 * campo, ese elemento no se muestra.
 */

/** Cifras de `institucional` (tipo «cifra»: título = valor, texto = descripción). */
export function Cifras({ cifras }: { cifras: Institucional[] }) {
  if (cifras.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-6 border-t border-linea pt-6 sm:grid-cols-3">
      {cifras.map((c) => (
        <div key={c.id}>
          <dt className="font-titulo text-[30px] font-extrabold leading-none text-azul sm:text-[34px]">{c.titulo}</dt>
          {c.texto && <dd className="mt-2 text-[14px] leading-snug text-texto-2">{c.texto}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** «Qué hacemos»: etiqueta, título, enlace y tarjetas con foto (carrusel en celular). */
export function QueHacemos({ seccion, fotos }: { seccion?: SeccionPagina; fotos: Map<string, FotoFirmada> }) {
  if (!seccion) return null;
  const c = seccion.contenido;
  const titulo = texto(c.titulo);
  const enlace = boton(c.enlace);
  const tarjetas = lista(c.tarjetas).map(objeto).filter((t) => texto(t.titulo));
  if (!titulo && tarjetas.length === 0) return null;
  return (
    <section className="contenedor py-20" data-seccion="que_hacemos">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {texto(c.etiqueta) && <Etiqueta>{texto(c.etiqueta)}</Etiqueta>}
          {titulo && <h2 className="t-h2 mt-3 max-w-[16ch]">{titulo}</h2>}
        </div>
        {enlace && <Link href={enlace.url} className="enlace">{enlace.texto} <Flecha /></Link>}
      </div>
      {tarjetas.length > 0 && (
        <ul className="carrusel mt-10 auto-cols-[280px] gap-4 lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto lg:overflow-visible">
          {tarjetas.map((t, i) => {
            const f = fotos.get(String(t.foto_id ?? ''));
            return (
              <li key={i} className="relative h-[360px] overflow-hidden rounded-[22px] bg-azul-profundo">
                {f && <Foto foto={f} className="absolute inset-0 size-full object-cover" tamanos="280px" />}
                <div className="velo absolute inset-0" />
                <p className="absolute inset-x-5 bottom-5 font-titulo text-[20px] font-bold leading-tight text-white">{texto(t.titulo)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Bloque destacado sobre azul profundo («Heme aquí»). */
export function Destacado({ seccion, fotos }: { seccion?: SeccionPagina; fotos: Map<string, FotoFirmada> }) {
  if (!seccion) return null;
  const c = seccion.contenido;
  const titulo = texto(c.titulo);
  if (!titulo) return null;
  const accion = boton(c.boton);
  const imgs = lista<string>(c.fotos).map((id) => fotos.get(id)).filter((f): f is FotoFirmada => Boolean(f)).slice(0, 3);
  return (
    <section className="bg-azul-profundo text-white" data-seccion="destacado">
      <div className="contenedor grid items-center gap-12 py-24 lg:grid-cols-2">
        <div>
          {texto(c.etiqueta) && <Etiqueta linea clara>{texto(c.etiqueta)}</Etiqueta>}
          <h2 className="t-display mt-4">{titulo}</h2>
          {texto(c.texto) && <p className="t-entradilla mt-5 max-w-[34ch] text-white/85">{texto(c.texto)}</p>}
          {accion && <Link href={accion.url} className="boton boton-primario mt-8">{accion.texto} <Flecha /></Link>}
        </div>
        {imgs.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {imgs.map((f, i) => (
              <Foto key={f.id} foto={f} className={`w-full rounded-2xl object-cover ${i === 2 ? 'col-span-2 aspect-[2/1]' : 'aspect-[4/3]'}`} tamanos="(max-width: 1024px) 90vw, 40vw" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
