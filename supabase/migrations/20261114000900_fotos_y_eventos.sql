-- =============================================================================
-- JIUMP · Migración 9: panel /admin etapa 2 (fotos, eventos, galería y videos)
--
--  · fotos.anchos: versiones optimizadas (WebP y AVIF) que generó el panel.
--  · usos_fotos(): dónde se usa cada foto (para avisar antes de eliminarla).
--  · Regla 2 del README: cada foto pertenece a un solo evento. Una foto está
--    en a lo más una actividad y un álbum, y un álbum asociado a una
--    actividad solo tiene fotos de esa actividad.
--  · Vista previa obligatoria antes de publicar actividades, álbumes y videos
--    (como en los artículos, exigida en la base).
--  · marcar_proximo(): «Próximo evento», siempre uno solo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Versiones optimizadas de cada foto
-- Ruta: <carpeta>/<nombre>/<ancho>.webp y .avif (el original no se toca).
-- -----------------------------------------------------------------------------
alter table public.fotos
  add column anchos smallint[] not null default '{}';
alter table public.fotos
  add constraint fotos_anchos_validos check (
    cardinality(anchos) <= 8 and 0 < all (anchos) and 4000 >= all (anchos)
  );
comment on column public.fotos.anchos is 'Anchos (px) de las versiones optimizadas WebP y AVIF. Vacío: solo el original.';

-- -----------------------------------------------------------------------------
-- Regla 2: no mezclar fotos de distintos eventos
-- -----------------------------------------------------------------------------
create unique index album_fotos_una_vez on public.album_fotos (foto_id);
create unique index actividad_fotos_una_vez on public.actividad_fotos (foto_id);

-- Revisa con todos los datos (SECURITY DEFINER): Multimedia no ve actividades
-- en borrador, pero la regla vale igual. El mensaje no revela qué actividad es.
create or replace function public.validar_un_evento_por_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conflicto boolean := false;
begin
  if tg_table_name = 'album_fotos' then
    select exists (
      select 1 from public.albumes al
      join public.actividad_fotos xf on xf.foto_id = new.foto_id
      where al.id = new.album_id and xf.actividad_id is distinct from al.actividad_id
    ) into conflicto;
  elsif tg_table_name = 'actividad_fotos' then
    select exists (
      select 1 from public.album_fotos af
      join public.albumes al on al.id = af.album_id
      where af.foto_id = new.foto_id and al.actividad_id is distinct from new.actividad_id
    ) into conflicto;
  elsif tg_table_name = 'albumes' then
    select exists (
      select 1 from public.album_fotos af
      join public.actividad_fotos xf on xf.foto_id = af.foto_id
      where af.album_id = new.id and xf.actividad_id is distinct from new.actividad_id
    ) into conflicto;
  end if;
  if conflicto then
    raise exception 'Esta foto ya pertenece a otro evento: no se mezclan fotos de distintos eventos'
      using errcode = 'P0001', hint = 'foto_de_otro_evento';
  end if;
  return new;
end;
$$;
revoke execute on function public.validar_un_evento_por_foto() from public, anon, authenticated;

create trigger album_fotos_un_evento
  before insert or update on public.album_fotos
  for each row execute function public.validar_un_evento_por_foto();
create trigger actividad_fotos_un_evento
  before insert or update on public.actividad_fotos
  for each row execute function public.validar_un_evento_por_foto();
create trigger albumes_un_evento
  before update of actividad_id on public.albumes
  for each row execute function public.validar_un_evento_por_foto();


-- -----------------------------------------------------------------------------
-- Cambios pendientes de lo ya publicado (actividades, álbumes y videos)
-- Igual que en los artículos: mientras se editan, el sitio sigue mostrando la
-- versión publicada. «datos» tiene la misma forma que recibe guardar_*().
-- -----------------------------------------------------------------------------
create table public.contenido_cambios (
  tipo text not null check (tipo in ('actividad', 'album', 'video')),
  registro_id uuid not null,
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_por uuid references auth.users (id) on delete set null,
  primary key (tipo, registro_id)
);
comment on table public.contenido_cambios is 'Cambios aún no publicados de una actividad, álbum o video publicado.';
create trigger contenido_cambios_columnas_comunes
  before insert or update on public.contenido_cambios
  for each row execute function public.fijar_columnas_comunes();

