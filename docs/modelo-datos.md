# Modelo de datos (propuesta para validar)

Derivado del diseño aprobado del sitio y del panel /admin. Nombres en español para que la directiva pueda leerlo. Todas las tablas llevan `id uuid`, `creado_en`, `actualizado_en`, `creado_por`, `actualizado_por`.

## Usuarios y acceso
- **perfiles** — `user_id` (auth.users), `nombre`, `correo`, `activo`, `ultimo_ingreso`.
- **perfil_roles** — `perfil_id`, `rol` (`superadmin` | `editor` | `eventos` | `multimedia`).
- **registro_actividad** — `perfil_id`, `accion`, `tabla`, `registro_id`, `detalle jsonb`, `fecha`.

## Artículos
- **series** — `nombre`, `slug`, `descripcion`, `tipo` (`mes` | `tematica`), `mes` (opcional), `color` (`azul` | `rojo` | `neutro`), `icono`, `orden`.
  Ej.: «Septiembre · Mes de la Biblia», «Octubre · Mes de la Reforma», «Los Atributos de Dios».
- **temas** — etiquetas (ej.: «Teología para todos», «Problemáticas juveniles»).
- **articulos** — `titulo`, `slug`, `bajada`, `autor` (texto; pendiente de datos), `serie_id`, `parte` (n.º dentro de la serie), `portada_foto_id`, `cuerpo jsonb` (bloques), `estado` (`borrador` | `revision` | `programado` | `publicado` | `papelera`), `publicar_en`, `publicado_en`, `destacado_inicio bool`, `minutos_lectura` (calculado).
- **articulo_temas** — relación N:N.
- **articulo_versiones** — historial para «Restaurar una versión».

### Bloques del cuerpo (`cuerpo jsonb`)
Tipos usados en el diseño: `parrafo` (con negritas), `entradilla`, `titulo_seccion`, `pregunta_destacada`, `versiculo` (texto + referencia + etiqueta), `idea_clave` (texto + etiqueta), `para_recordar`, `lista_numerada`, `tarjetas` (título + ítems), `linea_tiempo`, `cifras`, `imagen`, `video`.
Las referencias bíblicas dentro del texto se resaltan automáticamente.

## Eventos y actividades
- **actividades** — `titulo`, `slug`, `tipo` (convención, encuentro, zonal, formación, mujeres…), `fecha_inicio` (puede ser solo mes y año), `fecha_fin`, `lugar` (opcional), `zona` (opcional), `introduccion` (texto oficial), `portada_foto_id`, `estado`, `destacar_inicio bool`, `orden_inicio`, `es_proximo bool` (alimenta la barra y el bloque «Próximo evento»).
- **actividad_secciones** — bloques editables de la página de la actividad (ej.: Día 1 / Día 2), `orden`.
- **actividad_enlaces** — videos y transmisiones (`url`, `titulo`).

## Fotos, álbumes y videos
- **fotos** — `archivo` (ruta en Storage), `ancho`, `alto`, `texto_alternativo` (obligatorio), `credito`, `subida_por`.
- **albumes** — `titulo`, `slug`, `descripcion`, `anio` (opcional), `pais`/`ciudad` (opcional), `actividad_id` (opcional), `portada_foto_id`, `estado`.
- **album_fotos** — `album_id`, `foto_id`, `orden`.
- **actividad_fotos** — `actividad_id`, `foto_id`, `orden`, `es_portada`.
- **videos** — `url` (YouTube), `titulo`, `descripcion`, `album_id` / `actividad_id` (opcional), `estado`.

## Páginas y configuración del sitio
- **paginas** — `clave` (`inicio`, `nosotros`, `eventos`, `articulos`, `galeria`…), `titulo`, `estado`.
- **secciones** — `pagina_id`, `tipo` (portada, presentacion, que_hacemos, heme_aqui, actividades_destacadas, eventos, articulos_recientes, momentos, que_creemos, identidad…), `orden`, `visible`, `contenido jsonb` (textos, botones, fotos, tarjetas).
- **institucional** — identidad, «Quiénes somos», declaraciones de fe (`titulo`, `texto`), cifras (+2.000, 50 años, Chile y Argentina).
- **menu** — enlaces del menú principal y del pie.
- **configuracion** — `modo_mantenimiento bool`, `instagram_url`, `mostrar_barra_proximo_evento bool`, metadatos SEO por defecto.

## Notas
- Slugs únicos por tabla; redirecciones 301 desde las URL antiguas de Wix (tabla **redirecciones**: `origen`, `destino`).
- Fotos: optimizar al subir (WebP/AVIF, varios tamaños). Nunca recortar ni retocar el original.
- Búsqueda de artículos: índice de texto completo en español sobre `titulo`, `bajada` y texto del cuerpo.
