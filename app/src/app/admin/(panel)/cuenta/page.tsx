import type { Metadata } from 'next';
import Link from 'next/link';
import { Confirmar } from '@/components/admin/Confirmar';
import { exigirSeccion } from '@/lib/admin/acceso';
import { quitarFactor } from '@/lib/admin/acciones-acceso';
import { NOMBRE_ROL } from '@/lib/admin/secciones';

export const metadata: Metadata = { title: 'Mi cuenta' };

type Props = { searchParams: Promise<{ 'doble-factor'?: string }> };

export default async function Cuenta({ searchParams }: Props) {
  const acceso = await exigirSeccion('cuenta');
  const aviso = (await searchParams)['doble-factor'];
  const esSuper = acceso.roles.includes('superadmin');
  return (
    <>
      <h1 className="adm-h1">Mi cuenta</h1>
      {aviso === 'activado' && <p role="status" className="adm-ok">Doble factor activado. Desde ahora te pediremos el código al ingresar.</p>}
      {aviso === 'quitado' && <p role="status" className="adm-ok">Doble factor desactivado.</p>}
      <div className="flex flex-wrap items-start gap-6">
        <section className="adm-caja flex min-w-0 flex-[1_1_320px] flex-col gap-2 p-6 text-[14px]">
          <h2 className="adm-h2">Tus datos</h2>
          <p><span className="text-texto-3">Nombre:</span> {acceso.nombre}</p>
          <p><span className="text-texto-3">Correo:</span> {acceso.correo}</p>
          <p><span className="text-texto-3">Roles:</span> {acceso.roles.map((r) => NOMBRE_ROL[r]).join(', ')}</p>
          <p className="text-[13px] text-texto-3">Los roles y los datos los cambia un superadministrador.</p>
        </section>
        <section className="adm-caja flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-6 text-[14px]" data-doble-factor={acceso.tieneFactor ? 'activo' : 'inactivo'}>
          <h2 className="adm-h2">Doble factor</h2>
          {acceso.tieneFactor ? (
            <>
              <p><span className="adm-chip bg-[#e0f5f3] text-[#00665f]">Activo</span> Al ingresar te pedimos el código de tu app autenticadora.</p>
              {esSuper ? (
                <p className="text-[13px] text-texto-3">Para Superadministrador es obligatorio. Si cambias de teléfono, pide a otro superadministrador que te ayude: al inscribir un factor nuevo hay que volver a asignarte el rol.</p>
              ) : (
                <Confirmar boton="Desactivar doble factor" claseBoton="adm-mini adm-mini-rojo self-start" titulo="¿Desactivar el doble factor?"
                  confirmar="Sí, desactivar" accion={quitarFactor}>
                  Tu cuenta quedará protegida solo con la contraseña. Puedes volver a activarlo cuando quieras.
                </Confirmar>
              )}
            </>
          ) : (
            <>
              <p>Opcional para tu rol, pero recomendado: protege tu cuenta aunque alguien conozca tu contraseña.</p>
              <Link href="/admin/doble-factor" className="adm-boton adm-primario self-start">Activar doble factor</Link>
            </>
          )}
        </section>
      </div>
    </>
  );
}
