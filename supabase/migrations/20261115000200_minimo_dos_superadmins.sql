-- =============================================================================
-- Migración 11 · Al menos dos Superadministradores activos
--
-- Antes la base solo impedía quedarse SIN superadmin. Ahora impide quitar el
-- rol o desactivar a un superadmin activo si eso deja menos de dos activos.
-- Agregar nunca se bloquea: se puede partir de cero e ir sumando (el primero,
-- el segundo…). Una vez que hay dos, ya no se puede bajar de dos.
--
-- Si uno pierde su teléfono (su doble factor) o deja el equipo, el otro puede
-- seguir administrando usuarios y roles (supabase/README.md › «Alta de los
-- primeros superadmins»).
--
-- Los triggers son diferidos (al final de la transacción): así se puede
-- reemplazar a alguien (agregar uno nuevo y quitar el anterior) en una sola
-- operación.
-- =============================================================================

create or replace function public.proteger_ultimo_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  quedan int;
begin
  if tg_table_name = 'perfiles' then
    -- Desactivar a alguien que no es superadmin no cambia nada.
    if not exists (select 1 from public.perfil_roles pr where pr.perfil_id = old.id and pr.rol = 'superadmin') then
      return null;
    end if;
    v_perfil := old.id;
  else
    v_perfil := old.perfil_id;
    -- Quitar el rol a alguien desactivado no baja la cuenta de activos.
    if exists (select 1 from public.perfiles p where p.id = v_perfil and not p.activo) then
      return null;
    end if;
  end if;

  -- Al final de la transacción sigue siendo superadmin activo (p. ej. se
  -- quitó y se volvió a asignar el rol): no bajó nada.
  if exists (
    select 1 from public.perfil_roles pr join public.perfiles p on p.id = pr.perfil_id
    where p.id = v_perfil and p.activo and pr.rol = 'superadmin'
  ) then
    return null;
  end if;

  select count(*) into quedan
  from public.perfil_roles pr
  join public.perfiles p on p.id = pr.perfil_id
  where pr.rol = 'superadmin' and p.activo;

  if quedan < 2 then
    raise exception 'Deben quedar al menos dos Superadministradores activos'
      using errcode = 'check_violation',
            hint = 'minimo_superadmins',
            detail = format('Quedarían %s. Nombra otro Superadministrador antes de quitar este rol o desactivar a esta persona.', quedan);
  end if;
  return null;
end;
$$;
revoke execute on function public.proteger_ultimo_superadmin() from public, anon, authenticated;

comment on function public.proteger_ultimo_superadmin() is
  'Impide quitar el rol o desactivar a un superadmin activo si quedan menos de dos activos. Agregar nunca se bloquea.';
