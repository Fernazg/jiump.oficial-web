import type { Metadata } from 'next';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { NosotrosCompleto } from '@/components/NosotrosCompleto';
import { firmarFotos, institucional, seccionesDePagina } from '@/lib/datos';
import { exigirPagina } from '@/lib/paginas';
import { fotosDeSecciones } from '@/lib/secciones';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nosotros' };

export default async function Nosotros() {
  const { vistaPrevia } = await exigirPagina('nosotros');
  const [inst, secs] = await Promise.all([institucional(), seccionesDePagina('nosotros')]);
  const fotos = await firmarFotos(fotosDeSecciones(secs));
  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <NosotrosCompleto secs={secs} inst={inst} fotos={fotos} />
    </>
  );
}
