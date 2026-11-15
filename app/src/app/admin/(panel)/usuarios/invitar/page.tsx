import type { Metadata } from 'next';
import Link from 'next/link';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { exigirSeccion } from '@/lib/admin/acceso';
import { invitarUsuario } from '@/lib/admin/acciones-usuarios';
import { NOMBRE_ROL, type Rol } from '@/lib/admin/secciones';

export const metadata: Metadata = { title: 'Invitar usuario' };

const ROLES: { rol: Rol; ayuda: string }[] = [
  { rol: 'editor', ayuda: 'Artículos, series y categorías.' },
  { rol: 'eventos', ayuda: 'Eventos y actividades, y destacar en Inicio.' },
  { rol: 'multimedia', ayuda: 'Fotos, galerías, álbumes y videos.' },
];

export default async function Invitar() {
  await exigirSeccion('usuarios');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/usuarios" className="text-[14px] font-semibold text-azul">← Usuarios y roles</Link>
        <h1 className="adm-h1">Invitar usuario</h1>
      </div>
      <section className="adm-caja max-w-[640px] p-5 sm:p-7">
        <Formulario accion={invitarUsuario} className="flex flex-col gap-4" id="invitar">
          <label className="adm-etiqueta-campo">Nombre
            <input className="adm-campo" name="nombre" required maxLength={80} autoComplete="off" />
          </label>
          <label className="adm-etiqueta-campo">Correo
            <input className="adm-campo" name="correo" type="email" required autoComplete="off" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] text-texto-3">Roles</legend>
            {ROLES.map((r) => (
              <label key={r.rol} className="flex items-start gap-3 rounded-[12px] p-2 hover:bg-gris-claro">
                <input type="checkbox" name="roles" value={r.rol} className="mt-1 size-4" />
                <span><strong>{NOMBRE_ROL[r.rol]}</strong><span className="block text-[13px] text-texto-3">{r.ayuda}</span></span>
              </label>
            ))}
          </fieldset>
          <p className="adm-aviso">Superadministrador no se asigna al invitar: la persona primero entra e inscribe su doble factor (en «Mi cuenta»); después se lo asignas desde su ficha.</p>
          <BotonEnviar pendiente="Enviando…">Enviar invitación</BotonEnviar>
        </Formulario>
      </section>
    </>
  );
}
