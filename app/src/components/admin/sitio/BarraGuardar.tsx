/** Barra fija de «Guardar» (igual en todos los editores). */
export function BarraGuardar({ sucio, guardando, guardar, texto = 'Guardar cambios' }: { sucio: boolean; guardando: boolean; guardar: () => void; texto?: string }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-[20px] border border-linea bg-white/95 px-5 py-3 backdrop-blur">
      <button type="button" className="adm-boton adm-primario" onClick={guardar} disabled={!sucio || guardando} data-guardar>{guardando ? 'Guardando…' : texto}</button>
      <span className="text-[13px] text-texto-3" data-estado-guardado={sucio ? 'sin-guardar' : 'al-dia'}>{sucio ? 'Cambios sin guardar' : 'Todo guardado'}</span>
    </div>
  );
}

export function ErrorGuardar({ error }: { error: { texto: string; conflicto?: boolean } | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="adm-error">{error.texto}
      {error.conflicto && <a href="" className="ml-2 font-semibold underline">Recargar</a>}
    </p>
  );
}

export const AVISOS_CONJUNTO: Record<string, string> = {
  'cambios-publicados': 'Cambios publicados. Ya se ven en el sitio.',
  descartados: 'Se descartaron los cambios sin publicar.',
};
