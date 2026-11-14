-- =============================================================================
-- JIUMP · Migración 1: base, usuarios, roles y registro de actividad
-- Ver docs/modelo-datos.md y docs/roles-permisos.md
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.rol_app as enum ('superadmin', 'editor', 'eventos', 'multimedia');

-- Estado de artículos (flujo editorial).
create type public.estado_articulo as enum ('borrador', 'revision', 'programado', 'publicado', 'papelera');

-- Estado del resto del contenido (actividades, álbumes, videos, páginas…).
create type public.estado_contenido as enum ('borrador', 'publicado', 'archivado');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Quita tildes para búsqueda (unaccent no es IMMUTABLE; esta envoltura sí,
-- porque fija el diccionario).
create or replace function public.sin_tildes(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, ''));
$$;

-- Formato de slug: minúsculas, números y guiones simples.
create or replace function public.es_slug_valido(s text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select s ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(s) <= 120;
$$;

-- Columnas comunes: creado_en, actualizado_en, creado_por, actualizado_por.
-- creado_por/actualizado_por los fija el servidor (no se pueden falsificar
-- desde el cliente). Si no hay sesión (migraciones, service_role) se respeta
-- lo que venga.
create or replace function public.fijar_columnas_comunes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.creado_en := coalesce(new.creado_en, now());
    new.actualizado_en := new.creado_en;
    if usuario is not null then
      new.creado_por := usuario;
      new.actualizado_por := usuario;
    end if;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
    if usuario is not null then
      new.actualizado_por := usuario;
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre text not null default '',
  correo text not null,
  activo boolean not null default true,
  ultimo_ingreso timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null
);
comment on table public.perfiles is 'Personas con acceso al panel /admin. Los visitantes del sitio no tienen cuenta.';

create table public.perfil_roles (
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  rol public.rol_app not null,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  primary key (perfil_id, rol)
);
comment on table public.perfil_roles is 'Una persona puede tener más de un rol (ej.: eventos + multimedia).';

create trigger perfiles_columnas_comunes
  before insert or update on public.perfiles
  for each row execute function public.fijar_columnas_comunes();

create or replace function public.fijar_creado_por_rol()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.creado_en := now();
  if auth.uid() is not null then
    new.creado_por := auth.uid();
  end if;
  return new;
end;
$$;

create trigger perfil_roles_creado_por
  before insert on public.perfil_roles
  for each row execute function public.fijar_creado_por_rol();

-- -----------------------------------------------------------------------------
-- Funciones de permisos (SECURITY DEFINER para usarlas dentro de RLS sin
-- recursión). El rol superadmin solo cuenta con doble factor verificado
-- (aal2 en el JWT): «Doble factor obligatorio para Superadministrador».
-- -----------------------------------------------------------------------------
create or replace function public.tiene_rol(r public.rol_app)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfil_roles pr
    join public.perfiles p on p.id = pr.perfil_id
    where p.user_id = auth.uid()
      and p.activo
      and pr.rol = r
      and (r <> 'superadmin' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
  );
$$;

