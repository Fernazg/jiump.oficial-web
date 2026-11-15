import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSeccion } from '@/lib/admin/acceso';
import { fechaHoraChile } from '@/lib/admin/hora-chile';
import { ACCIONES, describir, leerRegistro, POR_PAGINA, TABLAS, type FiltrosRegistro } from '@/lib/admin/registro';

export const metadata: Metadata = { title: 'Registro de actividad' };

/** Quién hizo qué y cuándo. Solo lectura: lo escriben triggers de la base. */
export default async function Registro({ searchParams }: { searchParams: Promise<FiltrosRegistro> }) {
  await exigirSeccion('registro');
  const f = await searchParams;
  const { filas, total, pagina, personas } = await leerRegistro(f);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enlace = (n: number) => `/admin/registro?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), pagina: String(n) })}`;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="adm-h1">Registro de actividad</h1>
        <span className="text-[15px] text-texto-3">Quién hizo qué y cuándo. Solo lectura: nadie puede editarlo ni borrarlo desde el panel.</span>
      </div>
      <form className="adm-caja grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end" data-filtros-registro>
        <label className="adm-etiqueta-campo">Persona
          <select className="adm-campo" name="persona" defaultValue={f.persona ?? ''}>
            <option value="">Todas</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre || p.correo}</option>)}
          </select>
        </label>
        <label className="adm-etiqueta-campo">Acción
          <select className="adm-campo" name="accion" defaultValue={f.accion ?? ''}>
            <option value="">Todas</option>
            {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="adm-etiqueta-campo">Qué
          <select className="adm-campo" name="tabla" defaultValue={f.tabla ?? ''}>
            <option value="">Todo</option>
            {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="adm-etiqueta-campo">Desde
          <input className="adm-campo" type="date" name="desde" defaultValue={f.desde ?? ''} />
        </label>
        <label className="adm-etiqueta-campo">Hasta
          <input className="adm-campo" type="date" name="hasta" defaultValue={f.hasta ?? ''} />
        </label>
        <div className="flex gap-2">
          <button className="adm-boton adm-primario">Filtrar</button>
          <Link href="/admin/registro" className="adm-boton adm-secundario">Limpiar</Link>
        </div>
      </form>
      <section className="adm-caja p-5 sm:p-7">
        <p className="mb-2 text-[13px] text-texto-3">{total} {total === 1 ? 'registro' : 'registros'}</p>
        <ul className="flex flex-col" data-lista-registro>
          {filas.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-linea py-3 text-[14px]" data-registro={r.accion}>
              <span><strong>{r.perfiles?.nombre || r.perfiles?.correo || 'Sistema'}</strong> {describir(r)}</span>
              <time dateTime={r.fecha} className="text-texto-3">{fechaHoraChile(r.fecha)}</time>
            </li>
          ))}
        </ul>
        {filas.length === 0 && <p className="py-6 text-center text-texto-3">No hay registros con esos filtros.</p>}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3 text-[14px]">
            {pagina > 1 ? <Link className="adm-boton adm-secundario" href={enlace(pagina - 1)}>← Más recientes</Link> : <span />}
            <span className="text-texto-3">Página {pagina} de {paginas}</span>
            {pagina < paginas ? <Link className="adm-boton adm-secundario" href={enlace(pagina + 1)}>Anteriores →</Link> : <span />}
          </nav>
        )}
      </section>
    </>
  );
}
