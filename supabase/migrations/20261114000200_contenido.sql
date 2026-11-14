-- =============================================================================
-- JIUMP · Migración 2: tablas de contenido
-- Fotos, artículos, actividades, álbumes, videos, páginas y configuración.
-- Sin ofrendas, donaciones ni aportes económicos (regla 2 del proyecto).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fotos (biblioteca). El archivo vive en el bucket «fotos» de Storage.
-- -----------------------------------------------------------------------------
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  archivo text not null unique,                 -- ruta dentro del bucket «fotos»
  ancho integer check (ancho > 0),
  alto integer check (alto > 0),
  texto_alternativo text not null check (length(btrim(texto_alternativo)) > 0),
  credito text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,   -- = «subida_por»
  actualizado_por uuid references auth.users (id) on delete set null
);
comment on table public.fotos is 'Biblioteca de fotos reales de JIUMP. Nunca recortar ni retocar el original.';
comment on column public.fotos.creado_por is 'Quien subió la foto (subida_por en docs/modelo-datos.md).';

-- -----------------------------------------------------------------------------
-- Artículos
-- -----------------------------------------------------------------------------
create table public.series (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  slug text not null unique check (public.es_slug_valido(slug)),
  descripcion text,
  tipo text not null default 'tematica' check (tipo in ('mes', 'tematica')),
  mes smallint check (mes between 1 and 12),
  color text not null default 'azul' check (color in ('azul', 'rojo', 'neutro')),
  icono text,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null,
  constraint series_mes_si_tipo_mes check (tipo <> 'mes' or mes is not null)
);

create table public.temas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(btrim(nombre)) > 0),
  slug text not null unique check (public.es_slug_valido(slug)),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);

-- Texto plano de los bloques del cuerpo (para búsqueda y minutos de lectura).
-- Toma todos los valores de texto salvo las claves técnicas.
create or replace function public.texto_de_bloques(cuerpo jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  with recursive nodos(valor, clave) as (
    select cuerpo, null::text
    union all
    select hijo.valor, hijo.clave
    from nodos n
    cross join lateral (
      select e.value as valor, e.key as clave
      from jsonb_each(case when jsonb_typeof(n.valor) = 'object' then n.valor else '{}'::jsonb end) e
      union all
      select a.value, n.clave
      from jsonb_array_elements(case when jsonb_typeof(n.valor) = 'array' then n.valor else '[]'::jsonb end) a
    ) hijo
  )
  select coalesce(string_agg(valor #>> '{}', ' '), '')
  from nodos
  where jsonb_typeof(valor) = 'string'
    and coalesce(clave, '') not in ('tipo', 'id', 'foto_id', 'url', 'color', 'icono', 'estilo');
$$;

create table public.articulos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) > 0),
  slug text not null unique check (public.es_slug_valido(slug)),
  bajada text,
  autor text,                                   -- pendiente de datos (docs/pendientes.md)
  serie_id uuid references public.series (id) on delete restrict,
  parte smallint check (parte > 0),
  portada_foto_id uuid references public.fotos (id) on delete set null,
  cuerpo jsonb not null default '[]'::jsonb check (jsonb_typeof(cuerpo) = 'array'),
  estado public.estado_articulo not null default 'borrador',
  estado_antes_papelera public.estado_articulo,
  en_papelera_desde timestamptz,
  publicar_en timestamptz,
  publicado_en timestamptz,
  destacado_inicio boolean not null default false,
  minutos_lectura smallint not null default 1,
  busqueda tsvector generated always as (
    setweight(to_tsvector('spanish', public.sin_tildes(titulo)), 'A') ||
    setweight(to_tsvector('spanish', public.sin_tildes(coalesce(bajada, ''))), 'B') ||
    setweight(to_tsvector('spanish', public.sin_tildes(public.texto_de_bloques(cuerpo))), 'C')
  ) stored,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null,
  constraint articulos_parte_con_serie check (parte is null or serie_id is not null),
  constraint articulos_programado_con_fecha check (estado <> 'programado' or publicar_en is not null)
);
create index articulos_busqueda_idx on public.articulos using gin (busqueda);
create index articulos_estado_idx on public.articulos (estado, publicado_en desc);
create index articulos_serie_idx on public.articulos (serie_id, parte);
create unique index articulos_serie_parte_unica on public.articulos (serie_id, parte)
  where serie_id is not null and parte is not null and estado <> 'papelera';

