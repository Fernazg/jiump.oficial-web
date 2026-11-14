'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Subidor } from './Subidor';

/** Subidor de la biblioteca: al terminar, recarga la lista y avisa. */
export function SubidorBiblioteca() {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Subidor alSubir={(fotos) => { setAviso(fotos.length === 1 ? 'Foto subida y optimizada.' : `${fotos.length} fotos subidas y optimizadas.`); router.refresh(); }} />
      {aviso && <p role="status" className="adm-ok" data-aviso-subida>{aviso}</p>}
    </div>
  );
}
