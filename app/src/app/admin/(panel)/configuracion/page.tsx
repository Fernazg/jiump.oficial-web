import type { Metadata } from 'next';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Confirmar } from '@/components/admin/Confirmar';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { FotoConfiguracion } from '@/components/admin/sitio/FotoConfiguracion';
import { exigirSeccion } from '@/lib/admin/acceso';
import { agregarRedireccion, cambiarMantenimiento, eliminarRedireccion, guardarConfiguracion } from '@/lib/admin/acciones-configuracion';
import { catalogoFotos } from '@/lib/admin/galerias';
import { clientePanel } from '@/lib/admin/supabase-panel';
import { Ayuda } from '@/components/admin/Ayuda';

export const metadata: Metadata = { title: 'Configuración' };

const AVISOS: Record<string, string> = {
  'mantenimiento-on': 'Modo mantenimiento activado: el sitio público muestra la página de mantenimiento. El panel sigue funcionando.',
  'mantenimiento-off': 'Modo mantenimiento desactivado: el sitio vuelve a verse normal.',
  redireccion: 'Redirección agregada.',
  'redireccion-eliminada': 'Redirección eliminada.',
};

type Conf = {
  modo_mantenimiento: boolean; instagram_url: string | null; mostrar_barra_proximo_evento: boolean;
  seo_titulo: string | null; seo_descripcion: string | null; seo_foto_id: string | null; mantenimiento_foto_id: string | null;
};

