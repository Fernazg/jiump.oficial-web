import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { fotosDeInicio, InicioCompleto } from '@/components/InicioCompleto';
import { actividades, albumes, articulos, configuracion, firmarFotos, institucional, series, seccionesDePagina } from '@/lib/datos';
import { exigirPagina, metadataDePagina } from '@/lib/paginas';
import { fotosDeSecciones } from '@/lib/secciones';
import { NOMBRE_SITIO, sinVacios, urlSitio } from '@/lib/seo';
import { DatosEstructurados } from '@/components/DatosEstructurados';
import { LEMA } from '@/components/Marco';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => metadataDePagina('inicio', null);

export default async function Inicio() {
  const { vistaPrevia } = await exigirPagina('inicio');
  const [secs, inst, acts, arts, listaSeries, albs, conf] = await Promise.all([
    seccionesDePagina('inicio'), institucional(), actividades(), articulos(), series(), albumes(), configuracion(),
  ]);
  const d = { secs, inst, acts, arts, listaSeries, albs, conf };
  const [fotos, base] = await Promise.all([firmarFotos(fotosDeInicio(d, fotosDeSecciones(secs))), urlSitio()]);
  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <DatosEstructurados datos={sinVacios({
        '@type': 'Organization',
        name: NOMBRE_SITIO,
        alternateName: 'Jóvenes Unidos para Adorar a Cristo',
        description: conf.seo_descripcion || LEMA,
        url: base,
        logo: `${base}/marca/logo-jiump.png`,
        sameAs: conf.instagram_url ? [conf.instagram_url] : undefined,
        parentOrganization: { '@type': 'Organization', name: 'Iglesia Unida Metodista Pentecostal' },
      })} />
      <DatosEstructurados datos={{ '@type': 'WebSite', name: NOMBRE_SITIO, url: base, inLanguage: 'es-CL' }} />
      <InicioCompleto d={d} fotos={fotos} />
    </>
  );
}