-- -----------------------------------------------------------------------------
-- Vista previa obligatoria: actividades, álbumes y videos
-- La huella resume el contenido que se ve en el sitio (incluye secciones,
-- enlaces y fotos) o, si hay cambios pendientes, esos cambios. Se calcula en
-- la base, no en el navegador.
-- -----------------------------------------------------------------------------
create or replace function public.huella_contenido(p_tipo text, p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select md5('cambios:' || c.datos::text) from public.contenido_cambios c where c.tipo = p_tipo and c.registro_id = p_id),
    md5(coalesce(case p_tipo
    when 'actividad' then (
      select jsonb_build_object(
        'fila', to_jsonb(x) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'destacar_inicio', 'orden_inicio', 'es_proximo'],
        'secciones', (select coalesce(jsonb_agg(jsonb_build_array(s.titulo, s.contenido, s.orden) order by s.orden, s.id), '[]') from public.actividad_secciones s where s.actividad_id = x.id),
        'enlaces', (select coalesce(jsonb_agg(jsonb_build_array(e.titulo, e.url, e.orden) order by e.orden, e.id), '[]') from public.actividad_enlaces e where e.actividad_id = x.id),
        'fotos', (select coalesce(jsonb_agg(jsonb_build_array(f.foto_id, f.orden, f.es_portada) order by f.orden, f.foto_id), '[]') from public.actividad_fotos f where f.actividad_id = x.id)
      )::text from public.actividades x where x.id = p_id)
    when 'album' then (
      select jsonb_build_object(
        'fila', to_jsonb(al) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'orden'],
        'fotos', (select coalesce(jsonb_agg(jsonb_build_array(f.foto_id, f.orden) order by f.orden, f.foto_id), '[]') from public.album_fotos f where f.album_id = al.id)
      )::text from public.albumes al where al.id = p_id)
    when 'video' then (
      select (to_jsonb(v) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'orden'])::text
      from public.videos v where v.id = p_id)
  end, '')));
$$;
revoke execute on function public.huella_contenido(text, uuid) from public, anon;
grant execute on function public.huella_contenido(text, uuid) to authenticated, service_role;

create or replace function public.puede_editar_contenido(p_tipo text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_tipo
    when 'actividad' then public.tiene_algun_rol('superadmin', 'eventos')
    when 'album' then public.tiene_algun_rol('superadmin', 'multimedia')
    when 'video' then public.tiene_algun_rol('superadmin', 'multimedia')
    else false
  end;
$$;
revoke execute on function public.puede_editar_contenido(text) from public, anon;
grant execute on function public.puede_editar_contenido(text) to authenticated, service_role;

create table public.vistas_previas_contenido (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('actividad', 'album', 'video')),
  registro_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  huella text not null,
  visto_en timestamptz not null default now()
);
create index vistas_previas_contenido_idx on public.vistas_previas_contenido (tipo, registro_id, user_id, huella);

alter table public.vistas_previas_contenido enable row level security;
grant select, insert, delete on public.vistas_previas_contenido to authenticated;
revoke all on public.vistas_previas_contenido from anon;

create policy vistas_previas_contenido_leer on public.vistas_previas_contenido
  for select to authenticated
  using (user_id = (select auth.uid()) and public.puede_editar_contenido(tipo));
create policy vistas_previas_contenido_registrar on public.vistas_previas_contenido
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.puede_editar_contenido(tipo)
    and huella = public.huella_contenido(tipo, registro_id)
  );
create policy vistas_previas_contenido_borrar on public.vistas_previas_contenido
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Publicar exige la vista previa del contenido tal como está guardado. El
-- cambio a «publicado» no puede modificar a la vez el contenido.
create or replace function public.exigir_vista_previa_contenido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text := case tg_table_name when 'actividades' then 'actividad' when 'albumes' then 'album' else 'video' end;
  v_meta text[] := array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'destacar_inicio', 'orden_inicio', 'es_proximo', 'orden'];
