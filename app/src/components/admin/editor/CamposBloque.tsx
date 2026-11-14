'use client';

import { esYoutube, type TipoBloque } from '@/lib/admin/bloques';
import type { FotoBiblioteca } from './SelectorFoto';

/** Bloque en edición: los campos del modelo, sin validar todavía. */
export type BloqueEditable = { tipo: TipoBloque } & Record<string, unknown>;
type ItemPar = Record<string, string>;

const estiloArea = 'adm-campo min-h-[88px] text-[16px] leading-relaxed';

/** Campos de un bloque según su tipo (docs/modelo-datos.md). */
export function CamposBloque({ b, cambiar, alEnfocar, fotos, elegirFoto }: {
  b: BloqueEditable;
  cambiar: (campos: Record<string, unknown>) => void;
  /** Recuerda el último campo de texto enfocado (para el botón «B»). */
  alEnfocar: (el: HTMLTextAreaElement | HTMLInputElement, campo: string, item?: number) => void;
  fotos: FotoBiblioteca[];
  elegirFoto: () => void;
}) {
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const area = (k: string, etiqueta: string, filas = 3, extra = '') => (
    <label className="adm-etiqueta-campo">{etiqueta}
      <textarea className={`${estiloArea} ${extra}`} rows={filas} value={s(k)} data-campo={k}
        onFocus={(e) => alEnfocar(e.currentTarget, k)} onChange={(e) => cambiar({ [k]: e.target.value })} />
    </label>
  );
  const linea = (k: string, etiqueta: string, ph = '') => (
    <label className="adm-etiqueta-campo">{etiqueta}
      <input className="adm-campo" value={s(k)} placeholder={ph} data-campo={k} onChange={(e) => cambiar({ [k]: e.target.value })} />
    </label>
  );

  // Listas de textos (lista numerada, tarjetas)
  const items = Array.isArray(b.items) ? (b.items as unknown[]) : [];
  const listaTextos = () => (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2.5 grid size-7 shrink-0 place-items-center rounded-full bg-azul font-ui text-[13px] font-semibold text-white">{i + 1}</span>
          <textarea aria-label={`Punto ${i + 1}`} rows={2} className={`${estiloArea} min-h-[60px] flex-1`} value={String(it ?? '')}
            onFocus={(e) => alEnfocar(e.currentTarget, 'items', i)}
            onChange={(e) => cambiar({ items: items.map((x, j) => (j === i ? e.target.value : x)) })} />
          <button type="button" className="adm-mini adm-mini-gris mt-1.5" aria-label={`Quitar el punto ${i + 1}`}
            onClick={() => cambiar({ items: items.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="adm-mini adm-mini-azul self-start" onClick={() => cambiar({ items: [...items, ''] })}>+ Agregar punto</button>
    </div>
  );
  // Listas de pares (línea de tiempo, cifras)
  const listaPares = (a: string, b2: string, ea: string, eb: string) => (
    <div className="flex flex-col gap-2">
      {(items as ItemPar[]).map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] items-start gap-2">
          <input aria-label={`${ea} ${i + 1}`} className="adm-campo" placeholder={ea} value={it?.[a] ?? ''}
            onChange={(e) => cambiar({ items: items.map((x, j) => (j === i ? { ...(x as ItemPar), [a]: e.target.value } : x)) })} />
          <textarea aria-label={`${eb} ${i + 1}`} rows={2} className={`${estiloArea} min-h-[44px]`} placeholder={eb} value={it?.[b2] ?? ''}
            onFocus={(e) => alEnfocar(e.currentTarget, 'items', i)}
            onChange={(e) => cambiar({ items: items.map((x, j) => (j === i ? { ...(x as ItemPar), [b2]: e.target.value } : x)) })} />
          <button type="button" className="adm-mini adm-mini-gris mt-1" aria-label={`Quitar ${i + 1}`}
            onClick={() => cambiar({ items: items.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="adm-mini adm-mini-azul self-start" onClick={() => cambiar({ items: [...items, { [a]: '', [b2]: '' }] })}>+ Agregar</button>
    </div>
  );

  switch (b.tipo) {
    case 'parrafo': return area('texto', 'Texto', 4);
    case 'entradilla': return area('texto', 'Entradilla (primer párrafo, con letra capital)', 3, 'text-[17px]');
    case 'titulo_seccion':
      return (
        <label className="adm-etiqueta-campo">Título de la sección
          <input className="adm-campo font-titulo text-[20px] font-bold" value={s('texto')} data-campo="texto"
            onFocus={(e) => alEnfocar(e.currentTarget, 'texto')} onChange={(e) => cambiar({ texto: e.target.value })} />
        </label>
      );
    case 'pregunta_destacada': return area('texto', 'Pregunta', 2, 'font-titulo font-bold');
    case 'versiculo':
      return (
        <div className="grid gap-3 rounded-2xl bg-azul-claro p-4">
          {area('texto', 'Texto del versículo', 3)}
          <div className="grid gap-3 sm:grid-cols-2">
            {linea('referencia', 'Referencia', 'Ej.: Juan 3:16')}
            {linea('etiqueta', 'Etiqueta (opcional)', 'Ej.: Versículo clave')}
          </div>
          {!s('referencia').trim() && <p className="text-[12.5px] text-[#7a4b00]">Falta la referencia bíblica.</p>}
        </div>
      );
    case 'idea_clave': case 'para_recordar':
      return (
        <div className="grid gap-3">
          {area('texto', 'Texto', 3)}
          {linea('etiqueta', 'Etiqueta (opcional)', b.tipo === 'idea_clave' ? 'Idea clave' : 'Para recordar')}
        </div>
      );
    case 'lista_numerada': return listaTextos();
    case 'tarjetas':
      return <div className="grid gap-3">{linea('titulo', 'Título (opcional)')}{listaTextos()}</div>;
    case 'linea_tiempo': return listaPares('fecha', 'texto', 'Fecha', 'Qué pasó');
    case 'cifras': return listaPares('valor', 'texto', 'Cifra', 'Explicación');
    case 'imagen': {
      const foto = fotos.find((f) => f.id === s('foto_id'));
      return (
        <div className="grid gap-3">
          {foto ? (
            <figure className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado) */}
              <img src={foto.url} alt={foto.texto_alternativo} className="h-28 w-auto max-w-full rounded-xl object-cover" />
              <figcaption className="max-w-[40ch] text-[13px] text-texto-3">{foto.texto_alternativo}</figcaption>
            </figure>
          ) : <p className="text-[13px] text-texto-3">Aún no eliges una foto.</p>}
          <button type="button" className="adm-mini adm-mini-azul self-start" onClick={elegirFoto}>{foto ? 'Cambiar foto' : 'Elegir foto de la biblioteca'}</button>
          {linea('pie', 'Pie de foto (opcional)')}
        </div>
      );
    }
    case 'video': {
      const url = s('url').trim();
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {linea('url', 'Enlace de YouTube', 'https://www.youtube.com/watch?v=…')}
          {linea('titulo', 'Título (opcional)')}
          {url && !esYoutube(url) && <p className="text-[12.5px] text-rojo-oscuro sm:col-span-2">Solo se aceptan enlaces de YouTube que empiecen con https://</p>}
        </div>
      );
    }
    default: return null;
  }
}
