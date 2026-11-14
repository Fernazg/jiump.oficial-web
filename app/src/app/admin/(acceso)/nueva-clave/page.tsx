import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { obtenerAcceso } from '@/lib/admin/acceso';
import { nuevaClave } from '@/lib/admin/acciones-acceso';

export const metadata: Metadata = { title: 'Contraseña nueva' };

export default async function NuevaClave() {
  const acceso = await obtenerAcceso();
  if (!acceso) redirect('/admin/ingresar?motivo=enlace');
  return (
    <>
      <h1 className="adm-h1">Crea tu contraseña nueva</h1>
      <p className="mt-2 text-[15px] text-texto-3">Para {acceso.correo}. Usa al menos 10 caracteres.</p>
      <Formulario accion={nuevaClave} className="mt-6 flex flex-col gap-4">
        <label className="adm-etiqueta-campo">Contraseña nueva
          <input className="adm-campo" type="password" name="clave" autoComplete="new-password" minLength={10} required autoFocus />
        </label>
        <label className="adm-etiqueta-campo">Repite la contraseña
          <input className="adm-campo" type="password" name="repetir" autoComplete="new-password" minLength={10} required />
        </label>
        <BotonEnviar pendiente="Guardando…">Guardar contraseña</BotonEnviar>
      </Formulario>
    </>
  );
}
