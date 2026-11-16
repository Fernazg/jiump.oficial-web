-- =============================================================================
-- JIUMP · Migración 13: índices para las relaciones entre tablas
-- Revisión profesional (docs/revision-profesional.md).
--
-- PostgreSQL no crea índices para las columnas que apuntan a otra tabla. Sin
-- ellos, cada vez que se borra una foto, una actividad o un álbum, la base
-- recorre completas las tablas que podrían referirse a esa fila, y lo mismo al
-- buscar «los videos de este álbum». Con pocas filas no se nota; con años de
-- contenido, sí. Estos índices no cambian ningún dato ni permiso.
-- =============================================================================
create index if not exists articulos_portada_foto_idx on public.articulos (portada_foto_id) where portada_foto_id is not null;
create index if not exists actividades_portada_foto_idx on public.actividades (portada_foto_id) where portada_foto_id is not null;
create index if not exists albumes_portada_foto_idx on public.albumes (portada_foto_id) where portada_foto_id is not null;
create index if not exists albumes_actividad_idx on public.albumes (actividad_id) where actividad_id is not null;
create index if not exists videos_album_idx on public.videos (album_id) where album_id is not null;
create index if not exists videos_actividad_idx on public.videos (actividad_id) where actividad_id is not null;
create index if not exists articulo_cambios_portada_foto_idx on public.articulo_cambios (portada_foto_id) where portada_foto_id is not null;
create index if not exists articulo_cambios_serie_idx on public.articulo_cambios (serie_id) where serie_id is not null;
create index if not exists registro_actividad_perfil_idx on public.registro_actividad (perfil_id, fecha desc);
