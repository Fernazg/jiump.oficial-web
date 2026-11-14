import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { obtenerAcceso } from '@/lib/admin/acceso';
import { verificarCodigo } from '@/lib/admin/acciones-acceso';
import { destinoSeguro } from '@/lib/admin/secciones';

export const metadata: Metadata = { title: 'Verificación en dos pasos' };

type Props = { searchParams: Promise<{ siguiente?: string }> };

export default async function Verificar({ searchParams }: Props) {
  const acceso = await obtenerAcceso();
  if (!acceso) redirect('/admin/ingresar');
  if (!acceso.debeVerificar) redirect('/admin');
  const { siguiente } = await searchParams;
  return (
    <>
      <h1 className="adm-h1">Verificación en dos pasos</h1>
      <p className="mt-2 text-[15px] text-texto-3">Abre tu app autenticadora y escribe el código de 6 números de «JIUMP Panel».</p>
      <Formulario accion={verificarCodigo} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="siguiente" value={destinoSeguro(siguiente)} />
        <label className="adm-etiqueta-campo">Código
          <input className="adm-campo text-center font-ui text-[22px] tracking-[0.3em]" name="codigo" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
        </label>
        <BotonEnviar pendiente="Verificando…">Verificar</BotonEnviar>
      </Formulario>
      <form method="post" action="/admin/salir" className="mt-5">
        <button className="enlace text-[14px]">Cancelar y cerrar sesión</button>
      </form>
    </>
  );
}
