import type { Metadata } from 'next';
import Link from 'next/link';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { ingresar } from '@/lib/admin/acciones-acceso';
import { destinoSeguro } from '@/lib/admin/secciones';

export const metadata: Metadata = { title: 'Ingresar' };

const MOTIVOS: Record<string, { texto: string; tipo: 'ok' | 'error' }> = {
  salida: { texto: 'Cerraste sesión.', tipo: 'ok' },
  inactivo: { texto: 'Tu sesión terminó o tu acceso fue desactivado.', tipo: 'error' },
  'sin-roles': { texto: 'Tu cuenta aún no tiene un rol asignado. Habla con un superadministrador.', tipo: 'error' },
  enlace: { texto: 'El enlace no es válido o ya venció. Pide uno nuevo.', tipo: 'error' },
};

type Props = { searchParams: Promise<{ siguiente?: string; motivo?: string }> };

export default async function Ingresar({ searchParams }: Props) {
  const { siguiente, motivo } = await searchParams;
  const aviso = motivo ? MOTIVOS[motivo] : undefined;
  return (
    <>
      <h1 className="adm-h1">Ingresar al panel</h1>
      <p className="mt-2 text-[15px] text-texto-3">Usa el correo y la contraseña que te dio un superadministrador.</p>
      {aviso && <p role="status" className={`mt-5 ${aviso.tipo === 'ok' ? 'adm-ok' : 'adm-error'}`}>{aviso.texto}</p>}
      <Formulario accion={ingresar} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="siguiente" value={destinoSeguro(siguiente)} />
        <label className="adm-etiqueta-campo">Correo
          <input className="adm-campo" type="email" name="correo" autoComplete="username" required autoFocus />
        </label>
        <label className="adm-etiqueta-campo">Contraseña
          <input className="adm-campo" type="password" name="clave" autoComplete="current-password" required />
        </label>
        <BotonEnviar pendiente="Ingresando…">Ingresar</BotonEnviar>
      </Formulario>
      <p className="mt-5 text-[14px]"><Link href="/admin/recuperar" className="enlace">¿Olvidaste tu contraseña?</Link></p>
      <p className="mt-6 rounded-[10px] bg-gris-claro p-3 text-[12.5px] leading-normal text-texto-3">
        No hay registro público: cada cuenta la crea un superadministrador.
      </p>
    </>
  );
}
