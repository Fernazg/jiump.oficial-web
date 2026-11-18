-- =============================================================================
-- Permisos explícitos para anon, authenticated y service_role (esquema public)
--
-- El proyecto de producción se creó con «exponer automáticamente nuevas tablas»
-- desactivado: anon y authenticated no recibieron ningún GRANT sobre lo que
-- crearon las migraciones, que hasta ahora solo revocaban (el sitio fallaba con
-- «permission denied for table menu»). En la base local, Supabase sí los da
-- por defecto.
--
-- Esta migración deja los permisos EXACTAMENTE iguales a los efectivos de la
-- base local con todas las migraciones anteriores aplicadas, sin depender de
-- los privilegios por defecto del proyecto:
--   · por cada tabla y función: quita todo a los tres roles y otorga lo que
--     tienen en local. Así se respetan todos los REVOKE anteriores (por
--     ejemplo, el visitante solo lee columnas públicas y no ejecuta funciones
--     internas).
--   · no toca PUBLIC, la RLS ni los dueños. La RLS sigue decidiendo qué filas
--     ve cada uno.
--
-- Generada con supabase/scripts/generar-permisos.sql desde la base local.
-- La prueba supabase/tests/permisos/probar-permisos.sh comprueba que todas las
-- migraciones, aplicadas sobre una base SIN permisos por defecto (supabase/roles.sql),
-- dejan exactamente los de supabase/tests/permisos/esperados.tsv.
--
-- Una tabla o función nueva en una migración futura debe incluir sus GRANT
-- explícitos: la prueba falla si faltan.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;
revoke all on table public.actividad_enlaces from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividad_enlaces to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividad_enlaces to service_role;
grant select (id, actividad_id, url, titulo, orden, creado_en, actualizado_en) on table public.actividad_enlaces to anon;
revoke all on table public.actividad_fotos from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividad_fotos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividad_fotos to service_role;
grant select (actividad_id, foto_id, orden, es_portada) on table public.actividad_fotos to anon;
revoke all on table public.actividad_secciones from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividad_secciones to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividad_secciones to service_role;
grant select (id, actividad_id, titulo, contenido, orden, creado_en, actualizado_en) on table public.actividad_secciones to anon;
revoke all on table public.actividades from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividades to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.actividades to service_role;
grant select (id, titulo, slug, tipo, anio, fecha_inicio, fecha_precision, fecha_fin, lugar, zona, introduccion, portada_foto_id, estado, destacar_inicio, orden_inicio, es_proximo, creado_en, actualizado_en, lema, cita_texto, cita_referencia, abreviatura) on table public.actividades to anon;
revoke all on table public.album_fotos from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.album_fotos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.album_fotos to service_role;
grant select (album_id, foto_id, orden) on table public.album_fotos to anon;
revoke all on table public.albumes from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.albumes to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.albumes to service_role;
grant select (id, titulo, slug, descripcion, anio, pais, ciudad, actividad_id, portada_foto_id, estado, orden, creado_en, actualizado_en) on table public.albumes to anon;
revoke all on table public.articulo_cambios from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_cambios to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_cambios to service_role;
revoke all on table public.articulo_presencia from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_presencia to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_presencia to service_role;
revoke all on table public.articulo_temas from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_temas to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_temas to service_role;
grant select (articulo_id, tema_id) on table public.articulo_temas to anon;
revoke all on table public.articulo_versiones from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_versiones to service_role;
grant maintain, references, select, trigger on table public.articulo_versiones to authenticated;
revoke all on table public.articulo_vistas_previas from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_vistas_previas to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulo_vistas_previas to service_role;
revoke all on table public.articulos from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.articulos to service_role;
grant select (id, titulo, slug, bajada, autor, serie_id, parte, portada_foto_id, cuerpo, estado, publicar_en, publicado_en, destacado_inicio, minutos_lectura, busqueda, creado_en, actualizado_en) on table public.articulos to anon;
revoke all on table public.configuracion from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.configuracion to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.configuracion to service_role;
grant select (id, modo_mantenimiento, instagram_url, mostrar_barra_proximo_evento, seo_titulo, seo_descripcion, seo_foto_id, creado_en, actualizado_en, mantenimiento_foto_id) on table public.configuracion to anon;
revoke all on table public.contenido_cambios from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.contenido_cambios to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.contenido_cambios to service_role;
revoke all on table public.fotos from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.fotos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.fotos to service_role;
grant select (id, archivo, ancho, alto, texto_alternativo, credito, creado_en, actualizado_en, anchos) on table public.fotos to anon;
revoke all on table public.institucional from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.institucional to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.institucional to service_role;
grant select (id, tipo, titulo, texto, orden, estado, creado_en, actualizado_en) on table public.institucional to anon;
revoke all on table public.menu from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.menu to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.menu to service_role;
grant select (id, ubicacion, etiqueta, url, orden, visible, creado_en, actualizado_en) on table public.menu to anon;
revoke all on table public.paginas from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.paginas to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.paginas to service_role;
grant select (id, clave, titulo, estado, seo_titulo, seo_descripcion, creado_en, actualizado_en) on table public.paginas to anon;
revoke all on table public.perfil_roles from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate on table public.perfil_roles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.perfil_roles to service_role;
revoke all on table public.perfiles from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.perfiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.perfiles to service_role;
revoke all on table public.redirecciones from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.redirecciones to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.redirecciones to service_role;
grant select (id, origen, destino, codigo, creado_en, actualizado_en) on table public.redirecciones to anon;
revoke all on table public.registro_actividad from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.registro_actividad to service_role;
grant maintain, references, select, trigger on table public.registro_actividad to authenticated;
revoke all on table public.secciones from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.secciones to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.secciones to service_role;
grant select (id, pagina_id, tipo, orden, visible, contenido, creado_en, actualizado_en) on table public.secciones to anon;
revoke all on table public.series from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.series to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.series to service_role;
grant select (id, nombre, slug, descripcion, tipo, mes, color, icono, orden, creado_en, actualizado_en) on table public.series to anon;
revoke all on table public.temas from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.temas to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.temas to service_role;
grant select (id, nombre, slug, creado_en, actualizado_en) on table public.temas to anon;
revoke all on table public.version_sitio from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.version_sitio to service_role;
revoke all on table public.videos from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.videos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.videos to service_role;
grant select (id, url, titulo, descripcion, album_id, actividad_id, estado, orden, creado_en, actualizado_en) on table public.videos to anon;
revoke all on table public.vistas_previas_contenido from anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.vistas_previas_contenido to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.vistas_previas_contenido to service_role;
revoke all on function public.aplicar_actividad(p_id uuid, p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.aplicar_actividad(p_id uuid, p_datos jsonb) to authenticated, service_role;
revoke all on function public.aplicar_album(p_id uuid, p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.aplicar_album(p_id uuid, p_datos jsonb) to authenticated, service_role;
revoke all on function public.aplicar_estado_activo() from anon, authenticated, service_role;
grant execute on function public.aplicar_estado_activo() to service_role;
revoke all on function public.aplicar_institucional(p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.aplicar_institucional(p_datos jsonb) to authenticated, service_role;
revoke all on function public.aplicar_menu(p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.aplicar_menu(p_datos jsonb) to authenticated, service_role;
revoke all on function public.aplicar_pagina(p_id uuid, p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.aplicar_pagina(p_id uuid, p_datos jsonb) to authenticated, service_role;
revoke all on function public.aplicar_video(p_id uuid, p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.aplicar_video(p_id uuid, p_datos jsonb) to authenticated, service_role;
revoke all on function public.articulo_es_visible(a articulos) from anon, authenticated, service_role;
grant execute on function public.articulo_es_visible(a articulos) to anon, authenticated, service_role;
revoke all on function public.buscar_articulos(q text) from anon, authenticated, service_role;
grant execute on function public.buscar_articulos(q text) to anon, authenticated, service_role;
revoke all on function public.crear_perfil_para_usuario() from anon, authenticated, service_role;
grant execute on function public.crear_perfil_para_usuario() to service_role;
revoke all on function public.despublicar_contenido(p_tipo text, p_id uuid) from anon, authenticated, service_role;
grant execute on function public.despublicar_contenido(p_tipo text, p_id uuid) to authenticated, service_role;
revoke all on function public.es_equipo() from anon, authenticated, service_role;
grant execute on function public.es_equipo() to anon, authenticated, service_role;
revoke all on function public.es_slug_valido(s text) from anon, authenticated, service_role;
grant execute on function public.es_slug_valido(s text) to anon, authenticated, service_role;
revoke all on function public.estado_sitio(p_rutas text[]) from anon, authenticated, service_role;
grant execute on function public.estado_sitio(p_rutas text[]) to anon, authenticated, service_role;
revoke all on function public.exigir_vista_previa() from anon, authenticated, service_role;
grant execute on function public.exigir_vista_previa() to service_role;
revoke all on function public.exigir_vista_previa_contenido() from anon, authenticated, service_role;
grant execute on function public.exigir_vista_previa_contenido() to service_role;
revoke all on function public.fijar_columnas_comunes() from anon, authenticated, service_role;
grant execute on function public.fijar_columnas_comunes() to service_role;
revoke all on function public.fijar_creado_por_rol() from anon, authenticated, service_role;
grant execute on function public.fijar_creado_por_rol() to service_role;
revoke all on function public.foto_es_publica(p_foto_id uuid) from anon, authenticated, service_role;
grant execute on function public.foto_es_publica(p_foto_id uuid) to anon, authenticated, service_role;
revoke all on function public.guardar_contenido(p_tipo text, p_id uuid, p_version timestamp with time zone, p_datos jsonb) from anon, authenticated, service_role;
grant execute on function public.guardar_contenido(p_tipo text, p_id uuid, p_version timestamp with time zone, p_datos jsonb) to authenticated, service_role;
revoke all on function public.guardar_version_articulo() from anon, authenticated, service_role;
grant execute on function public.guardar_version_articulo() to service_role;
revoke all on function public.huella_articulo(p_titulo text, p_bajada text, p_autor text, p_serie_id uuid, p_parte smallint, p_portada_foto_id uuid, p_cuerpo jsonb) from anon, authenticated, service_role;
grant execute on function public.huella_articulo(p_titulo text, p_bajada text, p_autor text, p_serie_id uuid, p_parte smallint, p_portada_foto_id uuid, p_cuerpo jsonb) to authenticated, service_role;
revoke all on function public.huella_contenido(p_tipo text, p_id uuid) from anon, authenticated, service_role;
grant execute on function public.huella_contenido(p_tipo text, p_id uuid) to authenticated, service_role;
revoke all on function public.huella_vigente_articulo(p_articulo_id uuid) from anon, authenticated, service_role;
grant execute on function public.huella_vigente_articulo(p_articulo_id uuid) to authenticated, service_role;
revoke all on function public.marcar_proximo(p_actividad_id uuid, p_valor boolean) from anon, authenticated, service_role;
grant execute on function public.marcar_proximo(p_actividad_id uuid, p_valor boolean) to authenticated, service_role;
revoke all on function public.mi_acceso() from anon, authenticated, service_role;
grant execute on function public.mi_acceso() to authenticated, service_role;
revoke all on function public.mis_roles() from anon, authenticated, service_role;
grant execute on function public.mis_roles() to authenticated, service_role;
revoke all on function public.objeto_foto_es_publico(p_nombre text) from anon, authenticated, service_role;
grant execute on function public.objeto_foto_es_publico(p_nombre text) to anon, authenticated, service_role;
revoke all on function public.preparar_articulo() from anon, authenticated, service_role;
grant execute on function public.preparar_articulo() to service_role;
revoke all on function public.proteger_archivo_foto() from anon, authenticated, service_role;
grant execute on function public.proteger_archivo_foto() to service_role;
revoke all on function public.proteger_publicado() from anon, authenticated, service_role;
grant execute on function public.proteger_publicado() to service_role;
revoke all on function public.proteger_ultimo_superadmin() from anon, authenticated, service_role;
grant execute on function public.proteger_ultimo_superadmin() to service_role;
revoke all on function public.publicar_cambios(p_tipo text, p_id uuid) from anon, authenticated, service_role;
grant execute on function public.publicar_cambios(p_tipo text, p_id uuid) to authenticated, service_role;
revoke all on function public.puede_editar_contenido(p_tipo text) from anon, authenticated, service_role;
grant execute on function public.puede_editar_contenido(p_tipo text) to authenticated, service_role;
revoke all on function public.purgar_papelera_articulos() from anon, authenticated, service_role;
grant execute on function public.purgar_papelera_articulos() to service_role;
revoke all on function public.registrar_actividad() from anon, authenticated, service_role;
grant execute on function public.registrar_actividad() to service_role;
revoke all on function public.restaurar_articulo(p_articulo_id uuid) from anon, authenticated, service_role;
grant execute on function public.restaurar_articulo(p_articulo_id uuid) to authenticated, service_role;
revoke all on function public.sin_tildes(texto text) from anon, authenticated, service_role;
grant execute on function public.sin_tildes(texto text) to anon, authenticated, service_role;
revoke all on function public.sincronizar_ingreso_usuario() from anon, authenticated, service_role;
grant execute on function public.sincronizar_ingreso_usuario() to service_role;
revoke all on function public.subir_version_sitio() from anon, authenticated, service_role;
grant execute on function public.subir_version_sitio() to service_role;
revoke all on function public.texto_de_bloques(cuerpo jsonb) from anon, authenticated, service_role;
grant execute on function public.texto_de_bloques(cuerpo jsonb) to anon, authenticated, service_role;
revoke all on function public.tiene_algun_rol(VARIADIC roles rol_app[]) from anon, authenticated, service_role;
grant execute on function public.tiene_algun_rol(VARIADIC roles rol_app[]) to anon, authenticated, service_role;
revoke all on function public.tiene_rol(r rol_app) from anon, authenticated, service_role;
grant execute on function public.tiene_rol(r rol_app) to anon, authenticated, service_role;
revoke all on function public.usos_fotos(p_ids uuid[]) from anon, authenticated, service_role;
grant execute on function public.usos_fotos(p_ids uuid[]) to authenticated, service_role;
revoke all on function public.usuarios_panel() from anon, authenticated, service_role;
grant execute on function public.usuarios_panel() to authenticated, service_role;
revoke all on function public.validar_un_evento_por_foto() from anon, authenticated, service_role;
grant execute on function public.validar_un_evento_por_foto() to service_role;