create table public.articulo_temas (
  articulo_id uuid not null references public.articulos (id) on delete cascade,
  tema_id uuid not null references public.temas (id) on delete cascade,
  primary key (articulo_id, tema_id)
);
create index articulo_temas_tema_idx on public.articulo_temas (tema_id);

-- Historial para «Restaurar una versión». Lo llena un trigger.
create table public.articulo_versiones (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos (id) on delete cascade,
  titulo text not null,
  bajada text,
  autor text,
  serie_id uuid,
  parte smallint,
  portada_foto_id uuid,
  cuerpo jsonb not null,
  estado public.estado_articulo not null,
  guardado_en timestamptz not null default now(),
  guardado_por uuid references auth.users (id) on delete set null
);
create index articulo_versiones_articulo_idx on public.articulo_versiones (articulo_id, guardado_en desc);

-- Visible para el público: publicado, o programado con fecha cumplida
-- (así no se necesita un proceso que «publique» a la hora).
create or replace function public.articulo_es_visible(a public.articulos)
returns boolean
language sql
stable
set search_path = ''
as $$
  select a.estado = 'publicado'
      or (a.estado = 'programado' and a.publicar_en <= now());
$$;

create or replace function public.preparar_articulo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  palabras int;
begin
  palabras := coalesce(array_length(regexp_split_to_array(btrim(public.texto_de_bloques(new.cuerpo)), '\s+'), 1), 0);
  new.minutos_lectura := greatest(1, ceil(palabras / 200.0))::smallint;

  if new.estado = 'publicado' and new.publicado_en is null then
    new.publicado_en := now();
  elsif new.estado = 'programado' and new.publicado_en is null then
    new.publicado_en := new.publicar_en;
  end if;

  if new.estado = 'papelera' then
    if tg_op = 'INSERT' or old.estado <> 'papelera' then
      new.en_papelera_desde := now();
      new.estado_antes_papelera := case when tg_op = 'UPDATE' then old.estado else 'borrador' end;
    end if;
  else
    new.en_papelera_desde := null;
    new.estado_antes_papelera := null;
  end if;
  return new;
end;
$$;

create trigger articulos_preparar
  before insert or update on public.articulos
  for each row execute function public.preparar_articulo();

create or replace function public.guardar_version_articulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.titulo, old.bajada, old.autor, old.serie_id, old.parte, old.portada_foto_id, old.cuerpo)
     is distinct from
     (new.titulo, new.bajada, new.autor, new.serie_id, new.parte, new.portada_foto_id, new.cuerpo) then
    insert into public.articulo_versiones
      (articulo_id, titulo, bajada, autor, serie_id, parte, portada_foto_id, cuerpo, estado, guardado_por)
    values
      (old.id, old.titulo, old.bajada, old.autor, old.serie_id, old.parte, old.portada_foto_id, old.cuerpo, old.estado, auth.uid());
  end if;
  return null;
end;
$$;

create trigger articulos_versiones
  after update on public.articulos
  for each row execute function public.guardar_version_articulo();

-- Restaurar desde la papelera al estado previo (si era publicado vuelve como borrador,
-- para que pase de nuevo por vista previa).
create or replace function public.restaurar_articulo(p_articulo_id uuid)
returns public.articulos
language plpgsql
set search_path = ''
as $$
declare
  fila public.articulos;
begin
  update public.articulos
     set estado = case when estado_antes_papelera in ('borrador', 'revision') then estado_antes_papelera else 'borrador' end
   where id = p_articulo_id and estado = 'papelera'
  returning * into fila;
  if fila.id is null then
    raise exception 'Artículo no encontrado en la papelera o sin permiso';
  end if;
  return fila;
end;
$$;

