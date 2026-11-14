-- =============================================================================
-- JIUMP · Migración 8: apoyo del panel /admin (etapa 1: acceso y artículos)
--
--  · mi_acceso(): qué roles tiene la persona y cuáles cuentan en ESTA sesión.
--  · Vista previa obligatoria: nada pasa a «publicado» o «programado» (ni
--    cambia el texto de algo ya publicado) si quien lo hace no vio antes la
--    vista previa de ese mismo contenido. Se exige en la base de datos.
--  · Cambios pendientes de artículos ya publicados (se guardan aparte y solo
--    llegan al sitio al publicarlos, después de la vista previa).
--  · Presencia: quién tiene abierto cada artículo (aviso de edición simultánea).
--  · Papelera: se vacía sola a los 30 días (pg_cron, dentro de la base).
--
-- El panel usa SIEMPRE la sesión de la persona (RLS); nunca la service role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Acceso de la sesión actual
-- -----------------------------------------------------------------------------
-- roles:     roles asignados (aunque aún no cuenten, p. ej. superadmin sin 2FA)
-- efectivos: roles que la base de datos reconoce en esta sesión (tiene_rol)
create or replace function public.mi_acceso()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'perfil_id', p.id,
    'nombre', p.nombre,
    'correo', p.correo,
    'activo', p.activo,
    'roles', coalesce((select jsonb_agg(r order by r) from public.mis_roles() r), '[]'::jsonb),
    'efectivos', coalesce((
      select jsonb_agg(r order by r)
      from unnest(enum_range(null::public.rol_app)) r
      where public.tiene_rol(r)
    ), '[]'::jsonb)
  )
  from public.perfiles p
  where p.user_id = auth.uid();
$$;
revoke execute on function public.mi_acceso() from public, anon;
grant execute on function public.mi_acceso() to authenticated;

-- -----------------------------------------------------------------------------
-- Huella del contenido de un artículo (lo que se ve en la página pública)
-- -----------------------------------------------------------------------------
create or replace function public.huella_articulo(
  p_titulo text, p_bajada text, p_autor text, p_serie_id uuid, p_parte smallint,
  p_portada_foto_id uuid, p_cuerpo jsonb
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'titulo', p_titulo, 'bajada', p_bajada, 'autor', p_autor, 'serie_id', p_serie_id,
    'parte', p_parte, 'portada_foto_id', p_portada_foto_id, 'cuerpo', p_cuerpo
  )::text);
$$;
revoke execute on function public.huella_articulo(text, text, text, uuid, smallint, uuid, jsonb) from public, anon;
grant execute on function public.huella_articulo(text, text, text, uuid, smallint, uuid, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Cambios pendientes de un artículo publicado o programado
-- Mientras se editan, el sitio sigue mostrando la versión publicada.
-- -----------------------------------------------------------------------------
create table public.articulo_cambios (
  articulo_id uuid primary key references public.articulos (id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) > 0),
  bajada text,
  autor text,
  serie_id uuid references public.series (id) on delete restrict,
  parte smallint check (parte > 0),
  portada_foto_id uuid references public.fotos (id) on delete set null,
  cuerpo jsonb not null default '[]'::jsonb check (jsonb_typeof(cuerpo) = 'array'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);
comment on table public.articulo_cambios is 'Cambios aún no publicados de un artículo publicado o programado.';

create trigger articulo_cambios_columnas_comunes
  before insert or update on public.articulo_cambios
  for each row execute function public.fijar_columnas_comunes();

-- Huella de lo que hoy mostraría la vista previa: los cambios pendientes si
-- existen; si no, el artículo guardado. Respeta RLS (invoker).
create or replace function public.huella_vigente_articulo(p_articulo_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select public.huella_articulo(c.titulo, c.bajada, c.autor, c.serie_id, c.parte, c.portada_foto_id, c.cuerpo)
       from public.articulo_cambios c where c.articulo_id = p_articulo_id),
    (select public.huella_articulo(a.titulo, a.bajada, a.autor, a.serie_id, a.parte, a.portada_foto_id, a.cuerpo)
       from public.articulos a where a.id = p_articulo_id)
  );
