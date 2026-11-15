'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { aceptarInvitacion } from '@/lib/admin/acciones-bienvenida';

/** Destino del enlace de invitación: guarda la sesión y pide crear la contraseña. */
export default function Bienvenida() {
  const router = useRouter();
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, '', window.location.pathname); // los tokens no quedan en el historial
    const acceso = p.get('access_token'), renovar = p.get('refresh_token');
    if (!acceso || !renovar) { setFallo(true); return; }
    aceptarInvitacion(acceso, renovar).then((r) => (r.ok ? router.replace('/admin/nueva-clave') : setFallo(true)));
  }, [router]);
  return fallo ? (
    <>
      <h1 className="adm-h1">El enlace no es válido</h1>
      <p className="mt-2 text-[15px] text-texto-3">Puede que haya vencido o ya se haya usado. Pide a un Superadministrador que te invite de nuevo.</p>
      <a href="/admin/ingresar" className="adm-boton adm-primario mt-6">Ir a ingresar</a>
    </>
  ) : (
    <>
      <h1 className="adm-h1">Bienvenido al panel de JIUMP</h1>
      <p className="mt-2 text-[15px] text-texto-3" data-bienvenida-cargando>Preparando tu cuenta…</p>
    </>
  );
}
