import type { Metadata } from 'next';
import { EditorInstitucional } from '@/components/admin/sitio/EditorInstitucional';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';
import { institucionalParaEditar } from '@/lib/admin/sitio';

export const metadata: Metadata = { title: seccion('institucional').nombre };

export default async function Institucional({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('institucional');
  const [{ aviso }, d] = await Promise.all([searchParams, institucionalParaEditar()]);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="adm-h1">Información institucional</h1>
        <span className="text-[15px] text-texto-3">Identidad, «Quiénes somos», declaraciones de fe y cifras. Solo textos oficiales de JIUMP.</span>
      </div>
      <EditorInstitucional inicial={d.items} version={d.version} hayCambios={d.hayCambios} previaAlDia={d.previaAlDia} aviso={aviso ?? null} />
    </>
  );
}