/** Configuración del sitio (solo Superadmin). */
export default async function Configuracion({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('configuracion');
  const supabase = await clientePanel();
  const [{ aviso }, { data: conf }, { data: redirecciones }, catalogo] = await Promise.all([
    searchParams,
    supabase.from('configuracion').select('modo_mantenimiento, instagram_url, mostrar_barra_proximo_evento, seo_titulo, seo_descripcion, seo_foto_id, mantenimiento_foto_id').maybeSingle(),
    supabase.from('redirecciones').select('id, origen, destino, codigo').order('origen'),
    catalogoFotos(),
  ]);
  const c = conf as Conf;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="adm-h1">Configuración</h1>
        <span className="text-[15px] text-texto-3">Ajustes generales del sitio. Solo el Superadministrador ve esta sección.</span>
        <Ayuda>
          <ul>
            <li>«Modo mantenimiento» reemplaza todo el sitio por la página de mantenimiento. El panel sigue funcionando para poder desactivarlo.</li>
            <li>Las redirecciones llevan una dirección antigua (por ejemplo, del sitio anterior en Wix) a su página nueva.</li>
            <li>El título y la descripción para buscadores se usan en las páginas que no tienen los suyos.</li>
          </ul>
        </Ayuda>
      </div>
      {aviso && AVISOS[aviso] && <p role="status" className="adm-ok">{AVISOS[aviso]}</p>}

      <section className={`adm-caja flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7 ${c.modo_mantenimiento ? 'shadow-[inset_0_0_0_2px_var(--color-rojo)]' : ''}`}
        data-mantenimiento={c.modo_mantenimiento ? 'activo' : 'inactivo'}>
        <div>
          <h2 className="adm-h2">Modo mantenimiento {c.modo_mantenimiento ? <span className="adm-chip ml-1 bg-rojo-claro text-rojo-oscuro">Activo</span> : <span className="adm-chip ml-1 bg-[#eef0f2] text-texto-2">Apagado</span>}</h2>
          <p className="mt-1 max-w-[60ch] text-[14px] text-texto-2">Mientras está activo, todas las páginas del sitio muestran «Estamos mejorando nuestro sitio» (con la foto y el Instagram de abajo). El panel sigue funcionando.</p>
        </div>
        {c.modo_mantenimiento ? (
          <BotonAccion accion={cambiarMantenimiento.bind(null, false)} data-apagar-mantenimiento>Desactivar mantenimiento</BotonAccion>
        ) : (
          <Confirmar boton="Activar mantenimiento" claseBoton="adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)]"
            titulo="¿Activar el modo mantenimiento?" confirmar="Sí, activar" accion={cambiarMantenimiento.bind(null, true)}>
            Nadie podrá ver el sitio hasta que lo desactives. Úsalo solo durante trabajos o emergencias.
          </Confirmar>
        )}
      </section>

      <section className="adm-caja p-5 sm:p-7">
        <Formulario accion={guardarConfiguracion} className="flex flex-col gap-5" id="configuracion">
          <h2 className="adm-h2">Redes y avisos</h2>
          <label className="adm-etiqueta-campo">Enlace de Instagram
            <input className="adm-campo" name="instagram_url" defaultValue={c.instagram_url ?? ''} placeholder="https://www.instagram.com/…" />
          </label>
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" name="mostrar_barra_proximo_evento" defaultChecked={c.mostrar_barra_proximo_evento} className="mt-1 size-4" />
            <span>Mostrar la barra «Próximo evento» arriba en Inicio
              <span className="block text-[13px] text-texto-3">Aparece solo si hay una actividad marcada como «Próximo evento» (en Eventos y actividades).</span>
            </span>
          </label>
          <FotoConfiguracion nombre="mantenimiento_foto_id" titulo="Foto de la página de mantenimiento" ayuda="Opcional. Sin foto se muestra un recuadro azul." inicial={c.mantenimiento_foto_id} catalogo={catalogo} />

          <h2 className="adm-h2 mt-2">Buscadores y redes (SEO por defecto)</h2>
          <p className="-mt-3 text-[14px] text-texto-2">Se usan en las páginas que no tienen los suyos (cada página se edita en «Administrar página web»).</p>
          <label className="adm-etiqueta-campo">Título del sitio
            <input className="adm-campo" name="seo_titulo" maxLength={70} defaultValue={c.seo_titulo ?? ''} />
          </label>
          <label className="adm-etiqueta-campo">Descripción del sitio
            <textarea className="adm-campo" name="seo_descripcion" rows={2} maxLength={170} defaultValue={c.seo_descripcion ?? ''} />
          </label>
          <FotoConfiguracion nombre="seo_foto_id" titulo="Foto al compartir en redes" ayuda="Se ve al compartir un enlace del sitio en WhatsApp o redes." inicial={c.seo_foto_id} catalogo={catalogo} />
          <div><BotonEnviar pendiente="Guardando…">Guardar configuración</BotonEnviar></div>
        </Formulario>
      </section>

      <section id="redirecciones" className="adm-caja flex flex-col gap-4 p-5 sm:p-7" data-redirecciones>
        <div>
          <h2 className="adm-h2">Redirecciones desde el sitio anterior (Wix)</h2>
          <p className="mt-1 text-[14px] text-texto-2">Para que los enlaces antiguos sigan funcionando: quien entre a la dirección antigua llega a la nueva (redirección permanente 301).</p>
        </div>
        <Formulario accion={agregarRedireccion} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" id="nueva-redireccion">
          <label className="adm-etiqueta-campo">Dirección antigua
            <input className="adm-campo" name="origen" placeholder="/post/nombre-del-articulo" required />
          </label>
          <label className="adm-etiqueta-campo">Lleva a…
            <input className="adm-campo" name="destino" placeholder="/articulos/nombre-del-articulo" required />
          </label>
          <BotonEnviar pendiente="Agregando…">Agregar</BotonEnviar>
        </Formulario>
        <ul className="flex flex-col" data-lista-redirecciones>
          {((redirecciones ?? []) as { id: string; origen: string; destino: string }[]).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-linea py-2.5 text-[14px]" data-redireccion={r.origen}>
              <span className="break-all"><code>{r.origen}</code> → <code>{r.destino}</code></span>
              <Confirmar boton="×" etiqueta={`Eliminar redirección ${r.origen}`} titulo="¿Eliminar esta redirección?" accion={eliminarRedireccion.bind(null, r.id)}>
                La dirección antigua <code>{r.origen}</code> dejará de llevar a la nueva.
              </Confirmar>
            </li>
          ))}
        </ul>
        {(redirecciones ?? []).length === 0 && <p className="text-[14px] text-texto-3">Aún no hay redirecciones.</p>}
      </section>
    </>
  );
}
