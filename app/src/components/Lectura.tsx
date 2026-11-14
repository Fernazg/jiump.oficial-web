'use client';

import { useEffect, useState } from 'react';

/** Barra de progreso de lectura (arriba de la pantalla). */
export function BarraLectura({ color }: { color: 'azul' | 'rojo' }) {
  const [avance, setAvance] = useState(0);
  useEffect(() => {
    const medir = () => {
      const cuerpo = document.getElementById('cuerpo-articulo');
      if (!cuerpo) return;
      const r = cuerpo.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      setAvance(Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.2) / Math.max(total, 1))));
    };
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', medir); window.removeEventListener('resize', medir); };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1" role="progressbar" aria-label="Progreso de lectura"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)}>
      <div className={`h-full origin-left ${color === 'rojo' ? 'bg-rojo' : 'bg-azul'}`} style={{ transform: `scaleX(${avance})` }} />
    </div>
  );
}

const ESCALAS = [0.9, 1, 1.12, 1.25];
const CLAVE = 'jiump:tamano-texto';

/** Selector A− / A+ del tamaño del cuerpo del artículo (se recuerda en este navegador). */
export function TamanoTexto() {
  const [i, setI] = useState(1);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado !== null && ESCALAS[Number(guardado)] !== undefined) setI(Number(guardado));
    } catch { /* sin almacenamiento: tamaño normal */ }
  }, []);
  useEffect(() => {
    document.getElementById('cuerpo-articulo')?.style.setProperty('--escala-texto', String(ESCALAS[i]));
    try { localStorage.setItem(CLAVE, String(i)); } catch { /* opcional */ }
  }, [i]);
  const btn = 'grid h-9 min-w-11 place-items-center rounded-lg px-2 font-ui text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--color-linea)] disabled:opacity-40';
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="Achicar el texto">A−</button>
      <button type="button" className={btn} onClick={() => setI((v) => Math.min(ESCALAS.length - 1, v + 1))} disabled={i === ESCALAS.length - 1} aria-label="Agrandar el texto">A+</button>
    </div>
  );
}
