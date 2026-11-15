import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BarraVistaPrevia } from '@/components/admin/BarraVistaPrevia';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { InicioCompleto } from '@/components/InicioCompleto';
import { Encabezado, Pie } from '@/components/Marco';
import { NosotrosCompleto } from '@/components/NosotrosCompleto';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicar } from '@/lib/admin/acciones-contenido';
import { paginaParaEditar } from '@/lib/admin/sitio';
import { comoSecciones, datosPagina, registrarVistaPrevia } from '@/lib/admin/vista-previa-sitio';
import { CATALOGO, PAGINAS_WEB, type ClavePaginaWeb } from '@/lib/catalogo-secciones';

export const metadata: Metadata = { title: 'Vista previa de página' };

/** Vista previa obligatoria de una página: la misma vista del sitio, con los cambios guardados. */
export default async function VistaPreviaPagina({ params }: { params: Promise<{ clave: string }> }) {
  await exigirSeccion('pagina-web');
  const { clave } = await params;
  if (!(clave in CATALOGO)) notFound();
  const e = await paginaParaEditar(clave as ClavePaginaWeb);
  if (!e) notFound();
  const { pagina, datos, hayCambios } = e;
  const publicado = pagina.estado === 'publicado';
  const ok = await registrarVistaPrevia('pagina', pagina.id);
  const secs = comoSecciones(datos.secciones);
  const vista = clave === 'inicio' || clave === 'nosotros' ? await datosPagina(clave, secs) : null;
  const ruta = PAGINAS_WEB.find((p) => p.clave === clave)!.ruta;

  return (
    <>
      <BarraVistaPrevia volver={`/admin/pagina-web?pagina=${clave}`} publicado={publicado} cambios={hayCambios} error={!ok}>
        {ok && (!publicado || hayCambios) && (
          <BotonAccion accion={publicar.bind(null, 'pagina', pagina.id)} className="adm-boton bg-white text-azul">{hayCambios ? 'Publicar los cambios' : 'Publicar página'}</BotonAccion>
        )}
      </BarraVistaPrevia>
      <Encabezado />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-contenido data-pagina={clave}>
        {vista?.inicio && <InicioCompleto d={vista.inicio} fotos={vista.fotos} />}
        {vista?.nosotros && <NosotrosCompleto secs={vista.nosotros.secs} inst={vista.nosotros.inst} fotos={vista.fotos} />}
        {!vista && (
          <section className="contenedor py-16">
            <p className="t-etiqueta text-azul-oscuro">Así aparecerá en buscadores y al compartir</p>
            <div className="mt-4 max-w-[640px] rounded-[16px] border border-linea p-5" data-seo-previa>
              <p className="text-[13px] text-texto-3">jiump.cl{ruta}</p>
              <p className="mt-1 text-[20px] font-semibold text-azul">{datos.seo_titulo || `${pagina.titulo} · JIUMP`}</p>
              <p className="mt-1 text-texto-2">{datos.seo_descripcion || 'Sin descripción: se usará la descripción por defecto del sitio (Configuración).'}</p>
            </div>
            <p className="mt-6 max-w-[640px] text-texto-2">
              El contenido de esta página se arma solo con lo publicado en {pagina.titulo} del panel. Aquí se publica o se retira la página completa y se edita su SEO.
            </p>
          </section>
        )}
      </main>
      <Pie />
    </>
  );
}
