'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ResultadoGuardar } from '@/lib/admin/acciones-contenido';

/**
 * Estado común de los editores de conjunto (menú, institucional): guardar
 * con control de versión, aviso al salir con cambios sin guardar y volver a
 * lo guardado cuando cambia en el servidor (publicar, descartar).
 */
export function useEditorConjunto<T>(inicial: T, versionInicial: string, guardarEn: (d: T, version: string) => Promise<ResultadoGuardar>, rutaPrevia: string) {
  const router = useRouter();
  const [d, setD] = useState<T>(inicial);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ texto: string; conflicto?: boolean } | null>(null);
  const [listo, setListo] = useState(false);
  const version = useRef(versionInicial);
  const mostrado = useRef(JSON.stringify([versionInicial, inicial]));
  const actual = JSON.stringify([versionInicial, inicial]);
  useEffect(() => {
    if (mostrado.current === actual) return;
    mostrado.current = actual;
    setD(inicial); setSucio(false); version.current = versionInicial;
  }, [actual]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setListo(true), []);
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (sucio) e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const cambiar = (f: (x: T) => T) => { setD(f); setSucio(true); };
  const guardar = async () => {
    setGuardando(true);
    const r = await guardarEn(d, version.current);
    setGuardando(false);
    if (r.ok) { version.current = r.version; setSucio(false); setError(null); router.refresh(); return true; }
    setError({ texto: r.error, conflicto: r.conflicto });
    return false;
  };
  const verPrevia = async () => {
    if (sucio && !(await guardar())) return;
    router.push(rutaPrevia);
  };
  return { d, cambiar, sucio, guardando, error, listo, guardar, verPrevia };
}
