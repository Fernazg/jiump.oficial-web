import type { Metadata } from 'next';
import Link from 'next/link';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { recuperar } from '@/lib/admin/acciones-acceso';

export const metadata: Metadata = { title: 'Recuperar la contraseña' };

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  return (
    <>
      <h1 className="adm-h1">Recuperar la contraseña</h1>
      <p className="mt-2 text-[15px] text-texto-3">Te enviaremos un enlace para crear una contraseña nueva.</p>
      {enviado && (
        <p role="status" className="adm-ok mt-5">
          Si ese correo tiene acceso al panel, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada.
        </p>
      )}
      <Formulario accion={recuperar} className="mt-6 flex flex-col gap-4">
        <label className="adm-etiqueta-campo">Correo
          <input className="adm-campo" type="email" name="correo" autoComplete="username" required autoFocus />
        </label>
        <BotonEnviar pendiente="Enviando…">Enviar enlace</BotonEnviar>
      </Formulario>
      <p className="mt-5 text-[14px]"><Link href="/admin/ingresar" className="enlace">Volver a ingresar</Link></p>
    </>
  );
}