$$;
revoke execute on function public.huella_vigente_articulo(uuid) from public, anon;
grant execute on function public.huella_vigente_articulo(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Vistas previas: quién vio qué contenido. Solo se puede registrar la huella
-- del contenido vigente (la calcula la base, no el navegador).
-- -----------------------------------------------------------------------------
create table public.articulo_vistas_previas (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references public.articulos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  huella text not null,
  visto_en timestamptz not null default now()
);
create index articulo_vistas_previas_idx on public.articulo_vistas_previas (articulo_id, user_id, huella);

-- Antes de publicar: ¿esta persona vio la vista previa de ESTE contenido?
-- Solo se exige a las personas del panel (rol authenticated de la API); las
-- migraciones, el seed y las pruebas con la service role no pasan por aquí.
create or replace function public.exigir_vista_previa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cambia_contenido boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.estado not in ('publicado', 'programado') then
    return new;
  end if;

  cambia_contenido := tg_op = 'INSERT'
    or old.estado not in ('publicado', 'programado')
    or (old.titulo, old.bajada, old.autor, old.serie_id, old.parte, old.portada_foto_id, old.cuerpo)
       is distinct from
       (new.titulo, new.bajada, new.autor, new.serie_id, new.parte, new.portada_foto_id, new.cuerpo);

  if cambia_contenido and not exists (
    select 1 from public.articulo_vistas_previas v
    where v.articulo_id = new.id
      and v.user_id = auth.uid()
      and v.huella = public.huella_articulo(new.titulo, new.bajada, new.autor, new.serie_id, new.parte, new.portada_foto_id, new.cuerpo)
  ) then
    raise exception 'Antes de publicar hay que revisar la vista previa de este contenido'
      using errcode = 'P0001', hint = 'vista_previa_pendiente';
  end if;
  return new;
end;
$$;
revoke execute on function public.exigir_vista_previa() from public, anon, authenticated;

create trigger articulos_exigir_vista_previa
  before insert or update on public.articulos
  for each row execute function public.exigir_vista_previa();

-- -----------------------------------------------------------------------------
-- Presencia: quién tiene abierto un artículo en el editor
-- Guarda el nombre que la persona tiene en su perfil (el resto del perfil
-- sigue siendo privado).
-- -----------------------------------------------------------------------------
create table public.articulo_presencia (
  articulo_id uuid not null references public.articulos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default '',
  visto_en timestamptz not null default now(),
  primary key (articulo_id, user_id)
);

-- -----------------------------------------------------------------------------
-- RLS (Superadmin y Editor, igual que los artículos)
-- -----------------------------------------------------------------------------
alter table public.articulo_cambios enable row level security;
alter table public.articulo_vistas_previas enable row level security;
alter table public.articulo_presencia enable row level security;

grant select, insert, update, delete on public.articulo_cambios to authenticated;
grant select, insert, delete on public.articulo_vistas_previas to authenticated;
grant select, insert, update, delete on public.articulo_presencia to authenticated;
revoke all on public.articulo_cambios, public.articulo_vistas_previas, public.articulo_presencia from anon;

create policy articulo_cambios_editar on public.articulo_cambios
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')))
  with check ((select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulo_vistas_previas_leer on public.articulo_vistas_previas
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulo_vistas_previas_registrar on public.articulo_vistas_previas
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.tiene_algun_rol('superadmin', 'editor'))
    and huella = public.huella_vigente_articulo(articulo_id)
  );

create policy articulo_vistas_previas_borrar on public.articulo_vistas_previas
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy articulo_presencia_leer on public.articulo_presencia
  for select to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulo_presencia_propia on public.articulo_presencia
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulo_presencia_actualizar on public.articulo_presencia
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulo_presencia_salir on public.articulo_presencia
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Papelera: se vacía sola a los 30 días (pg_cron corre dentro de la base; no
-- hace falta ningún servicio externo ni la service role desde el panel).
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'jiump-vaciar-papelera-articulos',
  '17 7 * * *',   -- todos los días, 07:17 UTC (madrugada en Chile)
  $$ select public.purgar_papelera_articulos() $$
);