-- Vacía la papelera (más de 30 días). Para ejecutar con service_role o pg_cron.
create or replace function public.purgar_papelera_articulos()
returns integer
language sql
security definer
set search_path = ''
as $$
  with borrados as (
    delete from public.articulos
    where estado = 'papelera' and en_papelera_desde < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from borrados;
$$;
revoke execute on function public.purgar_papelera_articulos() from public, anon, authenticated;
grant execute on function public.purgar_papelera_articulos() to service_role;

-- Búsqueda de texto completo en español (respeta RLS: el público solo ve
-- artículos visibles).
create or replace function public.buscar_articulos(q text)
returns setof public.articulos
language sql
stable
set search_path = ''
as $$
  select a.*
  from public.articulos a
  where a.busqueda @@ websearch_to_tsquery('spanish', public.sin_tildes(q))
    and a.estado <> 'papelera'
  order by ts_rank(a.busqueda, websearch_to_tsquery('spanish', public.sin_tildes(q))) desc,
           a.publicado_en desc nulls last
  limit 50;
$$;

-- -----------------------------------------------------------------------------
-- Eventos y actividades
-- -----------------------------------------------------------------------------
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) > 0),
  slug text not null unique check (public.es_slug_valido(slug)),
  tipo text not null check (length(btrim(tipo)) > 0),  -- convención, encuentro, zonal, formación, mujeres…
  anio smallint not null check (anio between 1970 and 2100),
  fecha_inicio date,
  fecha_precision text not null default 'dia' check (fecha_precision in ('dia', 'mes')),
  fecha_fin date,
  lugar text,
  zona text,
  introduccion text,                            -- texto oficial
  portada_foto_id uuid references public.fotos (id) on delete set null,
  estado public.estado_contenido not null default 'borrador',
  destacar_inicio boolean not null default false,
  orden_inicio integer not null default 0,
  es_proximo boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null,
  constraint actividades_fechas check (fecha_fin is null or (fecha_inicio is not null and fecha_fin >= fecha_inicio)),
  constraint actividades_anio_fecha check (fecha_inicio is null or extract(year from fecha_inicio) = anio)
);
comment on column public.actividades.fecha_precision is '«mes»: solo se conoce mes y año (mostrar sin día).';
comment on column public.actividades.es_proximo is 'Alimenta la barra y el bloque «Próximo evento». Solo una actividad a la vez.';
create unique index actividades_un_solo_proximo on public.actividades (es_proximo) where es_proximo;
create index actividades_anio_idx on public.actividades (anio desc, fecha_inicio desc);

create table public.actividad_secciones (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  titulo text not null,
  contenido jsonb not null default '[]'::jsonb,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);
create index actividad_secciones_actividad_idx on public.actividad_secciones (actividad_id, orden);

create table public.actividad_enlaces (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  url text not null check (url ~ '^https://'),
  titulo text not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);
create index actividad_enlaces_actividad_idx on public.actividad_enlaces (actividad_id, orden);

-- Quitar una foto de la actividad no la borra de la biblioteca.
create table public.actividad_fotos (
  actividad_id uuid not null references public.actividades (id) on delete cascade,
  foto_id uuid not null references public.fotos (id) on delete cascade,
  orden integer not null default 0,
  es_portada boolean not null default false,
  primary key (actividad_id, foto_id)
);
create index actividad_fotos_foto_idx on public.actividad_fotos (foto_id);
create unique index actividad_fotos_una_portada on public.actividad_fotos (actividad_id) where es_portada;

-- -----------------------------------------------------------------------------
-- Álbumes y videos
-- -----------------------------------------------------------------------------
create table public.albumes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) > 0),
  slug text not null unique check (public.es_slug_valido(slug)),
  descripcion text,
  anio smallint check (anio between 1970 and 2100),
  pais text,
  ciudad text,
  actividad_id uuid references public.actividades (id) on delete set null,
  portada_foto_id uuid references public.fotos (id) on delete set null,
  estado public.estado_contenido not null default 'borrador',
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);

create table public.album_fotos (
  album_id uuid not null references public.albumes (id) on delete cascade,
  foto_id uuid not null references public.fotos (id) on delete cascade,
  orden integer not null default 0,
  primary key (album_id, foto_id)
);
create index album_fotos_foto_idx on public.album_fotos (foto_id);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https://(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/'),
  titulo text not null check (length(btrim(titulo)) > 0),
  descripcion text,
  album_id uuid references public.albumes (id) on delete set null,
  actividad_id uuid references public.actividades (id) on delete set null,
  estado public.estado_contenido not null default 'borrador',
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Páginas y configuración del sitio
-- -----------------------------------------------------------------------------
create table public.paginas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (public.es_slug_valido(clave)),
  titulo text not null,
  estado public.estado_contenido not null default 'borrador',
  seo_titulo text,
  seo_descripcion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);

