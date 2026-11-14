import type { Metadata } from 'next';
import Link from 'next/link';
import { Confirmar } from '@/components/admin/Confirmar';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { SubidorBiblioteca } from '@/components/admin/fotos/SubidorBiblioteca';
import { SelectorAuto } from '@/components/admin/SelectorAuto';
import { exigirSeccion } from '@/lib/admin/acceso';
import { editarFoto, eliminarFoto } from '@/lib/admin/acciones-fotos';
import { firmarMiniaturas, listarFotos } from '@/lib/admin/fotos';
import { fechaChile } from '@/lib/admin/hora-chile';
import { puedeEntrar } from '@/lib/admin/secciones';
import { clientePanel } from '@/lib/admin/supabase-panel';

export const metadata: Metadata = { title: 'Biblioteca de fotos' };

type Props = { searchParams: Promise<{ q?: string; filtro?: string; album?: string; foto?: string; aviso?: string }> };

const FILTROS = [
  { clave: '', nombre: 'Todas' },
  { clave: 'mias', nombre: 'Subidas por mí' },
  { clave: 'en-uso', nombre: 'En uso' },
  { clave: 'sin-uso', nombre: 'Sin usar' },
];

export default async function Fotos({ searchParams }: Props) {
  const acceso = await exigirSeccion('fotos');
  const f = await searchParams;
  const filtro = FILTROS.some((x) => x.clave === f.filtro) ? f.filtro : undefined;
  const fotos = await listarFotos(acceso, { q: f.q, filtro, album: f.album });
  const supabase = await clientePanel();
  const { data: albumes } = await supabase.from('albumes').select('id, titulo').order('orden');
  const elegida = fotos.find((x) => x.id === f.foto) ?? null;
  const grande = elegida ? (await firmarMiniaturas(supabase, [elegida], 960)).get(elegida.archivo) : undefined;

  const enlace = (c: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: f.q, filtro, album: f.album, ...c })) if (v) p.set(k, v);
    return `/admin/fotos${p.size ? `?${p}` : ''}`;
  };
  const volver = enlace({});

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="adm-h1">Biblioteca de fotos</h1>
          <span className="text-[15px] text-texto-3">Todas las fotos de JIUMP en un solo lugar. Solo fotos reales de JIUMP, sin retocar.</span>
        </div>
        {puedeEntrar('galerias', acceso.efectivos) && (
          <Link href="/admin/galerias?nuevo=1" className="adm-boton adm-primario min-h-[46px] px-[22px] text-[15px]">+ Nuevo álbum</Link>
        )}
      </div>
      {f.aviso === 'foto-eliminada' && <p role="status" className="adm-ok">Foto eliminada de la biblioteca.</p>}

      <SubidorBiblioteca />

      <form action="/admin/fotos" role="search" className="flex flex-wrap items-center gap-2.5">
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
        <nav aria-label="Filtrar fotos" className="flex flex-wrap gap-2">
          {FILTROS.map((x) => (
            <Link key={x.clave} href={enlace({ filtro: x.clave || undefined, foto: undefined })} aria-current={(filtro ?? '') === x.clave ? 'true' : undefined} className="adm-filtro">
              {x.nombre}
            </Link>
          ))}
        </nav>
        <SelectorAuto name="album" etiqueta="Álbum" defaultValue={f.album}>
          <option value="">Todos</option>
          {((albumes ?? []) as { id: string; titulo: string }[]).map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
        </SelectorAuto>
        <label className="ml-auto flex min-h-11 w-full items-center gap-2 rounded-full border border-[#cdd1d6] bg-white px-4 sm:w-[300px]">
          <span aria-hidden className="text-texto-3">⌕</span>
          <span className="sr-only">Buscar fotos</span>
          <input type="search" name="q" defaultValue={f.q} placeholder="Buscar por descripción o crédito…" className="w-full bg-transparent text-[14px] outline-none" />
        </label>
      </form>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Fotos" className="min-w-0 flex-[3_1_480px]">
          <p className="mb-3 text-[13px] text-texto-3">{fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}</p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3" data-lista-fotos>
            {fotos.map((x) => (
              <li key={x.id}>
                <Link href={enlace({ foto: x.id })} scroll={false} data-foto={x.id} aria-current={elegida?.id === x.id ? 'true' : undefined}
                  className={`block overflow-hidden rounded-[14px] bg-white ${elegida?.id === x.id ? 'ring-[3px] ring-azul' : 'ring-1 ring-[#e1e3e6]'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado) */}
                  <img src={x.url} alt={x.texto_alternativo} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  <span className="flex items-center justify-between gap-2 px-2.5 py-2 text-[12px] text-texto-3">
                    <span className="truncate">{x.album?.titulo ?? x.actividad?.titulo ?? 'Sin evento'}</span>
                    {x.usos.length > 0 ? <span className="shrink-0 font-semibold text-[#00665f]">En uso</span> : <span className="shrink-0">Sin usar</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {fotos.length === 0 && <p className="adm-caja p-8 text-center text-texto-3">No hay fotos que coincidan.</p>}
        </section>

        <aside className="adm-caja flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 p-5 lg:sticky lg:top-6" aria-label="Detalle de la foto" data-detalle-foto>
          {!elegida ? (
            <p className="py-6 text-center text-[14px] text-texto-3">Elige una foto para ver sus datos y dónde se usa.</p>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado) */}
              <img src={grande ?? elegida.url} alt={elegida.texto_alternativo} className="max-h-[260px] w-full rounded-xl bg-gris-claro object-contain" />
              <p className="text-[12.5px] text-texto-3">
                {elegida.ancho && elegida.alto ? `${elegida.ancho} × ${elegida.alto} px · ` : ''}subida el {fechaChile(elegida.creado_en)}
                {elegida.propia ? ' · por ti' : ''}{elegida.anchos.length ? ` · ${elegida.anchos.length} versiones optimizadas` : ''}
              </p>
              {elegida.gestionable ? (
                <Formulario accion={editarFoto} className="flex flex-col gap-3" key={elegida.id}>
                  <input type="hidden" name="id" value={elegida.id} />
                  <label className="adm-etiqueta-campo">Texto alternativo (obligatorio, para accesibilidad)
                    <textarea className="adm-campo" name="texto_alternativo" rows={3} required maxLength={300} defaultValue={elegida.texto_alternativo} />
                  </label>
                  <label className="adm-etiqueta-campo">Crédito (opcional)
                    <input className="adm-campo" name="credito" maxLength={120} defaultValue={elegida.credito ?? ''} />
                  </label>
                  <BotonEnviar className="adm-boton adm-primario self-start">Guardar</BotonEnviar>
                </Formulario>
              ) : (
                <div className="flex flex-col gap-1.5 text-[14px]">
                  <p><strong>Texto alternativo:</strong> {elegida.texto_alternativo}</p>
                  {elegida.credito && <p><strong>Crédito:</strong> {elegida.credito}</p>}
                  <p className="rounded-[10px] bg-gris-claro p-2.5 text-[12.5px] text-texto-3" data-solo-lectura>
                    Puedes usar esta foto, pero solo quien la subió, Multimedia o Superadministrador pueden editarla o eliminarla.
                  </p>
                </div>
              )}
              <div className="rounded-[10px] bg-gris-claro p-3 text-[13px]" data-usos>
                <strong>Se usa en:</strong>{' '}
                {elegida.usos.length === 0 ? 'ningún contenido todavía.' : (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {elegida.usos.map((u, i) => (
                      <li key={i}>
                        {u.tipo}{u.titulo ? ': ' : ''}
                        {u.titulo && (u.enlace ? <Link href={u.enlace} className="enlace font-normal">{u.titulo}</Link> : <span>{u.titulo}</span>)}
                        {!u.titulo && ' (contenido de otra sección)'}
                        {u.publicado ? ' · publicado' : ' · sin publicar'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {elegida.gestionable && (
                <Confirmar boton="Eliminar foto" claseBoton="adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)] self-start"
                  titulo="¿Eliminar esta foto de la biblioteca?" accion={eliminarFoto.bind(null, elegida.id, volver)}>
                  {elegida.usos.length > 0 ? (
                    <span data-aviso-en-uso>
                      <strong className="text-rojo-oscuro">Esta foto está en uso</strong> en {elegida.usos.length === 1 ? 'un contenido' : `${elegida.usos.length} contenidos`}
                      {' '}({elegida.usos.map((u) => u.titulo ?? u.tipo).join(', ')}). Si la eliminas, dejará de verse ahí y esas portadas quedarán sin foto. Mejor elige otra foto antes.
                    </span>
                  ) : 'No se usa en ningún contenido. Se borra el archivo original y sus versiones optimizadas; no se puede deshacer.'}
                </Confirmar>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
