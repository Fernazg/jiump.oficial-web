import type { Metadata } from 'next';
import Link from 'next/link';
import { Confirmar } from '@/components/admin/Confirmar';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { exigirSeccion } from '@/lib/admin/acceso';
import { borrarSerie, borrarTema, guardarSerie, guardarTema } from '@/lib/admin/acciones-series';
import { nombreSerie, seriesYTemas } from '@/lib/admin/articulos';
import { MESES, mayuscula } from '@/lib/formato';
import type { Serie } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Series y categorías' };

const AVISOS: Record<string, string> = {
  'serie-creada': 'Serie creada.', 'serie-editada': 'Serie guardada.', 'serie-borrada': 'Serie borrada.',
  'tema-creado': 'Tema creado.', 'tema-editado': 'Tema guardado.', 'tema-borrado': 'Tema borrado.',
};

function CamposSerie({ s }: { s?: Serie }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <label className="adm-etiqueta-campo sm:col-span-2">Nombre
        <input className="adm-campo" name="nombre" defaultValue={s?.nombre} required maxLength={120} />
      </label>
      <label className="adm-etiqueta-campo">Tipo
        <select className="adm-campo" name="tipo" defaultValue={s?.tipo ?? 'tematica'}>
          <option value="tematica">Temática</option>
          <option value="mes">Serie del mes</option>
        </select>
      </label>
      <label className="adm-etiqueta-campo">Mes (solo serie del mes)
        <select className="adm-campo" name="mes" defaultValue={s?.mes ?? ''}>
          <option value="">—</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{mayuscula(m)}</option>)}
        </select>
      </label>
      <label className="adm-etiqueta-campo">Color
        <select className="adm-campo" name="color" defaultValue={s?.color ?? 'neutro'}>
          <option value="azul">Azul Palabra</option>
          <option value="rojo">Rojo antorcha</option>
          <option value="neutro">Neutro</option>
        </select>
      </label>
      <label className="adm-etiqueta-campo">Orden
        <input className="adm-campo" name="orden" type="number" defaultValue={s?.orden ?? 0} />
      </label>
      <label className="adm-etiqueta-campo sm:col-span-2">Descripción (opcional)
        <textarea className="adm-campo" name="descripcion" rows={2} defaultValue={s?.descripcion ?? ''} maxLength={600} />
      </label>
    </>
  );
}

export default async function Series({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('series');
  const { aviso } = await searchParams;
  const { series, temas } = await seriesYTemas();

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/articulos" className="text-[14px] font-semibold text-azul">← Artículos</Link>
        <h1 className="adm-h1">Series y categorías</h1>
        <span className="text-[15px] text-texto-3">Organiza los artículos en series (con sus partes) y temas.</span>
      </div>
      {aviso && AVISOS[aviso] && <p role="status" className="adm-ok">{AVISOS[aviso]}</p>}

      <div className="flex flex-wrap items-start gap-6">
        <section className="adm-caja flex min-w-0 flex-[3_1_520px] flex-col gap-3 p-6" aria-labelledby="t-series">
          <h2 id="t-series" className="adm-h2">Series</h2>
          <p className="rounded-[10px] bg-gris-claro p-2.5 text-[13px] text-texto-3">
            Una serie con artículos no se puede borrar: primero hay que moverlos a otra (también los de la papelera).
          </p>
          <ul className="divide-y divide-[#e7e9ec]" data-lista-series>
            {series.map((s) => (
              <li key={s.id} data-serie={s.slug} className="py-2">
                <details>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[14px]">
                    <span>
                      {s.color !== 'neutro' && <span aria-hidden className={`mr-2 inline-block size-2.5 rounded-full ${s.color === 'rojo' ? 'bg-rojo' : 'bg-azul'}`} />}
                      <strong>{nombreSerie(s)}</strong>
                    </span>
                    <span className="flex items-center gap-3 text-texto-3">
                      {s.total} {s.total === 1 ? 'artículo' : 'artículos'} <span className="adm-mini adm-mini-azul">Editar</span>
                    </span>
                  </summary>
                  <Formulario accion={guardarSerie} className="mt-2 grid gap-3 rounded-2xl bg-gris-claro p-4 sm:grid-cols-2">
                    <CamposSerie s={s} />
                    <div className="flex flex-wrap gap-2 sm:col-span-2"><BotonEnviar>Guardar serie</BotonEnviar></div>
                  </Formulario>
                  <div className="mt-2">
                    {s.total > 0 ? (
                      <p className="text-[13px] text-texto-3">No se puede borrar: tiene {s.total} {s.total === 1 ? 'artículo' : 'artículos'}.</p>
                    ) : (
                      <Confirmar boton="Borrar serie" titulo={`¿Borrar la serie «${s.nombre}»?`} accion={borrarSerie.bind(null, s.id)} confirmar="Sí, borrar">
                        La serie no tiene artículos. Esta acción no se puede deshacer.
                      </Confirmar>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details className="rounded-2xl border border-dashed border-[#9aa1a8] p-4">
            <summary className="cursor-pointer font-ui text-[14px] font-semibold text-azul">+ Agregar serie</summary>
            <Formulario accion={guardarSerie} className="mt-3 grid gap-3 sm:grid-cols-2">
              <CamposSerie />
              <div className="sm:col-span-2"><BotonEnviar>Crear serie</BotonEnviar></div>
            </Formulario>
          </details>
        </section>

        <section className="adm-caja flex min-w-0 flex-[2_1_300px] flex-col gap-3 p-6" aria-labelledby="t-temas">
          <h2 id="t-temas" className="adm-h2">Temas</h2>
          <p className="text-[13px] text-texto-3">Borrar un tema no borra artículos: solo deja de estar asociado.</p>
          <ul className="divide-y divide-[#e7e9ec]" data-lista-temas>
            {temas.map((t) => (
              <li key={t.id} data-tema={t.slug} className="flex flex-wrap items-center gap-2 py-2">
                <Formulario accion={guardarTema} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <label className="sr-only" htmlFor={`tema-${t.id}`}>Nombre del tema</label>
                  <input id={`tema-${t.id}`} className="adm-campo min-w-0 flex-1" name="nombre" defaultValue={t.nombre} required />
                  <BotonEnviar className="adm-mini adm-mini-azul">Guardar</BotonEnviar>
                </Formulario>
                <span className="text-[13px] text-texto-3">{t.total}</span>
                <Confirmar boton="Borrar" etiqueta={`Borrar tema ${t.nombre}`} titulo={`¿Borrar el tema «${t.nombre}»?`}
                  accion={borrarTema.bind(null, t.id)} confirmar="Sí, borrar">
                  {t.total > 0 ? `Lo usan ${t.total} ${t.total === 1 ? 'artículo' : 'artículos'}: ` : ''}los artículos no se borran, solo dejan de tener este tema.
                </Confirmar>
              </li>
            ))}
          </ul>
          <Formulario accion={guardarTema} className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="tema-nuevo">Nuevo tema</label>
            <input id="tema-nuevo" className="adm-campo flex-1" name="nombre" placeholder="Nuevo tema" required />
            <BotonEnviar className="adm-boton adm-borde-azul">+ Agregar tema</BotonEnviar>
          </Formulario>
        </section>
      </div>
    </>
  );
}