create table public.secciones (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references public.paginas (id) on delete cascade,
  tipo text not null check (length(btrim(tipo)) > 0),  -- portada, presentacion, que_hacemos, heme_aqui…
  orden integer not null default 0,
  visible boolean not null default true,
  contenido jsonb not null default '{}'::jsonb,         -- textos, botones, fotos (por id), tarjetas
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);
create index secciones_pagina_idx on public.secciones (pagina_id, orden);

create table public.institucional (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('identidad', 'quienes_somos', 'declaracion_fe', 'cifra', 'vision', 'historia')),
  titulo text not null,
  texto text,
  orden integer not null default 0,
  estado public.estado_contenido not null default 'borrador',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);
comment on table public.institucional is 'Textos oficiales entregados por JIUMP, copiados sin cambios. No inventar contenido.';

create table public.menu (
  id uuid primary key default gen_random_uuid(),
  ubicacion text not null check (ubicacion in ('principal', 'pie')),
  etiqueta text not null check (length(btrim(etiqueta)) > 0),
  url text not null check (url ~ '^(/|https://)'),
  orden integer not null default 0,
  visible boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);

-- Fila única.
create table public.configuracion (
  id boolean primary key default true check (id),
  modo_mantenimiento boolean not null default false,
  instagram_url text check (instagram_url is null or instagram_url ~ '^https://(www\.)?instagram\.com/'),
  mostrar_barra_proximo_evento boolean not null default true,
  seo_titulo text,
  seo_descripcion text,
  seo_foto_id uuid references public.fotos (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);

-- Redirecciones 301 desde las URL antiguas de Wix.
create table public.redirecciones (
  id uuid primary key default gen_random_uuid(),
  origen text not null unique check (origen ~ '^/'),
  destino text not null check (destino ~ '^(/|https://)'),
  codigo smallint not null default 301 check (codigo in (301, 302, 308)),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null,
  constraint redirecciones_no_bucle check (origen <> destino)
);

-- -----------------------------------------------------------------------------
-- Triggers comunes: columnas de auditoría y registro de actividad
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'fotos', 'series', 'temas', 'articulos', 'actividades', 'actividad_secciones',
    'actividad_enlaces', 'albumes', 'videos', 'paginas', 'secciones',
    'institucional', 'menu', 'configuracion', 'redirecciones'
  ] loop
    execute format(
      'create trigger %1$s_columnas_comunes before insert or update on public.%1$I
         for each row execute function public.fijar_columnas_comunes()', t);
    execute format(
      'create trigger %1$s_registro after insert or update or delete on public.%1$I
         for each row execute function public.registrar_actividad()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- ¿La foto se usa en contenido público? (para lectura pública de fotos)
-- -----------------------------------------------------------------------------
create or replace function public.foto_es_publica(p_foto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.articulos a
             where public.articulo_es_visible(a)
               and (a.portada_foto_id = p_foto_id or a.cuerpo @? format('$.** ? (@ == "%s")', p_foto_id)::jsonpath))
    or exists (select 1 from public.actividades x
                where x.estado = 'publicado' and x.portada_foto_id = p_foto_id)
    or exists (select 1 from public.actividad_fotos af
                 join public.actividades x on x.id = af.actividad_id
                where af.foto_id = p_foto_id and x.estado = 'publicado')
    or exists (select 1 from public.actividad_secciones s
                 join public.actividades x on x.id = s.actividad_id
                where x.estado = 'publicado' and s.contenido @? format('$.** ? (@ == "%s")', p_foto_id)::jsonpath)
    or exists (select 1 from public.albumes al
                where al.estado = 'publicado' and al.portada_foto_id = p_foto_id)
    or exists (select 1 from public.album_fotos af
                 join public.albumes al on al.id = af.album_id
                where af.foto_id = p_foto_id and al.estado = 'publicado')
    or exists (select 1 from public.secciones s
                 join public.paginas p on p.id = s.pagina_id
                where s.visible and p.estado = 'publicado'
                  and s.contenido @? format('$.** ? (@ == "%s")', p_foto_id)::jsonpath)
    or exists (select 1 from public.configuracion c where c.seo_foto_id = p_foto_id);
$$;
grant execute on function public.foto_es_publica(uuid) to anon, authenticated, service_role;