-- ¿Tiene alguno de estos roles?
create or replace function public.tiene_algun_rol(variadic roles public.rol_app[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfil_roles pr
    join public.perfiles p on p.id = pr.perfil_id
    where p.user_id = auth.uid()
      and p.activo
      and pr.rol = any (roles)
      and (pr.rol <> 'superadmin' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
  );
$$;

-- ¿Es parte del equipo (cualquier rol activo)?
create or replace function public.es_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_algun_rol('superadmin', 'editor', 'eventos', 'multimedia');
$$;

-- Roles del usuario actual (para el escritorio del panel). Incluye
-- superadmin aunque falte el 2FA, para que la app pueda pedirlo.
create or replace function public.mis_roles()
returns setof public.rol_app
language sql
stable
security definer
set search_path = ''
as $$
  select pr.rol
  from public.perfil_roles pr
  join public.perfiles p on p.id = pr.perfil_id
  where p.user_id = auth.uid() and p.activo
  order by pr.rol;
$$;

revoke execute on function public.tiene_rol(public.rol_app) from public;
revoke execute on function public.tiene_algun_rol(public.rol_app[]) from public;
revoke execute on function public.es_equipo() from public;
revoke execute on function public.mis_roles() from public, anon;
grant execute on function public.tiene_rol(public.rol_app) to anon, authenticated, service_role;
grant execute on function public.tiene_algun_rol(public.rol_app[]) to anon, authenticated, service_role;
grant execute on function public.es_equipo() to anon, authenticated, service_role;
grant execute on function public.mis_roles() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Alta automática de perfil al crear la cuenta (las cuentas las invita un
-- superadmin desde el servidor; el registro público está desactivado).
-- -----------------------------------------------------------------------------
create or replace function public.crear_perfil_para_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (user_id, nombre, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_para_usuario();

create or replace function public.sincronizar_ingreso_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfiles
     set ultimo_ingreso = new.last_sign_in_at,
         correo = coalesce(new.email, correo)
   where user_id = new.id;
  return new;
end;
$$;

create trigger al_actualizar_usuario
  after update of last_sign_in_at, email on auth.users
  for each row execute function public.sincronizar_ingreso_usuario();

-- Nunca dejar el sitio sin un superadmin activo.
create or replace function public.proteger_ultimo_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quedan int;
begin
  -- Si se está borrando el perfil completo (cascada desde auth.users) se
  -- valida igual: hay que nombrar otro superadmin antes.
  select count(*) into quedan
  from public.perfil_roles pr
  join public.perfiles p on p.id = pr.perfil_id
  where pr.rol = 'superadmin' and p.activo;

  if quedan = 0 then
    raise exception 'Debe quedar al menos un Superadministrador activo'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger perfil_roles_ultimo_superadmin
  after delete or update on public.perfil_roles
  deferrable initially deferred
  for each row
  when (old.rol = 'superadmin')
  execute function public.proteger_ultimo_superadmin();

create constraint trigger perfiles_ultimo_superadmin
  after update of activo on public.perfiles
  deferrable initially deferred
  for each row
  when (old.activo and not new.activo)
  execute function public.proteger_ultimo_superadmin();

-- -----------------------------------------------------------------------------
-- registro_actividad: quién hizo qué y cuándo. Solo lo escriben triggers.
-- -----------------------------------------------------------------------------
create table public.registro_actividad (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.perfiles (id) on delete set null,
  user_id uuid,
  accion text not null check (accion in ('crear', 'editar', 'publicar', 'eliminar', 'papelera', 'restaurar', 'asignar_rol', 'quitar_rol')),
  tabla text not null,
  registro_id text,
  detalle jsonb not null default '{}'::jsonb,
  fecha timestamptz not null default now()
);
create index registro_actividad_fecha_idx on public.registro_actividad (fecha desc);
create index registro_actividad_registro_idx on public.registro_actividad (tabla, registro_id);

create or replace function public.registrar_actividad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accion text;
  v_fila jsonb;
  v_previa jsonb;
  v_id text;
  v_detalle jsonb := '{}'::jsonb;
  v_perfil uuid;
begin
  if tg_op = 'DELETE' then
    v_fila := to_jsonb(old);
  else
    v_fila := to_jsonb(new);
  end if;
  if tg_op = 'UPDATE' then
    v_previa := to_jsonb(old);
  end if;

  v_id := coalesce(v_fila ->> 'id', v_fila ->> 'perfil_id');

  if tg_table_name = 'perfil_roles' then
    v_accion := case when tg_op = 'DELETE' then 'quitar_rol' else 'asignar_rol' end;
    v_detalle := jsonb_build_object('rol', v_fila ->> 'rol');
  elsif tg_op = 'INSERT' then
    v_accion := case when v_fila ->> 'estado' = 'publicado' then 'publicar' else 'crear' end;
  elsif tg_op = 'DELETE' then
    v_accion := 'eliminar';
  else
    if (v_fila ->> 'estado') is distinct from (v_previa ->> 'estado') then
      v_accion := case
        when v_fila ->> 'estado' = 'publicado' then 'publicar'
        when v_fila ->> 'estado' = 'papelera' then 'papelera'
        when v_previa ->> 'estado' = 'papelera' then 'restaurar'
        else 'editar'
      end;
      v_detalle := jsonb_build_object('estado_anterior', v_previa ->> 'estado', 'estado_nuevo', v_fila ->> 'estado');
    else
      v_accion := 'editar';
    end if;
  end if;

  if v_fila ? 'titulo' then
    v_detalle := v_detalle || jsonb_build_object('titulo', v_fila ->> 'titulo');
  elsif v_fila ? 'nombre' then
    v_detalle := v_detalle || jsonb_build_object('nombre', v_fila ->> 'nombre');
  end if;

  select p.id into v_perfil from public.perfiles p where p.user_id = auth.uid();

  insert into public.registro_actividad (perfil_id, user_id, accion, tabla, registro_id, detalle)
  values (v_perfil, auth.uid(), v_accion, tg_table_name, v_id, v_detalle);

  return null;
end;
$$;

create trigger perfiles_registro
  after insert or update or delete on public.perfiles
  for each row execute function public.registrar_actividad();

create trigger perfil_roles_registro
  after insert or delete on public.perfil_roles
  for each row execute function public.registrar_actividad();
