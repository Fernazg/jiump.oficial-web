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

Formato que usa el sitio (`app/src/lib/tipos.ts`). `cuerpo` es una lista de bloques; las negritas van entre `**…**`:

| Tipo | Campos |
|---|---|
| `parrafo`, `entradilla`, `titulo_seccion`, `pregunta_destacada` | `texto` |
| `versiculo` | `texto`, `referencia`, `etiqueta` (opcional) |
| `idea_clave`, `para_recordar` | `texto`, `etiqueta` (opcional) |
| `lista_numerada` | `items: [texto]` |
| `tarjetas` | `titulo` (opcional), `items: [texto]` |
| `linea_tiempo` | `items: [{ fecha, texto }]` |
| `cifras` | `items: [{ valor, texto }]` |
| `imagen` | `foto_id`, `pie` (opcional) — solo se muestra si la foto es pública |
| `video` | `url` (YouTube), `titulo` (opcional) |

Un tipo desconocido no se muestra. `actividad_secciones.contenido` usa los mismos bloques.

### Contenido de las secciones de página (`secciones.contenido`)
Lo que lee hoy el sitio (Inicio y Nosotros). Si falta un campo, ese elemento no se muestra:

| `tipo` | Campos |
|---|---|
| `portada` | `foto_id`, `titulo` (opcional; si falta, Inicio usa el nombre del movimiento) |
| `presentacion` | `etiqueta`, `texto` (las cifras salen de `institucional`, tipo `cifra`: título = valor, texto = descripción) |
| `que_hacemos` | `etiqueta`, `titulo`, `enlace: { texto, url }`, `tarjetas: [{ titulo, foto_id }]` |
| `destacado` («Heme aquí») | `etiqueta`, `titulo`, `texto`, `boton: { texto, url }`, `fotos: [foto_id]` |

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

## Cambios en la implementación (`supabase/migrations/`)

La propuesta de arriba se implementó con estos ajustes (validar con la directiva):

**Columnas y reglas agregadas**
- **perfil_roles:** guarda `creado_en` (cuándo se asignó el rol), que usa la regla del doble factor. Un rol solo se asigna o se quita; no se edita.
- **registro_actividad:** también guarda `user_id`. Acciones: `crear`, `editar`, `publicar`, `papelera`, `restaurar`, `eliminar`, `asignar_rol`, `quitar_rol`. Lo llenan triggers; nadie lo puede editar ni borrar.
- **articulos:**
  - `estado_antes_papelera` y `en_papelera_desde`, para restaurar y vaciar la papelera a los 30 días.
  - Columna `busqueda` (índice de texto en español, sin tildes).
  - Un artículo `programado` se vuelve público solo cuando llega `publicar_en`.
  - No se repite el n.º de `parte` dentro de una serie.
- **articulo_versiones:** guarda título, bajada, autor, serie, parte, portada, cuerpo y estado de cada versión anterior (`guardado_en`, `guardado_por`).
- **actividades:**
  - `anio` obligatorio y `fecha_inicio` opcional.
  - `fecha_precision` (`dia` | `mes`) para cuando solo se conoce mes y año.
  - Solo una actividad puede tener `es_proximo`.
- **actividad_secciones:** `titulo` + `contenido jsonb`.
- **actividad_enlaces:** `orden`; solo URL `https://`.
- **actividad_fotos:** a lo más una `es_portada` por actividad.
- **albumes y videos:** `orden`. Los videos solo aceptan enlaces de YouTube.
- **fotos:**
  - `creado_por` cumple el papel de `subida_por`.
  - `archivo` debe tener la forma `<carpeta>/<nombre>.<jpg|jpeg|png|webp|avif>` y no se puede cambiar: para reemplazar una foto se sube una nueva.
  - Quien sube registra fotos solo dentro de su propia carpeta.
- **paginas:** `seo_titulo` y `seo_descripcion`.
- **institucional:** `tipo` (`identidad`, `quienes_somos`, `declaracion_fe`, `cifra`, `vision`, `historia`), `orden` y `estado`. Queda vacía hasta que JIUMP entregue los textos oficiales.
- **menu:** `ubicacion` (`principal` | `pie`), `etiqueta`, `url`, `orden`, `visible`.
- **configuracion:** fila única; agrega `seo_titulo`, `seo_descripcion` y `seo_foto_id`.
- **redirecciones:** `codigo` (301, 302 o 308) y validación de que origen ≠ destino.
- **Todas las tablas:** `creado_por` y `actualizado_por` los fija el servidor; el cliente no puede falsificarlos.

**Visibilidad pública**
- El visitante ve solo artículos publicados (o programados cuya fecha ya llegó), actividades, álbumes, videos, páginas y textos institucionales publicados, secciones visibles de páginas publicadas y enlaces visibles del menú.
- Series y temas: solo los que tienen al menos un artículo visible.
- Fotos: solo las usadas en contenido publicado.

**Fotos (Storage)**
- Bucket `fotos` **privado**. El sitio muestra las fotos con URL firmadas; solo se pueden firmar las fotos usadas en contenido publicado.
- Cada archivo vive en la carpeta de quien lo subió (`<user_id>/<uuid>.<ext>`), con versiones optimizadas en `<user_id>/<uuid>/<ancho>.webp`.
- Solo JPEG, PNG, WebP y AVIF, hasta 10 MB. Las transformaciones de imagen de Supabase son de pago, así que las versiones las genera la app al subir.