begin
  if current_user <> 'authenticated' or new.estado <> 'publicado' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.estado = 'publicado' then
    return new;
  end if;
  if tg_op = 'INSERT' or (to_jsonb(new) - v_meta) is distinct from (to_jsonb(old) - v_meta) or not exists (
    select 1 from public.vistas_previas_contenido v
    where v.tipo = v_tipo and v.registro_id = new.id and v.user_id = auth.uid()
      and v.huella = public.huella_contenido(v_tipo, new.id)
  ) then
    raise exception 'Antes de publicar hay que revisar la vista previa de este contenido'
      using errcode = 'P0001', hint = 'vista_previa_pendiente';
  end if;
  return new;
end;
$$;
revoke execute on function public.exigir_vista_previa_contenido() from public, anon, authenticated;

create trigger actividades_exigir_vista_previa
  before insert or update on public.actividades
  for each row execute function public.exigir_vista_previa_contenido();
create trigger albumes_exigir_vista_previa
  before insert or update on public.albumes
  for each row execute function public.exigir_vista_previa_contenido();
create trigger videos_exigir_vista_previa
  before insert or update on public.videos
  for each row execute function public.exigir_vista_previa_contenido();

-- -----------------------------------------------------------------------------
-- «Próximo evento»: solo una actividad a la vez (respeta RLS)
-- -----------------------------------------------------------------------------
create or replace function public.marcar_proximo(p_actividad_id uuid, p_valor boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_valor then
    update public.actividades set es_proximo = false where es_proximo and id <> p_actividad_id;
  end if;
  update public.actividades set es_proximo = p_valor where id = p_actividad_id;
  if not found then
    raise exception 'Actividad no encontrada o sin permiso' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.marcar_proximo(uuid, boolean) from public, anon;
grant execute on function public.marcar_proximo(uuid, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Cambios pendientes: permisos (igual que el contenido de cada tipo)
-- -----------------------------------------------------------------------------
alter table public.contenido_cambios enable row level security;
grant select, insert, update, delete on public.contenido_cambios to authenticated;
revoke all on public.contenido_cambios from anon;
create policy contenido_cambios_editar on public.contenido_cambios
  for all to authenticated
  using (public.puede_editar_contenido(tipo))
  with check (public.puede_editar_contenido(tipo));

-- -----------------------------------------------------------------------------
-- Lo publicado no se cambia directo: los cambios quedan pendientes y solo
-- llegan al sitio con publicar_cambios() (después de la vista previa).
-- Aplica a las personas del panel; publicar_cambios() lo permite con una
-- marca interna de la transacción que la API no puede fijar.
-- -----------------------------------------------------------------------------
create or replace function public.proteger_publicado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_meta text[] := array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'destacar_inicio', 'orden_inicio', 'es_proximo', 'orden'];
  v_padre uuid;
  v_publicado boolean := false;
begin
  if current_user <> 'authenticated' or coalesce(current_setting('jiump.aplicando_cambios', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name in ('actividades', 'albumes', 'videos') then
    v_publicado := old.estado = 'publicado' and new.estado = 'publicado'
      and (to_jsonb(new) - v_meta) is distinct from (to_jsonb(old) - v_meta);
  else
    v_padre := case when tg_op = 'DELETE' then
        (to_jsonb(old) ->> case when tg_table_name = 'album_fotos' then 'album_id' else 'actividad_id' end)::uuid
      else
        (to_jsonb(new) ->> case when tg_table_name = 'album_fotos' then 'album_id' else 'actividad_id' end)::uuid
      end;
    if tg_table_name = 'album_fotos' then
      select exists (select 1 from public.albumes where id = v_padre and estado = 'publicado') into v_publicado;
    else
      select exists (select 1 from public.actividades where id = v_padre and estado = 'publicado') into v_publicado;
    end if;
  end if;

  if v_publicado then
    raise exception 'Está publicado: los cambios quedan pendientes hasta revisar la vista previa y publicarlos'
      using errcode = 'P0001', hint = 'publicado_pendiente';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.proteger_publicado() from public, anon, authenticated;

create trigger actividades_proteger_publicado before update on public.actividades
  for each row execute function public.proteger_publicado();
create trigger albumes_proteger_publicado before update on public.albumes
  for each row execute function public.proteger_publicado();
create trigger videos_proteger_publicado before update on public.videos
  for each row execute function public.proteger_publicado();
create trigger actividad_secciones_proteger_publicado before insert or update or delete on public.actividad_secciones
  for each row execute function public.proteger_publicado();
create trigger actividad_enlaces_proteger_publicado before insert or update or delete on public.actividad_enlaces
  for each row execute function public.proteger_publicado();
create trigger actividad_fotos_proteger_publicado before insert or update or delete on public.actividad_fotos
  for each row execute function public.proteger_publicado();
create trigger album_fotos_proteger_publicado before insert or update or delete on public.album_fotos
  for each row execute function public.proteger_publicado();

-- -----------------------------------------------------------------------------
-- Aplicar datos (uso interno de guardar_* y publicar_cambios; respetan RLS)
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_actividad(p_id uuid, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_fotos uuid[];
  v_portada uuid := nullif(p_datos ->> 'portada_foto_id', '')::uuid;
begin
  select coalesce(array_agg((f ->> 'foto_id')::uuid order by o), '{}')
    into v_fotos from jsonb_array_elements(coalesce(p_datos -> 'fotos', '[]')) with ordinality as t(f, o);
  if v_portada is not null and not v_portada = any (v_fotos) then
    v_portada := null;
  end if;

  update public.actividades set
    titulo = p_datos ->> 'titulo',
    slug = p_datos ->> 'slug',
    tipo = p_datos ->> 'tipo',
    anio = (p_datos ->> 'anio')::smallint,
    fecha_inicio = nullif(p_datos ->> 'fecha_inicio', '')::date,
    fecha_precision = coalesce(nullif(p_datos ->> 'fecha_precision', ''), 'dia'),
    fecha_fin = nullif(p_datos ->> 'fecha_fin', '')::date,
    lugar = nullif(p_datos ->> 'lugar', ''),
    zona = nullif(p_datos ->> 'zona', ''),
    introduccion = nullif(p_datos ->> 'introduccion', ''),
    lema = nullif(p_datos ->> 'lema', ''),
    cita_texto = nullif(p_datos ->> 'cita_texto', ''),
    cita_referencia = nullif(p_datos ->> 'cita_referencia', ''),
    abreviatura = nullif(p_datos ->> 'abreviatura', ''),
    portada_foto_id = v_portada
  where id = p_id;
  if not found then
    raise exception 'Actividad no encontrada o sin permiso' using errcode = '42501';
  end if;

  delete from public.actividad_secciones where actividad_id = p_id;
  insert into public.actividad_secciones (actividad_id, titulo, contenido, orden)
  select p_id, s ->> 'titulo', coalesce(s -> 'contenido', '[]'), o
  from jsonb_array_elements(coalesce(p_datos -> 'secciones', '[]')) with ordinality as t(s, o);

  delete from public.actividad_enlaces where actividad_id = p_id;
  insert into public.actividad_enlaces (actividad_id, titulo, url, orden)
  select p_id, e ->> 'titulo', e ->> 'url', o
  from jsonb_array_elements(coalesce(p_datos -> 'enlaces', '[]')) with ordinality as t(e, o);

  -- Quitar una foto de la actividad no la borra de la biblioteca.
  delete from public.actividad_fotos where actividad_id = p_id and not (foto_id = any (v_fotos));
  update public.actividad_fotos set es_portada = false where actividad_id = p_id and es_portada;
  insert into public.actividad_fotos (actividad_id, foto_id, orden, es_portada)
  select p_id, f, o, coalesce(f = v_portada, false) from unnest(v_fotos) with ordinality as t(f, o)
  on conflict (actividad_id, foto_id) do update set orden = excluded.orden, es_portada = excluded.es_portada;
end;
$$;

create or replace function public.aplicar_album(p_id uuid, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_fotos uuid[];
  v_portada uuid := nullif(p_datos ->> 'portada_foto_id', '')::uuid;
begin
  select coalesce(array_agg((f ->> 'foto_id')::uuid order by o), '{}')
    into v_fotos from jsonb_array_elements(coalesce(p_datos -> 'fotos', '[]')) with ordinality as t(f, o);
  if v_portada is not null and not v_portada = any (v_fotos) then
    v_portada := null;
  end if;
  -- Primero se quitan las fotos que salen (así cambiar de actividad no choca con ellas).
  delete from public.album_fotos where album_id = p_id and not (foto_id = any (v_fotos));
  update public.albumes set
    titulo = p_datos ->> 'titulo',
    slug = p_datos ->> 'slug',
    descripcion = nullif(p_datos ->> 'descripcion', ''),
    anio = nullif(p_datos ->> 'anio', '')::smallint,
    pais = nullif(p_datos ->> 'pais', ''),
    ciudad = nullif(p_datos ->> 'ciudad', ''),
    actividad_id = nullif(p_datos ->> 'actividad_id', '')::uuid,
    portada_foto_id = v_portada
  where id = p_id;
  if not found then
    raise exception 'Álbum no encontrado o sin permiso' using errcode = '42501';
  end if;
  insert into public.album_fotos (album_id, foto_id, orden)
  select p_id, f, o from unnest(v_fotos) with ordinality as t(f, o)
  on conflict (album_id, foto_id) do update set orden = excluded.orden;
end;
$$;

create or replace function public.aplicar_video(p_id uuid, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.videos set
    url = p_datos ->> 'url',
    titulo = p_datos ->> 'titulo',
    descripcion = nullif(p_datos ->> 'descripcion', ''),
    album_id = nullif(p_datos ->> 'album_id', '')::uuid,
    actividad_id = nullif(p_datos ->> 'actividad_id', '')::uuid
  where id = p_id;
  if not found then
    raise exception 'Video no encontrado o sin permiso' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Guardar (actividad, álbum o video) en una sola transacción.
--  · Sin publicar: se aplica directo.
--  · Publicado: queda como cambio pendiente (el sitio no cambia). Destacar
--    en Inicio sí se aplica de inmediato (no es parte del contenido).
-- p_version: la versión que tenía el formulario; si otra persona guardó antes,
-- se rechaza (no se pisan cambios). Devuelve la versión nueva.
-- -----------------------------------------------------------------------------
create or replace function public.guardar_contenido(p_tipo text, p_id uuid, p_version timestamptz, p_datos jsonb)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
  v_actual timestamptz;
  v_cambios timestamptz;
  v_nueva timestamptz;
begin
  if p_tipo = 'actividad' then
    select estado::text, actualizado_en into v_estado, v_actual from public.actividades where id = p_id;
  elsif p_tipo = 'album' then
    select estado::text, actualizado_en into v_estado, v_actual from public.albumes where id = p_id;
  elsif p_tipo = 'video' then
    select estado::text, actualizado_en into v_estado, v_actual from public.videos where id = p_id;
  end if;
  if v_estado is null or not public.puede_editar_contenido(p_tipo) then
    raise exception 'No encontrado o sin permiso' using errcode = '42501';
  end if;
  select actualizado_en into v_cambios from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
  if date_trunc('milliseconds', coalesce(v_cambios, v_actual)) <> date_trunc('milliseconds', p_version) then
    raise exception 'Otra persona guardó cambios antes' using errcode = 'P0001', hint = 'conflicto';
  end if;

  if v_estado = 'publicado' then
    if p_tipo = 'actividad' and p_datos ? 'destacar_inicio' then
      update public.actividades set destacar_inicio = (p_datos ->> 'destacar_inicio')::boolean where id = p_id;
    end if;
    insert into public.contenido_cambios (tipo, registro_id, datos)
    values (p_tipo, p_id, p_datos - 'destacar_inicio')
    on conflict (tipo, registro_id) do update set datos = excluded.datos
    returning actualizado_en into v_nueva;
    return v_nueva;
  end if;

  if p_tipo = 'actividad' then
    perform public.aplicar_actividad(p_id, p_datos);
    update public.actividades set destacar_inicio = coalesce((p_datos ->> 'destacar_inicio')::boolean, false) where id = p_id
      returning actualizado_en into v_nueva;
  elsif p_tipo = 'album' then
    perform public.aplicar_album(p_id, p_datos);
    select actualizado_en into v_nueva from public.albumes where id = p_id;
  else
    perform public.aplicar_video(p_id, p_datos);
    select actualizado_en into v_nueva from public.videos where id = p_id;
  end if;
  return v_nueva;
end;
$$;

-- Publicar los cambios pendientes de algo ya publicado: exige que ESTA persona
-- haya visto la vista previa de esos cambios.
create or replace function public.publicar_cambios(p_tipo text, p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_datos jsonb;
begin
  select datos into v_datos from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
  if v_datos is null then
    raise exception 'No hay cambios pendientes' using errcode = 'P0001', hint = 'sin_cambios';
  end if;
  if not exists (
    select 1 from public.vistas_previas_contenido v
    where v.tipo = p_tipo and v.registro_id = p_id and v.user_id = auth.uid()
      and v.huella = public.huella_contenido(p_tipo, p_id)
  ) then
    raise exception 'Antes de publicar hay que revisar la vista previa de este contenido'
      using errcode = 'P0001', hint = 'vista_previa_pendiente';
  end if;
  perform set_config('jiump.aplicando_cambios', 'on', true);
  if p_tipo = 'actividad' then
    perform public.aplicar_actividad(p_id, v_datos);
  elsif p_tipo = 'album' then
    perform public.aplicar_album(p_id, v_datos);
  else
    perform public.aplicar_video(p_id, v_datos);
  end if;
  perform set_config('jiump.aplicando_cambios', 'off', true);
  delete from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
end;
$$;

-- Retirar del sitio: pasa a borrador y, si había cambios pendientes, quedan
-- aplicados en el borrador (no se pierden).
create or replace function public.despublicar_contenido(p_tipo text, p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_datos jsonb;
begin
  if p_tipo = 'actividad' then
    update public.actividades set estado = 'borrador' where id = p_id;
  elsif p_tipo = 'album' then
    update public.albumes set estado = 'borrador' where id = p_id;
  elsif p_tipo = 'video' then
    update public.videos set estado = 'borrador' where id = p_id;
  end if;
  if not found then
    raise exception 'No encontrado o sin permiso' using errcode = '42501';
  end if;
  select datos into v_datos from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
  if v_datos is not null then
    if p_tipo = 'actividad' then
      perform public.aplicar_actividad(p_id, v_datos);
    elsif p_tipo = 'album' then
      perform public.aplicar_album(p_id, v_datos);
    else
      perform public.aplicar_video(p_id, v_datos);
    end if;
    delete from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
  end if;
end;
$$;

revoke execute on function public.aplicar_actividad(uuid, jsonb) from public, anon;
revoke execute on function public.aplicar_album(uuid, jsonb) from public, anon;
revoke execute on function public.aplicar_video(uuid, jsonb) from public, anon;
revoke execute on function public.guardar_contenido(text, uuid, timestamptz, jsonb) from public, anon;
revoke execute on function public.publicar_cambios(text, uuid) from public, anon;
revoke execute on function public.despublicar_contenido(text, uuid) from public, anon;
grant execute on function public.aplicar_actividad(uuid, jsonb) to authenticated, service_role;
grant execute on function public.aplicar_album(uuid, jsonb) to authenticated, service_role;
grant execute on function public.aplicar_video(uuid, jsonb) to authenticated, service_role;
grant execute on function public.guardar_contenido(text, uuid, timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.publicar_cambios(text, uuid) to authenticated, service_role;
grant execute on function public.despublicar_contenido(text, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Dónde se usa cada foto
-- SECURITY DEFINER para que el aviso sea completo, pero el título de algo no
-- publicado solo se muestra a quien puede entrar a esa sección (si no,
-- «contenido de otra sección»). Solo para el equipo.
-- -----------------------------------------------------------------------------
create or replace function public.usos_fotos(p_ids uuid[])
returns table (foto_id uuid, tipo text, titulo text, publicado boolean, enlace text)
language sql
stable
security definer
set search_path = ''
as $$
  with usos as (
    -- Artículos (portada o imagen del cuerpo) y sus cambios sin publicar
    select f.id as foto_id, 'Artículo'::text as tipo, a.titulo, public.articulo_es_visible(a) as publicado,
           '/admin/articulos/' || a.id as enlace,
           public.tiene_algun_rol('superadmin', 'editor') as accesible
    from unnest(p_ids) f(id)
    join public.articulos a on a.portada_foto_id = f.id or a.cuerpo @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    union all
    select f.id, 'Artículo (cambios sin publicar)', a.titulo, false, '/admin/articulos/' || a.id,
           public.tiene_algun_rol('superadmin', 'editor')
    from unnest(p_ids) f(id)
    join public.articulo_cambios c on c.portada_foto_id = f.id or c.cuerpo @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    join public.articulos a on a.id = c.articulo_id
    -- Actividades
    union all
    select f.id, case when x.portada_foto_id = f.id then 'Portada de actividad' else 'Fotos de actividad' end,
           x.titulo, x.estado = 'publicado', '/admin/eventos/' || x.id,
           public.tiene_algun_rol('superadmin', 'eventos')
    from unnest(p_ids) f(id)
    join public.actividades x on x.portada_foto_id = f.id
      or exists (select 1 from public.actividad_fotos af where af.actividad_id = x.id and af.foto_id = f.id)
      or exists (select 1 from public.actividad_secciones s where s.actividad_id = x.id and s.contenido @? format('$.** ? (@ == "%s")', f.id)::jsonpath)
    -- Álbumes
    union all
    select f.id, case when al.portada_foto_id = f.id then 'Portada de álbum' else 'Álbum' end,
           al.titulo, al.estado = 'publicado', '/admin/galerias/' || al.id,
           public.tiene_algun_rol('superadmin', 'multimedia')
    from unnest(p_ids) f(id)
    join public.albumes al on al.portada_foto_id = f.id
      or exists (select 1 from public.album_fotos af where af.album_id = al.id and af.foto_id = f.id)
    -- Cambios sin publicar de actividades y álbumes ya publicados
    union all
    select f.id, case c.tipo when 'actividad' then 'Actividad (cambios sin publicar)' else 'Álbum (cambios sin publicar)' end,
           coalesce(x.titulo, al.titulo), false,
           case c.tipo when 'actividad' then '/admin/eventos/' else '/admin/galerias/' end || c.registro_id,
           public.puede_editar_contenido(c.tipo)
    from unnest(p_ids) f(id)
    join public.contenido_cambios c on c.tipo in ('actividad', 'album') and c.datos @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    left join public.actividades x on c.tipo = 'actividad' and x.id = c.registro_id
    left join public.albumes al on c.tipo = 'album' and al.id = c.registro_id
    -- Páginas del sitio y configuración
    union all
    select f.id, 'Página «' || p.titulo || '»', s.tipo, p.estado = 'publicado' and s.visible, null,
           public.tiene_rol('superadmin')
    from unnest(p_ids) f(id)
    join public.secciones s on s.contenido @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    join public.paginas p on p.id = s.pagina_id
    union all
    select f.id, 'Configuración del sitio',
           case when c.mantenimiento_foto_id = f.id then 'Foto de mantenimiento' else 'Foto para redes (SEO)' end, true, null,
           public.tiene_rol('superadmin')
    from unnest(p_ids) f(id)
    join public.configuracion c on c.seo_foto_id = f.id or c.mantenimiento_foto_id = f.id
  )
  -- El título se ve si la persona puede entrar a esa sección o si ya está
  -- publicado (es público); el enlace al panel, solo con acceso a la sección.
  select u.foto_id, u.tipo,
         case when u.accesible or u.publicado then u.titulo end,
         u.publicado,
         case when u.accesible then u.enlace end
  from usos u
  where public.es_equipo();
$$;
revoke execute on function public.usos_fotos(uuid[]) from public, anon;
grant execute on function public.usos_fotos(uuid[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Corrección: no se podía borrar la cuenta de alguien que creó contenido
-- Al borrar un usuario, la base pone «creado_por = null» en su contenido
-- (ON DELETE SET NULL), pero este trigger volvía a poner el valor anterior y
-- la referencia fallaba. Ahora, si quien actualiza NO es una persona del panel
-- (es la propia base aplicando el borrado), se acepta el valor vacío. Desde la
-- API, «creado_por» sigue sin poder cambiarse.
-- -----------------------------------------------------------------------------
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
    if not (new.creado_por is null and current_user not in ('authenticated', 'anon')) then
      new.creado_por := old.creado_por;
    end if;
    new.actualizado_en := now();
    if usuario is not null then
      new.actualizado_por := usuario;
    end if;
  end if;
  return new;
end;
$$;
