import type { ReactNode } from 'react';
import { REFERENCIA_BIBLICA } from '@/lib/biblia';
import { dosDigitos, idYoutube } from '@/lib/formato';
import type { Bloque, FotoFirmada } from '@/lib/tipos';
import { Foto } from './Basicos';

type Tono = 'azul' | 'rojo' | 'neutro';

/** Resalta referencias bíblicas dentro de un texto plano. */
function conReferencias(texto: string, clave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(REFERENCIA_BIBLICA)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push(texto.slice(ultimo, i));
    partes.push(<span key={`${clave}-${i}`} className="ref-biblica" data-ref-biblica>{m[0]}</span>);
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Texto con **negritas** y referencias bíblicas resaltadas. */
export function TextoRico({ texto }: { texto: string }) {
  const trozos = String(texto ?? '').split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {trozos.map((t, i) =>
        t.startsWith('**') && t.endsWith('**') && t.length > 4
          ? <strong key={i}>{conReferencias(t.slice(2, -2), `b${i}`)}</strong>
          : <span key={i}>{conReferencias(t, `t${i}`)}</span>,
      )}
    </>
  );
}

const anclaSeccion = (n: number) => `seccion-${n}`;

/** Títulos de sección del cuerpo, para el índice lateral «En este artículo». */
export function indiceDeBloques(bloques: Bloque[]): { id: string; numero: number; texto: string }[] {
  let n = 0;
  return bloques.flatMap((b) => (b.tipo === 'titulo_seccion' ? [{ id: anclaSeccion(++n), numero: n, texto: b.texto }] : []));
}

export function Bloques({ bloques, fotos, tono = 'azul' }: { bloques: Bloque[]; fotos: Map<string, FotoFirmada>; tono?: Tono }) {
  const acento = tono === 'rojo'
    ? { borde: 'border-rojo', texto: 'text-rojo-oscuro', fondo: 'bg-rojo', claro: 'bg-rojo-claro', numero: 'bg-rojo' }
    : { borde: 'border-azul', texto: 'text-azul-oscuro', fondo: 'bg-azul', claro: 'bg-azul-claro', numero: 'bg-azul' };
  let seccion = 0;

  return (
    <div className="t-articulo space-y-6 text-texto">
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'entradilla':
            return (
              <p key={i} className="text-[1.08em] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-titulo first-letter:text-[3.6em] first-letter:font-extrabold first-letter:leading-[0.8] first-letter:text-rojo">
                <TextoRico texto={b.texto} />
              </p>
            );
          case 'parrafo':
            return <p key={i}><TextoRico texto={b.texto} /></p>;
          case 'titulo_seccion': {
            seccion += 1;
            return (
              <h2 key={i} id={anclaSeccion(seccion)} className="scroll-mt-28 pt-6">
                <span className={`t-etiqueta flex items-center gap-3 ${acento.texto}`}>
                  {dosDigitos(seccion)} <span aria-hidden className={`h-px w-8 ${acento.fondo}`} />
                </span>
                <span className="t-h3 mt-3 block">{b.texto}</span>
              </h2>
            );
          }
          case 'pregunta_destacada':
            return <p key={i} className={`font-titulo text-[1.25em] font-bold leading-snug ${acento.texto}`}><TextoRico texto={b.texto} /></p>;
          case 'versiculo':
            return (
              <figure key={i} className={`relative rounded-2xl border-l-4 ${acento.borde} bg-azul-claro px-6 py-6 sm:px-8`}>
                <p className={`t-etiqueta ${acento.texto}`}>{b.etiqueta ? `${b.etiqueta} · ` : ''}{b.referencia}</p>
                <blockquote className="mt-3 font-titulo text-[1.15em] font-semibold leading-snug text-azul-profundo">“{b.texto}”</blockquote>
              </figure>
            );
          case 'idea_clave':
            return (
              <aside key={i} className={`border-l-4 ${acento.borde} pl-5`}>
                <p className={`t-etiqueta ${acento.texto}`}>{b.etiqueta || 'Idea clave'}</p>
                <p className="mt-2 font-semibold text-azul-profundo"><TextoRico texto={b.texto} /></p>
              </aside>
            );
          case 'para_recordar':
            return (
              <aside key={i} className={`rounded-2xl ${acento.fondo} px-6 py-7 text-white sm:px-8`}>
                <span aria-hidden className="mb-3 block h-px w-8 bg-white/70" />
                <p className="t-etiqueta text-white/90">{b.etiqueta || 'Para recordar'}</p>
                <p className="mt-2 font-semibold"><TextoRico texto={b.texto} /></p>
              </aside>
            );
          case 'lista_numerada':
            return (
              <ol key={i} className="space-y-3">
                {b.items.map((t, j) => (
                  <li key={j} className="flex gap-3">
                    <span className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full ${acento.numero} font-ui text-[13px] font-semibold text-white`}>{j + 1}</span>
                    <span><TextoRico texto={t} /></span>
                  </li>
                ))}
              </ol>
            );
          case 'tarjetas':
            return (
              <div key={i}>
                {b.titulo && <p className="t-h4 mb-4">{b.titulo}</p>}
                <ol className="grid gap-3 sm:grid-cols-2">
                  {b.items.map((t, j) => (
                    <li key={j} className={`flex gap-3 rounded-2xl ${acento.claro} p-4 font-semibold leading-snug`}>
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${acento.numero} font-ui text-[13px] text-white`}>{j + 1}</span>
                      <span><TextoRico texto={t} /></span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          case 'linea_tiempo':
            return (
              <ol key={i} className={`relative space-y-5 border-l-2 ${acento.borde} pl-6`}>
                {b.items.map((it, j) => (
                  <li key={j} className="relative">
                    <span aria-hidden className={`absolute -left-[31px] top-2 size-3 rounded-full ${acento.fondo}`} />
                    <p className={`t-meta ${acento.texto}`}>{it.fecha}</p>
                    <p><TextoRico texto={it.texto} /></p>
                  </li>
                ))}
              </ol>
            );
          case 'cifras':
            return (
              <dl key={i} className="grid gap-4 sm:grid-cols-3">
                {b.items.map((it, j) => (
                  <div key={j} className="rounded-2xl bg-gris-claro p-5">
                    <dt className={`font-titulo text-[1.6em] font-extrabold leading-none ${acento.texto}`}>{it.valor}</dt>
                    <dd className="mt-2 text-[0.85em] leading-snug text-texto-2">{it.texto}</dd>
                  </div>
                ))}
              </dl>
            );
          case 'imagen': {
            const f = fotos.get(b.foto_id);
            if (!f) return null; // foto no publicada o eliminada: no se muestra
            return (
              <figure key={i}>
                <Foto foto={f} className="w-full rounded-2xl" tamanos="(max-width: 1024px) 100vw, 720px" />
                {b.pie && <figcaption className="t-meta mt-2 text-texto-2">{b.pie}</figcaption>}
              </figure>
            );
          }
          case 'video': {
            const id = idYoutube(b.url);
            if (!id) return null;
            return (
              <div key={i} className="aspect-video overflow-hidden rounded-2xl bg-azul-profundo">
                <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={b.titulo || 'Video'}
                  loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            );
          }
          default:
            return null; // tipo desconocido: no se inventa nada
        }
      })}
    </div>
  );
}
