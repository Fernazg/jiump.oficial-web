import type { Metadata } from 'next';
import Link from 'next/link';
import { ChipRol } from '@/components/admin/usuarios/ChipRol';
import { MatrizRoles } from '@/components/admin/usuarios/MatrizRoles';
import { exigirSeccion } from '@/lib/admin/acceso';
import { fechaHoraChile } from '@/lib/admin/hora-chile';
import { listarUsuarios, superadminsActivos } from '@/lib/admin/usuarios';
import { Ayuda } from '@/components/admin/Ayuda';

export const metadata: Metadata = { title: 'Usuarios y roles' };

/** Usuarios y roles (diseño AdminUsuarios). Solo Superadmin. */
export default async function Usuarios({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('usuarios');
  const [{ aviso }, usuarios] = await Promise.all([searchParams, listarUsuarios()]);
  const supers = superadminsActivos(usuarios);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="adm-h1">Usuarios y roles</h1>
          <span className="text-[15px] text-texto-3">Solo el Superadministrador ve esta sección.</span>
          <Ayuda>
            <ul>
              <li>«Invitar» envía un correo. La persona abre el enlace, crea su contraseña y entra con los roles que elegiste.</li>
              <li>Para nombrar a un Superadministrador: primero la persona activa su doble factor desde «Mi cuenta», y después se le asigna el rol.</li>
              <li>Siempre deben quedar al menos dos Superadministradores activos.</li>
              <li>«Desactivar» corta el acceso de la persona al instante. Se puede reactivar.</li>
            </ul>
          </Ayuda>
        </div>
        <Link href="/admin/usuarios/invitar" className="adm-boton adm-primario min-h-[46px] px-[22px] text-[15px]">+ Invitar usuario</Link>
      </div>
      {aviso === 'invitado' && <p role="status" className="adm-ok">Invitación enviada. La persona recibirá un correo para crear su contraseña.</p>}
      {supers.length < 2 && (
        <p className="adm-aviso" data-aviso-superadmins>
          Hay {supers.length} Superadministrador{supers.length === 1 ? '' : 'es'} activo{supers.length === 1 ? '' : 's'}. Deben ser al menos dos: si uno pierde su teléfono (su doble factor), el otro puede ayudarle.
        </p>
      )}
      <section className="adm-caja overflow-x-auto p-2 sm:p-3" tabIndex={0} aria-label="Lista de personas del equipo">
        <table className="w-full min-w-[720px] text-[14px]" data-lista-usuarios>
          <thead><tr className="border-b border-linea text-left text-texto-3">
            <th className="px-4 py-3 font-semibold">Persona</th><th className="px-4 py-3 font-semibold">Roles</th>
            <th className="px-4 py-3 font-semibold">Doble factor</th><th className="px-4 py-3 font-semibold">Último ingreso</th>
            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
          </tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.perfil_id} className="adm-fila border-b border-linea last:border-0" data-usuario={u.correo}>
                <td className="px-4 py-3">
                  <strong className={u.activo ? '' : 'text-texto-3'}>{u.nombre || u.correo.split('@')[0]}</strong>
                  <span className="block text-[13px] text-texto-3">{u.correo}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    {u.roles.map((r) => <ChipRol key={r} rol={r} />)}
                    {!u.activo && <span className="adm-chip bg-[#eef0f2] text-texto-2">Desactivado</span>}
                    {u.invitacion_pendiente && <span className="adm-chip bg-[#fff6e0] text-[#6b4a00]">Invitación pendiente</span>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.doble_factor ? <span className="font-semibold text-[#00665f]">Activo</span>
                    : u.roles.includes('superadmin') ? <span className="font-semibold text-rojo-oscuro">Falta (obligatorio)</span>
                      : <span className="text-texto-2">Opcional</span>}
                </td>
                <td className="px-4 py-3 text-texto-2">{u.ultimo_ingreso ? fechaHoraChile(u.ultimo_ingreso) : '—'}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/usuarios/${u.perfil_id}`} className="font-semibold text-azul underline">Editar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <MatrizRoles />
      <p className="text-[14px]"><Link href="/admin/registro" className="font-semibold text-azul underline">Ver el registro de actividad →</Link></p>
    </>
  );
}
