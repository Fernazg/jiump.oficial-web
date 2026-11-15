import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { fotosDeInicio, InicioCompleto } from '@/components/InicioCompleto';
import { actividades, albumes, articulos, configuracion, firmarFotos, institucional, series, seccionesDePagina } from '@/lib/datos';
import { exigirPagina } from '@/lib/paginas';
import { fotosDeSecciones } from '@/lib/secciones';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const { vistaPrevia } = await exigirPagina('inicio');
  const [secs, inst, acts, arts, listaSeries, albs, conf] = await Promise.all([
    seccionesDePagina('inicio'), institucional(), actividades(), articulos(), series(), albumes(), configuracion(),
  ]);
  const d = { secs, inst, acts, arts, listaSeries, albs, conf };
  const fotos = await firmarFotos(fotosDeInicio(d, fotosDeSecciones(secs)));
  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <InicioCompleto d={d} fotos={fotos} />
    </>
  );
}
