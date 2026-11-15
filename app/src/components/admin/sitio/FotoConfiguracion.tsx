'use client';

import { useState } from 'react';
import { SelectorFoto, type FotoBiblioteca } from '@/components/admin/editor/SelectorFoto';

/** Campo de foto para formularios (envía el id en un input oculto). */
export function FotoConfiguracion({ nombre, titulo, ayuda, inicial, catalogo: inicialCatalogo }: {
  nombre: string; titulo: string; ayuda: string; inicial: string | null; catalogo: FotoBiblioteca[];
}) {
  const [id, setId] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [catalogo, setCatalogo] = useState(inicialCatalogo);
  const foto = catalogo.find((f) => f.id === id);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] bg-gris-claro/60 p-4" data-campo-foto={nombre}>
      <input type="hidden" name={nombre} value={id ?? ''} />
      {foto ? <img src={foto.url} alt={foto.texto_alternativo} className="h-[72px] w-[108px] rounded-[10px] object-cover" /> // eslint-disable-line @next/next/no-img-element
        : <span className="grid h-[72px] w-[108px] place-items-center rounded-[10px] bg-white text-[12px] text-texto-3">Sin foto</span>}
      <div className="flex flex-col gap-2">
        <strong className="font-ui text-[15px]">{titulo}</strong>
        <span className="text-[13px] text-texto-2">{ayuda}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="adm-boton adm-borde-azul" onClick={() => setAbierto(true)}>{id ? 'Cambiar' : 'Elegir de la biblioteca'}</button>
          {id && <button type="button" className="adm-mini adm-mini-rojo" onClick={() => setId(null)}>Quitar</button>}
        </div>
      </div>
      <SelectorFoto fotos={catalogo} abierto={abierto} titulo={titulo} onCerrar={() => setAbierto(false)}
        alSubir={(f) => setCatalogo((c) => [f, ...c])} onElegir={(x) => { setId(x); setAbierto(false); }} />
    </div>
  );
}
