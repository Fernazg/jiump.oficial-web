-- =============================================================================
-- JIUMP · Migración 7: campos opcionales de actividades y foto de mantenimiento
-- Decisiones de la directiva (PR #2). Todos los campos nacen vacíos: se
-- completan desde el panel con datos oficiales; nunca se inventan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Actividades: lema, cita bíblica (texto + referencia) y abreviatura
-- Ej. del diseño: lema «Heme aquí», cita «1 Samuel 3:8», abreviatura «EMJ».
-- -----------------------------------------------------------------------------
alter table public.actividades
  add column lema text,
  add column cita_texto text,
  add column cita_referencia text,
  add column abreviatura text;

alter table public.actividades
  add constraint actividades_lema_no_vacio check (lema is null or length(btrim(lema)) between 1 and 80),
  add constraint actividades_cita_referencia_no_vacia check (cita_referencia is null or length(btrim(cita_referencia)) between 1 and 60),
  -- Un texto de cita siempre va con su referencia (no se muestran citas sin fuente).
  add constraint actividades_cita_con_referencia check (cita_texto is null or cita_referencia is not null),
  add constraint actividades_abreviatura_valida check (abreviatura is null or abreviatura ~ '^[A-ZÁÉÍÓÚÑ0-9]{2,10}$');

comment on column public.actividades.lema is 'Lema de la actividad (ej.: «Heme aquí»). Opcional.';
comment on column public.actividades.cita_texto is 'Texto del versículo de la actividad. Opcional; exige cita_referencia.';
comment on column public.actividades.cita_referencia is 'Referencia bíblica (ej.: «1 Samuel 3:8»). Opcional.';
comment on column public.actividades.abreviatura is 'Sigla en mayúsculas para etiquetas (ej.: EMJ, EJZ, FEDI). Opcional.';

-- -----------------------------------------------------------------------------
-- Configuración: foto de la página de mantenimiento
-- -----------------------------------------------------------------------------
alter table public.configuracion
  add column mantenimiento_foto_id uuid references public.fotos (id) on delete set null;

comment on column public.configuracion.mantenimiento_foto_id is 'Foto de la página de mantenimiento. Opcional.';

-- La foto de mantenimiento (y la de SEO) cuentan como «en uso público», para
-- que el visitante pueda verla y firmar su URL. Mismo cuerpo que antes + esta
-- columna; create or replace conserva los privilegios de la función.
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
    or exists (select 1 from public.configuracion c
                where c.seo_foto_id = p_foto_id or c.mantenimiento_foto_id = p_foto_id);
$$;
