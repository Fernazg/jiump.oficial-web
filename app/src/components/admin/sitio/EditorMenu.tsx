'use client';

import { AccionesPublicacion } from '@/components/admin/AccionesPublicacion';
import { guardarMenu, type ItemMenuEditable } from '@/lib/admin/acciones-sitio';
import { DESTINOS } from '@/lib/catalogo-secciones';
import { AVISOS_CONJUNTO, BarraGuardar, ErrorGuardar } from './BarraGuardar';
import { useEditorConjunto } from './useEditorConjunto';

const ID_CONJUNTO = '00000000-0000-0000-0000-000000000000';
const LUGARES: { clave: ItemMenuEditable['ubicacion']; nombre: string; ayuda: string }[] = [
  { clave: 'principal', nombre: 'Menú principal', ayuda: 'Arriba en todas las páginas (y en «Explora» del pie).' },
  { clave: 'pie', nombre: 'Enlaces extra del pie', ayuda: 'Solo en el pie de página, después del menú principal.' },
];

/** Menú principal y pie: enlaces ordenables que se pueden ocultar. */
export function EditorMenu(p: { inicial: ItemMenuEditable[]; version: string; hayCambios: boolean; previaAlDia: boolean; aviso: string | null }) {
  const e = useEditorConjunto(p.inicial, p.version, guardarMenu, '/admin/menu/vista-previa');
  const lista = e.d;
  const editar = (i: number, c: Partial<ItemMenuEditable>) => e.cambiar((xs) => xs.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const mover = (i: number, dir: -1 | 1) => e.cambiar((xs) => {
    const mismo = xs.map((x, k) => [x, k] as const).filter(([x]) => x.ubicacion === xs[i].ubicacion).map(([, k]) => k);
    const pos = mismo.indexOf(i), j = mismo[pos + dir];
    if (j === undefined) return xs;
    const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  return (
    <div className="flex flex-col gap-5" data-editor-menu data-listo={e.listo || undefined} data-version={p.version}>
      <section className="adm-caja flex flex-col gap-4 p-5 sm:p-7">
        <AccionesPublicacion tipo="menu" id={ID_CONJUNTO} titulo="Menú" publicado hayCambios={p.hayCambios} previaAlDia={p.previaAlDia} sucio={e.sucio} alVerPrevia={e.verPrevia} />
        {p.aviso && AVISOS_CONJUNTO[p.aviso] && <p role="status" className="adm-ok">{AVISOS_CONJUNTO[p.aviso]}</p>}
        <ErrorGuardar error={e.error} />
        <p className="text-[14px] text-texto-2">Los enlaces a páginas que no están publicadas no se muestran en el sitio.</p>
      </section>
      {LUGARES.map((l) => (
        <section key={l.clave} className="adm-caja flex flex-col gap-3 p-5 sm:p-7" data-lugar={l.clave}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="adm-h2">{l.nombre}</h2>
              <p className="text-[13px] text-texto-3">{l.ayuda}</p>
            </div>
            <button type="button" className="adm-boton adm-borde-azul" data-agregar-enlace={l.clave}
              onClick={() => e.cambiar((xs) => [...xs, { ubicacion: l.clave, etiqueta: '', url: '', visible: true }])}>+ Agregar enlace</button>
          </div>
          <ul className="flex flex-col gap-2">
            {lista.map((x, i) => x.ubicacion !== l.clave ? null : (
              <li key={i} className="grid items-end gap-2 rounded-[14px] bg-gris-claro/60 p-3 sm:grid-cols-[1fr_1fr_auto]" data-enlace={x.etiqueta}>
                <label className="adm-etiqueta-campo">Texto
                  <input className="adm-campo" maxLength={40} value={x.etiqueta} onChange={(ev) => editar(i, { etiqueta: ev.target.value })} />
                </label>
                <label className="adm-etiqueta-campo">Lleva a… (página del sitio o https://)
                  <input className="adm-campo" list="destinos-menu" value={x.url} placeholder="/eventos" onChange={(ev) => editar(i, { url: ev.target.value })} />
                </label>
                <div className="flex flex-wrap gap-1.5 pb-1">
                  <button type="button" className="adm-mini adm-mini-gris" aria-label={`Subir ${x.etiqueta}`} onClick={() => mover(i, -1)}>↑</button>
                  <button type="button" className="adm-mini adm-mini-gris" aria-label={`Bajar ${x.etiqueta}`} onClick={() => mover(i, 1)}>↓</button>
                  <button type="button" className={`adm-mini ${x.visible ? 'adm-mini-azul' : 'adm-mini-gris'}`} onClick={() => editar(i, { visible: !x.visible })} data-alternar-visible>
                    {x.visible ? 'Visible · ocultar' : 'Oculto · mostrar'}
                  </button>
                  <button type="button" className="adm-mini adm-mini-rojo" aria-label={`Quitar ${x.etiqueta}`} onClick={() => e.cambiar((xs) => xs.filter((_, k) => k !== i))}>×</button>
                </div>
              </li>
            ))}
          </ul>
          {!lista.some((x) => x.ubicacion === l.clave) && <p className="text-[14px] text-texto-3">Sin enlaces.</p>}
        </section>
      ))}
      <BarraGuardar sucio={e.sucio} guardando={e.guardando} guardar={e.guardar} />
      <datalist id="destinos-menu">{DESTINOS.map((x) => <option key={x.url} value={x.url}>{x.nombre}</option>)}</datalist>
    </div>
  );
}
