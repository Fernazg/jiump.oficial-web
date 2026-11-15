import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Confirmar } from '@/components/admin/Confirmar';
import { exigirSeccion } from '@/lib/admin/acceso';
import { cambiarActivo, cambiarRol } from '@/lib/admin/acciones-usuarios';
import { esUuid } from '@/lib/admin/bloques';
import { fechaHoraChile } from '@/lib/admin/hora-chile';
import { NOMBRE_ROL, type Rol } from '@/lib/admin/secciones';
import { listarUsuarios, superadminsActivos } from '@/lib/admin/usuarios';

export const metadata: Metadata = { title: 'Editar usuario' };

const AVISOS: Record<string, string> = {
  'rol-asignado': 'Rol asignado. Cuenta desde su próximo ingreso o al recargar.',
  'rol-quitado': 'Rol quitado. Deja de tener ese acceso de inmediato.',
  desactivado: 'Persona desactivada. Sus sesiones se cerraron y ya no puede ingresar.',
  reactivado: 'Persona reactivada. Ya puede volver a ingresar.',
};
const ROLES: { rol: Rol; ayuda: string }[] = [
  { rol: 'superadmin', ayuda: 'Todo el panel: sitio web, usuarios y configuración. Exige doble factor.' },
  { rol: 'editor', ayuda: 'Artículos, series y categorías.' },
  { rol: 'eventos', ayuda: 'Eventos y actividades, y destacar en Inicio.' },
  { rol: 'multimedia', ayuda: 'Fotos, galerías, álbumes y videos.' },
];

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> };

export default async function EditarUsuario({ params, searchParams }: Props) {
  const acceso = await exigirSeccion('usuarios');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const [{ aviso }, usuarios] = await Promise.all([searchParams, listarUsuarios()]);
  const u = usuarios.find((x) => x.perfil_id === id);
  if (!u) notFound();
  const yo = u.user_id === acceso.userId;
  const quedan = superadminsActivos(usuarios).length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/usuarios" className="text-[14px] font-semibold text-azul">← Usuarios y roles</Link>
        <h1 className="adm-h1">{u.nombre || u.correo}</h1>
        <span className="text-[15px] text-texto-3">{u.correo}{yo ? ' · eres tú' : ''}</span>
      </div>
      {aviso && AVISOS[aviso] && <p role="status" className="adm-ok">{AVISOS[aviso]}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="adm-caja flex flex-col gap-3 p-5 sm:p-7" data-roles-usuario>
          <h2 className="adm-h2">Roles</h2>
          <ul className="flex flex-col gap-2">
            {ROLES.map((r) => {
              const tiene = u.roles.includes(r.rol);
              const bloqueoSuper = r.rol === 'superadmin' && (yo || (!tiene && !u.doble_factor) || (tiene && u.activo && quedan <= 2));
              return (
                <li key={r.rol} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-gris-claro/60 p-3.5" data-rol-fila={r.rol} data-tiene={tiene}>
                  <span>
                    <strong>{NOMBRE_ROL[r.rol]}</strong>{tiene && <span className="adm-chip ml-2 bg-[#e0f5f3] text-[#00665f]">Asignado</span>}
                    <span className="block text-[13px] text-texto-3">{r.ayuda}</span>
                    {r.rol === 'superadmin' && !tiene && !u.doble_factor && <span className="block text-[13px] text-rojo-oscuro">Primero debe inscribir su doble factor (en «Mi cuenta»).</span>}
                    {r.rol === 'superadmin' && tiene && !u.superadmin_vigente && <span className="block text-[13px] text-rojo-oscuro">No está vigente: su factor es posterior al rol. Quítalo y asígnalo de nuevo.</span>}
                    {r.rol === 'superadmin' && tiene && u.activo && quedan <= 2 && !yo && <span className="block text-[13px] text-texto-3">Deben quedar al menos dos Superadministradores activos.</span>}
                  </span>
                  {tiene && r.rol === 'superadmin' && (yo || (u.activo && quedan <= 2)) ? (
                    <span className="text-[13px] text-texto-3" data-rol-bloqueado>{yo ? 'Pídeselo a otro Superadministrador.' : 'No se puede quitar ahora.'}</span>
                  ) : tiene ? (
                    <Confirmar boton="Quitar" claseBoton="adm-boton adm-secundario" titulo={`¿Quitar el rol ${NOMBRE_ROL[r.rol]}?`} confirmar="Sí, quitar"
                      accion={cambiarRol.bind(null, u.perfil_id, r.rol, false)} peligro={r.rol === 'superadmin'}>
                      {u.nombre || u.correo} deja de tener ese acceso de inmediato.
                    </Confirmar>
                  ) : (
                    <BotonAccion accion={cambiarRol.bind(null, u.perfil_id, r.rol, true)} className="adm-boton adm-borde-azul" disabled={bloqueoSuper} data-asignar={r.rol}>Asignar</BotonAccion>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="adm-caja flex flex-col gap-3 p-5 sm:p-7" data-estado-usuario={u.activo ? 'activo' : 'desactivado'}>
          <h2 className="adm-h2">Estado</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[14px]">
            <dt className="text-texto-3">Estado</dt><dd>{u.activo ? 'Activo' : 'Desactivado'}</dd>
            <dt className="text-texto-3">Doble factor</dt><dd>{u.doble_factor ? 'Activo' : 'No inscrito'}</dd>
            <dt className="text-texto-3">Último ingreso</dt><dd>{u.ultimo_ingreso ? fechaHoraChile(u.ultimo_ingreso) : '—'}</dd>
            {u.invitacion_pendiente && <><dt className="text-texto-3">Invitación</dt><dd>Aún no la acepta</dd></>}
          </dl>
          {yo ? <p className="text-[13px] text-texto-3">No puedes desactivarte a ti mismo.</p>
            : u.activo ? (
              <Confirmar boton="Desactivar" claseBoton="adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)]"
                titulo={`¿Desactivar a ${u.nombre || u.correo}?`} confirmar="Sí, desactivar" accion={cambiarActivo.bind(null, u.perfil_id, false)}>
                Sus sesiones se cierran al instante y no podrá ingresar. Lo que publicó sigue en el sitio. Puedes reactivarla después.
              </Confirmar>
            ) : (
              <Confirmar boton="Reactivar" claseBoton="adm-boton adm-borde-azul" titulo={`¿Reactivar a ${u.nombre || u.correo}?`} confirmar="Sí, reactivar"
                peligro={false} accion={cambiarActivo.bind(null, u.perfil_id, true)}>
                Podrá volver a ingresar con sus roles actuales.
              </Confirmar>
            )}
        </section>
      </div>
    </>
  );
}
