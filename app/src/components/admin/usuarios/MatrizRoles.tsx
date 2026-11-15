const FILAS: [string, string, string, string, string][] = [
  ['Artículos, series y categorías', '●', '●', '—', '—'],
  ['Eventos y actividades (incluye destacar en Inicio)', '●', '—', '●', '—'],
  ['Biblioteca de fotos (subir y usar)', '●', '◐', '◐', '●'],
  ['Galerías, álbumes y videos', '●', '—', '—', '●'],
  ['Páginas, secciones de Inicio, menú y pie', '●', '—', '—', '—'],
  ['Información institucional', '●', '—', '—', '—'],
  ['Usuarios, roles, registro y configuración', '●', '—', '—', '—'],
];

/** «Qué puede hacer cada rol» (docs/roles-permisos.md), igual que el diseño AdminUsuarios. */
export function MatrizRoles() {
  const celda = (v: string) => v === '●' ? <span aria-label="acceso completo" className="text-[#00665f]">●</span>
    : v === '◐' ? <span aria-label="puede subir y elegir fotos" className="text-azul">◐</span>
      : <span aria-label="sin acceso" className="text-[#cdd1d6]">—</span>;
  return (
    <section className="adm-caja flex flex-col gap-3 p-5 sm:p-7" data-matriz-roles>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="adm-h2">Qué puede hacer cada rol</h2>
        <span className="text-[13px] text-texto-3">Se valida en el servidor y en la base de datos, no solo ocultando botones.</span>
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Qué puede hacer cada rol">
        <table className="w-full min-w-[560px] text-[14px]">
          <thead><tr className="border-b border-linea text-left text-texto-3">
            <th className="py-2.5 font-semibold">Sección</th>
            {['Superadmin', 'Editor', 'Eventos', 'Multimedia'].map((r) => <th key={r} className="py-2.5 text-center font-semibold">{r}</th>)}
          </tr></thead>
          <tbody>
            {FILAS.map(([s, ...v]) => (
              <tr key={s} className="border-b border-linea last:border-0">
                <td className="py-2.5">{s}</td>
                {v.map((x, i) => <td key={i} className="py-2.5 text-center">{celda(x)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-texto-3">● acceso completo · ◐ puede subir y elegir fotos para su contenido, no borrar las de otros · — sin acceso (la sección no aparece en su menú)</p>
    </section>
  );
}
