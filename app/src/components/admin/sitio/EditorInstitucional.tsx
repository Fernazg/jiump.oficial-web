'use client';

import { AccionesPublicacion } from '@/components/admin/AccionesPublicacion';
import { guardarInstitucional, type ItemInstitucional } from '@/lib/admin/acciones-sitio';
import { AVISOS_CONJUNTO, BarraGuardar, ErrorGuardar } from './BarraGuardar';
import { useEditorConjunto } from './useEditorConjunto';

const ID_CONJUNTO = '00000000-0000-0000-0000-000000000000';
type TipoInst = ItemInstitucional['tipo'];

const UNICOS: { tipo: TipoInst; nombre: string; ayuda: string }[] = [
  { tipo: 'identidad', nombre: 'Identidad', ayuda: 'Quiénes son, en una frase y un párrafo. Se ve en Nosotros.' },
  { tipo: 'quienes_somos', nombre: '«Quiénes somos»', ayuda: 'Texto principal de Nosotros.' },
  { tipo: 'vision', nombre: 'Visión', ayuda: 'Se ve en Nosotros, junto a la historia.' },
  { tipo: 'historia', nombre: 'Historia', ayuda: 'Se ve en Nosotros.' },
];
const LISTAS: { tipo: TipoInst; nombre: string; ayuda: string; titulo: string; texto: string; max: number }[] = [
  { tipo: 'declaracion_fe', nombre: 'Declaraciones de fe', ayuda: 'Se ven en «Qué creemos», en Nosotros.', titulo: 'Título', texto: 'Texto (con su cita bíblica, si la tiene)', max: 12 },
  { tipo: 'cifra', nombre: 'Cifras', ayuda: 'Se ven en Inicio y en Nosotros.', titulo: 'Valor (ej.: +2.000)', texto: 'Qué cuenta (ej.: jóvenes en convenciones)', max: 6 },
];

/**
 * Textos oficiales de JIUMP (solo Superadmin). Se copian tal como los entrega
 * JIUMP: el panel no propone textos. Los campos vacíos no se guardan.
 */
export function EditorInstitucional(p: { inicial: ItemInstitucional[]; version: string; hayCambios: boolean; previaAlDia: boolean; aviso: string | null }) {
  // Cada texto único tiene su lugar aunque esté vacío.
  const base = [...p.inicial];
  for (const u of UNICOS) if (!base.some((x) => x.tipo === u.tipo)) base.push({ tipo: u.tipo, titulo: '', texto: '' });
  const e = useEditorConjunto(base, p.version, guardarInstitucional, '/admin/institucional/vista-previa');
  const editar = (i: number, c: Partial<ItemInstitucional>) => e.cambiar((xs) => xs.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const vacios = e.d.every((x) => !x.titulo.trim() && !x.texto.trim());

  return (
    <div className="flex flex-col gap-5" data-editor-institucional data-listo={e.listo || undefined} data-version={p.version}>
      <section className="adm-caja flex flex-col gap-4 p-5 sm:p-7">
        <AccionesPublicacion tipo="institucional" id={ID_CONJUNTO} titulo="Información institucional" publicado hayCambios={p.hayCambios}
          previaAlDia={p.previaAlDia} sucio={e.sucio} alVerPrevia={e.verPrevia} />
        {p.aviso && AVISOS_CONJUNTO[p.aviso] && <p role="status" className="adm-ok">{AVISOS_CONJUNTO[p.aviso]}</p>}
        <ErrorGuardar error={e.error} />
        <p className="adm-aviso">Copia los textos oficiales tal como los entrega JIUMP, sin cambiarlos. Mientras un campo esté vacío, el sitio no muestra ese bloque{vacios ? ' (hoy están todos vacíos)' : ''}.</p>
      </section>

      <section className="adm-caja flex flex-col gap-5 p-5 sm:p-7">
        {UNICOS.map((u) => {
          const i = e.d.findIndex((x) => x.tipo === u.tipo);
          const x = e.d[i];
          return (
            <fieldset key={u.tipo} className="flex flex-col gap-3" data-texto-institucional={u.tipo}>
              <legend className="adm-h2">{u.nombre}</legend>
              <p className="-mt-1 text-[13px] text-texto-3">{u.ayuda}</p>
              <label className="adm-etiqueta-campo">Título · {x.titulo.length}/200
                <input className="adm-campo" name={`${u.tipo}-titulo`} maxLength={200} value={x.titulo} onChange={(ev) => editar(i, { titulo: ev.target.value })} />
              </label>
              <label className="adm-etiqueta-campo">Texto
                <textarea className="adm-campo" name={`${u.tipo}-texto`} rows={4} maxLength={5000} value={x.texto} onChange={(ev) => editar(i, { texto: ev.target.value })} />
              </label>
            </fieldset>
          );
        })}
      </section>

      {LISTAS.map((l) => {
        const filas = e.d.map((x, i) => [x, i] as const).filter(([x]) => x.tipo === l.tipo);
        return (
          <section key={l.tipo} className="adm-caja flex flex-col gap-3 p-5 sm:p-7" data-lista-institucional={l.tipo}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="adm-h2">{l.nombre} ({filas.length})</h2>
                <p className="text-[13px] text-texto-3">{l.ayuda}</p>
              </div>
              {filas.length < l.max && (
                <button type="button" className="adm-boton adm-borde-azul" data-agregar={l.tipo}
                  onClick={() => e.cambiar((xs) => [...xs, { tipo: l.tipo, titulo: '', texto: '' }])}>+ Agregar</button>
              )}
            </div>
            {filas.length === 0 && <p className="text-[14px] text-texto-3">Aún no hay. Se agregan cuando JIUMP entregue los textos.</p>}
            {filas.map(([x, i], n) => (
              <div key={i} className="grid items-end gap-2 rounded-[14px] bg-gris-claro/60 p-3 sm:grid-cols-[1fr_2fr_auto]" data-item={n}>
                <label className="adm-etiqueta-campo">{l.titulo}
                  <input className="adm-campo" maxLength={200} value={x.titulo} onChange={(ev) => editar(i, { titulo: ev.target.value })} />
                </label>
                <label className="adm-etiqueta-campo">{l.texto}
                  <textarea className="adm-campo" rows={2} maxLength={5000} value={x.texto} onChange={(ev) => editar(i, { texto: ev.target.value })} />
                </label>
                <div className="flex gap-1.5 pb-1">
                  <button type="button" className="adm-mini adm-mini-gris" aria-label="Subir" disabled={n === 0}
                    onClick={() => e.cambiar((xs) => { const c = [...xs]; const j = filas[n - 1][1]; [c[i], c[j]] = [c[j], c[i]]; return c; })}>↑</button>
                  <button type="button" className="adm-mini adm-mini-gris" aria-label="Bajar" disabled={n === filas.length - 1}
                    onClick={() => e.cambiar((xs) => { const c = [...xs]; const j = filas[n + 1][1]; [c[i], c[j]] = [c[j], c[i]]; return c; })}>↓</button>
                  <button type="button" className="adm-mini adm-mini-rojo" aria-label="Quitar" onClick={() => e.cambiar((xs) => xs.filter((_, k) => k !== i))}>×</button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      <BarraGuardar sucio={e.sucio} guardando={e.guardando} guardar={e.guardar} />
    </div>
  );
}
