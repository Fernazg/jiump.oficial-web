-- =============================================================================
-- JIUMP · Migración 10: panel /admin etapa 3 (página web, institucional,
-- usuarios y configuración)
--
--  · Cambios pendientes + vista previa obligatoria también para las páginas
--    (secciones y SEO), el menú/pie y los textos institucionales: el sitio no
--    cambia hasta revisar la vista previa y publicar (igual que el resto).
--  · usuarios_panel(): lista para «Usuarios y roles» (solo Superadmin), con el
--    estado del doble factor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Nuevos tipos de contenido con cambios pendientes y vista previa
-- «menu» e «institucional» son un solo conjunto cada uno: se identifican con
-- el registro 00000000-0000-0000-0000-000000000000.
-- -----------------------------------------------------------------------------
alter table public.contenido_cambios drop constraint contenido_cambios_tipo_check;
alter table public.contenido_cambios add constraint contenido_cambios_tipo_check
  check (tipo in ('actividad', 'album', 'video', 'pagina', 'menu', 'institucional'));
alter table public.vistas_previas_contenido drop constraint vistas_previas_contenido_tipo_check;
alter table public.vistas_previas_contenido add constraint vistas_previas_contenido_tipo_check
  check (tipo in ('actividad', 'album', 'video', 'pagina', 'menu', 'institucional'));

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
    when 'pagina' then public.tiene_rol('superadmin')
    when 'menu' then public.tiene_rol('superadmin')
    when 'institucional' then public.tiene_rol('superadmin')
    else false
  end;
$$;

-- Huella del contenido vigente: cambios pendientes si existen; si no, lo publicado.
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
    when 'pagina' then (
      select jsonb_build_object(
        'seo', jsonb_build_array(p.seo_titulo, p.seo_descripcion),
        'secciones', (select coalesce(jsonb_agg(jsonb_build_array(s.tipo, s.visible, s.contenido) order by s.orden, s.id), '[]') from public.secciones s where s.pagina_id = p.id)
      )::text from public.paginas p where p.id = p_id)
    when 'menu' then (
      select coalesce(jsonb_agg(jsonb_build_array(m.ubicacion, m.etiqueta, m.url, m.visible, m.orden) order by m.ubicacion, m.orden, m.id), '[]')::text
      from public.menu m)
    when 'institucional' then (
      select coalesce(jsonb_agg(jsonb_build_array(i.tipo, i.titulo, i.texto, i.orden, i.estado) order by i.tipo, i.orden, i.id), '[]')::text
      from public.institucional i)
  end, '')));
$$;

