-- =============================================================================
-- JIUMP · Migración 5: datos estructurales mínimos (también en producción)
-- Solo lo definido en el diseño aprobado (docs/diseno.md). Sin textos
-- institucionales: esos los carga JIUMP desde el panel.
-- =============================================================================

insert into public.configuracion (id, modo_mantenimiento, instagram_url, mostrar_barra_proximo_evento)
values (true, false, 'https://www.instagram.com/jiump.oficial', true)
on conflict (id) do nothing;

-- Páginas del sitio (quedan en borrador hasta que JIUMP las apruebe).
insert into public.paginas (clave, titulo, estado) values
  ('inicio', 'Inicio', 'borrador'),
  ('nosotros', 'Nosotros', 'borrador'),
  ('eventos', 'Eventos', 'borrador'),
  ('articulos', 'Artículos', 'borrador'),
  ('galeria', 'Galería', 'borrador')
on conflict (clave) do nothing;

-- Menú unificado del diseño: Nosotros · Eventos · Artículos · Galería.
insert into public.menu (ubicacion, etiqueta, url, orden)
select v.ubicacion, v.etiqueta, v.url, v.orden
from (values
  ('principal', 'Nosotros', '/nosotros', 1),
  ('principal', 'Eventos', '/eventos', 2),
  ('principal', 'Artículos', '/articulos', 3),
  ('principal', 'Galería', '/galeria', 4)
) as v(ubicacion, etiqueta, url, orden)
where not exists (select 1 from public.menu);
