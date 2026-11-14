import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { obtenerAcceso } from '@/lib/admin/acceso';
import { cerrarSesion, confirmarFactor, prepararFactor } from '@/lib/admin/acciones-acceso';

export const metadata: Metadata = { title: 'Activar el doble factor' };
export const dynamic = 'force-dynamic';

/**
 * Inscribir el doble factor (TOTP). Obligatorio para Superadministrador antes
 * de entrar; opcional para los demás (desde «Mi cuenta»).
 */
export default async function DobleFactor() {
  const acceso = await obtenerAcceso();
  if (!acceso) redirect('/admin/ingresar');
  if (acceso.debeVerificar) redirect('/admin/verificar');
  if (acceso.tieneFactor) redirect('/admin/cuenta');

  const factor = await prepararFactor();
  const obligatorio = acceso.roles.includes('superadmin');

  return (
    <>
      <h1 className="adm-h1">Activa el doble factor</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-texto-3">
        {obligatorio
          ? 'Para Superadministrador es obligatorio: protege el panel aunque alguien conozca tu contraseña.'
          : 'Es opcional para tu rol, pero recomendado: protege tu cuenta aunque alguien conozca tu contraseña.'}
      </p>
      {'error' in factor ? (
        <p role="alert" className="adm-error mt-5">{factor.error}</p>
      ) : (
        <>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed">
            <li>Instala una app autenticadora (Google Authenticator, Microsoft Authenticator, 1Password u otra).</li>
            <li>Escanea este código QR con la app.</li>
            <li>Escribe el código de 6 números que aparece en la app.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR generado por Supabase Auth (SVG en data URL) */}
          <img src={factor.qr} alt="Código QR para la app autenticadora" width={180} height={180} className="mx-auto mt-5 rounded-xl bg-white p-2 shadow-[inset_0_0_0_1px_var(--color-linea)]" />
          <details className="mt-3 text-[13px] text-texto-3">
            <summary className="cursor-pointer font-ui font-semibold text-azul">¿No puedes escanear? Escribe esta clave</summary>
            <code data-secreto-totp className="mt-2 block break-all rounded-lg bg-gris-claro p-2 font-mono text-[13px] text-texto">{factor.secreto}</code>
          </details>
          <Formulario accion={confirmarFactor} className="mt-5 flex flex-col gap-4">
            <input type="hidden" name="factor" value={factor.id} />
            <label className="adm-etiqueta-campo">Código de la app
              <input className="adm-campo text-center font-ui text-[22px] tracking-[0.3em]" name="codigo" inputMode="numeric"
                autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
            </label>
            <BotonEnviar pendiente="Activando…">Activar doble factor</BotonEnviar>
          </Formulario>
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        {!obligatorio && <Link href="/admin/cuenta" className="enlace">Ahora no</Link>}
        <form action={cerrarSesion}><button className="enlace">Cerrar sesión</button></form>
      </div>
    </>
  );
}