-- -----------------------------------------------------------------------------
-- Aplicar (uso interno de guardar_contenido y publicar_cambios; respetan RLS)
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_pagina(p_id uuid, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.paginas set
    seo_titulo = nullif(p_datos ->> 'seo_titulo', ''),
    seo_descripcion = nullif(p_datos ->> 'seo_descripcion', '')
  where id = p_id;
  if not found then
    raise exception 'Página no encontrada o sin permiso' using errcode = '42501';
  end if;
  delete from public.secciones where pagina_id = p_id;
  insert into public.secciones (pagina_id, tipo, visible, contenido, orden)
  select p_id, s ->> 'tipo', coalesce((s ->> 'visible')::boolean, true), coalesce(s -> 'contenido', '{}'), o
  from jsonb_array_elements(coalesce(p_datos -> 'secciones', '[]')) with ordinality as t(s, o);
end;
$$;

create or replace function public.aplicar_menu(p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.tiene_rol('superadmin') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.menu where true;
  insert into public.menu (ubicacion, etiqueta, url, visible, orden)
  select m ->> 'ubicacion', m ->> 'etiqueta', m ->> 'url', coalesce((m ->> 'visible')::boolean, true), o
  from jsonb_array_elements(coalesce(p_datos -> 'items', '[]')) with ordinality as t(m, o);
end;
$$;

-- Textos institucionales: se publican tal como JIUMP los entregó.
create or replace function public.aplicar_institucional(p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.tiene_rol('superadmin') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.institucional where true;
  insert into public.institucional (tipo, titulo, texto, orden, estado)
  select i ->> 'tipo', i ->> 'titulo', nullif(i ->> 'texto', ''), o, 'publicado'
  from jsonb_array_elements(coalesce(p_datos -> 'items', '[]')) with ordinality as t(i, o);
end;
$$;

-- -----------------------------------------------------------------------------
-- Guardar / publicar / retirar: se amplían a los nuevos tipos
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
  elsif p_tipo = 'pagina' then
    select estado::text, actualizado_en into v_estado, v_actual from public.paginas where id = p_id;
  elsif p_tipo in ('menu', 'institucional') and p_id = '00000000-0000-0000-0000-000000000000' then
    -- Siempre a la vista del público: lo editado queda pendiente.
    v_estado := 'publicado';
    v_actual := 'epoch';
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
  elsif p_tipo = 'video' then
    perform public.aplicar_video(p_id, p_datos);
    select actualizado_en into v_nueva from public.videos where id = p_id;
  else
    perform public.aplicar_pagina(p_id, p_datos);
    select actualizado_en into v_nueva from public.paginas where id = p_id;
  end if;
  return v_nueva;
end;
$$;

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
  case p_tipo
    when 'actividad' then perform public.aplicar_actividad(p_id, v_datos);
    when 'album' then perform public.aplicar_album(p_id, v_datos);
    when 'video' then perform public.aplicar_video(p_id, v_datos);
    when 'pagina' then perform public.aplicar_pagina(p_id, v_datos);
    when 'menu' then perform public.aplicar_menu(v_datos);
    when 'institucional' then perform public.aplicar_institucional(v_datos);
  end case;
  perform set_config('jiump.aplicando_cambios', 'off', true);
  delete from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
end;
$$;

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
  elsif p_tipo = 'pagina' then
    update public.paginas set estado = 'borrador' where id = p_id;
  end if;
  if not found then
    raise exception 'No encontrado o sin permiso' using errcode = '42501';
  end if;
  select datos into v_datos from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
  if v_datos is not null then
    case p_tipo
      when 'actividad' then perform public.aplicar_actividad(p_id, v_datos);
      when 'album' then perform public.aplicar_album(p_id, v_datos);
      when 'video' then perform public.aplicar_video(p_id, v_datos);
      when 'pagina' then perform public.aplicar_pagina(p_id, v_datos);
    end case;
    delete from public.contenido_cambios where tipo = p_tipo and registro_id = p_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vista previa obligatoria al publicar una página
-- -----------------------------------------------------------------------------
create or replace function public.exigir_vista_previa_contenido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text := case tg_table_name when 'actividades' then 'actividad' when 'albumes' then 'album' when 'paginas' then 'pagina' else 'video' end;
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

create trigger paginas_exigir_vista_previa
  before insert or update on public.paginas
  for each row execute function public.exigir_vista_previa_contenido();

-- -----------------------------------------------------------------------------
-- Lo publicado no se cambia directo: páginas publicadas (SEO y secciones),
-- menú y textos institucionales (siempre visibles para el público).
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
  v_fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if current_user <> 'authenticated' or coalesce(current_setting('jiump.aplicando_cambios', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name in ('menu', 'institucional') then
    v_publicado := true;
  elsif tg_table_name in ('actividades', 'albumes', 'videos', 'paginas') then
    v_publicado := old.estado = 'publicado' and new.estado = 'publicado'
      and (to_jsonb(new) - v_meta) is distinct from (to_jsonb(old) - v_meta);
  elsif tg_table_name = 'album_fotos' then
    v_padre := (v_fila ->> 'album_id')::uuid;
    select exists (select 1 from public.albumes where id = v_padre and estado = 'publicado') into v_publicado;
  elsif tg_table_name = 'secciones' then
    v_padre := (v_fila ->> 'pagina_id')::uuid;
    select exists (select 1 from public.paginas where id = v_padre and estado = 'publicado') into v_publicado;
  else
    v_padre := (v_fila ->> 'actividad_id')::uuid;
    select exists (select 1 from public.actividades where id = v_padre and estado = 'publicado') into v_publicado;
  end if;

  if v_publicado then
    raise exception 'Está publicado: los cambios quedan pendientes hasta revisar la vista previa y publicarlos'
      using errcode = 'P0001', hint = 'publicado_pendiente';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger paginas_proteger_publicado before update on public.paginas
  for each row execute function public.proteger_publicado();
create trigger secciones_proteger_publicado before insert or update or delete on public.secciones
  for each row execute function public.proteger_publicado();
create trigger menu_proteger_publicado before insert or update or delete on public.menu
  for each row execute function public.proteger_publicado();
create trigger institucional_proteger_publicado before insert or update or delete on public.institucional
  for each row execute function public.proteger_publicado();

revoke execute on function public.aplicar_pagina(uuid, jsonb) from public, anon;
revoke execute on function public.aplicar_menu(jsonb) from public, anon;
revoke execute on function public.aplicar_institucional(jsonb) from public, anon;
grant execute on function public.aplicar_pagina(uuid, jsonb) to authenticated, service_role;
grant execute on function public.aplicar_menu(jsonb) to authenticated, service_role;
grant execute on function public.aplicar_institucional(jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Usuarios y roles: lista para el Superadmin, con su doble factor
-- SECURITY DEFINER porque los factores están en auth.mfa_factors (no visible
-- por la API). Solo responde a un Superadmin con su rol vigente.
-- «superadmin_vigente»: el rol cuenta (factor inscrito ANTES de recibirlo).
-- -----------------------------------------------------------------------------
create or replace function public.usuarios_panel()
returns table (
  perfil_id uuid, user_id uuid, nombre text, correo text, activo boolean, ultimo_ingreso timestamptz,
  roles public.rol_app[], doble_factor boolean, superadmin_vigente boolean, invitacion_pendiente boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.user_id, p.nombre, p.correo, p.activo, p.ultimo_ingreso,
         coalesce((select array_agg(pr.rol order by pr.rol) from public.perfil_roles pr where pr.perfil_id = p.id), '{}'),
         exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified'),
         exists (
           select 1 from public.perfil_roles pr
           join auth.mfa_factors f on f.user_id = p.user_id and f.status = 'verified' and f.created_at <= pr.creado_en
           where pr.perfil_id = p.id and pr.rol = 'superadmin'
         ),
         exists (select 1 from auth.users u where u.id = p.user_id and u.invited_at is not null and u.last_sign_in_at is null)
  from public.perfiles p
  where public.tiene_rol('superadmin')
  order by p.activo desc, p.nombre, p.correo;
$$;
revoke execute on function public.usuarios_panel() from public, anon;
grant execute on function public.usuarios_panel() to authenticated, service_role;
