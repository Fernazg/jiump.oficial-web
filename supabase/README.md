# Supabase

Base de datos, acceso y archivos del sitio JIUMP. Basado en `docs/modelo-datos.md` y `docs/roles-permisos.md`.

```
config.toml                 Configuración del entorno local (sin claves)
migrations/
  …0100_base_usuarios_roles  Perfiles, roles, tiene_rol(), registro de actividad
  …0200_contenido            Fotos, artículos, actividades, álbumes, videos, páginas, configuración
  …0300_politicas_rls        Row Level Security según la matriz de roles
  …0400_storage_fotos        Bucket «fotos» y sus políticas
  …0500_datos_base           Configuración, páginas y menú del diseño (sin textos institucionales)
  …0600_seguridad            Correcciones de la revisión de seguridad (ver «Revisión de seguridad»)
  …0700_actividades_y_mantenimiento  Lema, cita y abreviatura de actividades; foto de mantenimiento
  …0800_panel_admin          Panel: mi_acceso(), vista previa obligatoria, cambios pendientes, presencia y papelera automática
  …0900_fotos_y_eventos      Panel etapa 2: versiones de fotos, regla 2, usos de fotos, vista previa de actividades/álbumes/videos, próximo evento
seed.sql                    Datos de prueba SOLO para desarrollo local
scripts/subir-fotos-diseno.sh   Sube design/fotos/ al Storage local
tests/database/permisos.test.sql    pgTAP: reglas del modelo y permisos por rol (86)
tests/database/seguridad.test.sql   pgTAP: revisión de seguridad, matriz completa y bucket (562)
tests/database/actividades_mantenimiento.test.sql   pgTAP: campos de la migración 7 (20)
tests/database/panel_admin.test.sql   pgTAP: migración 8 (28)
tests/database/fotos_eventos.test.sql pgTAP: migración 9 (45)
tests/api/                  Prueba de integración HTTP: login, 2FA, sesiones, REST y Storage (9)
```

## Uso local

Requiere Docker y la CLI de Supabase (`npx supabase …`). Todo corre en tu equipo; no usa servicios pagados.

```bash
npx supabase start
```

```bash
npx supabase db reset
```

```bash
eval "$(npx supabase status -o env)" && SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY supabase/scripts/subir-fotos-diseno.sh
```

```bash
npx supabase test db
```

```bash
eval "$(npx supabase status -o env)" && API_URL=$API_URL ANON_KEY=$ANON_KEY SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY node --test supabase/tests/api/permisos-api.test.mjs
```

Las claves locales las entrega `supabase status`; **nunca** se copian al repositorio. La app usará variables de entorno (`.env.local`, ignorado por git).

## Decisiones de implementación

**Roles y permisos**
- `perfiles` se crea solo al crear la cuenta en `auth.users`. El registro público está desactivado (`enable_signup = false`): un superadmin invita a cada persona desde el servidor.
- `tiene_rol(r)` y `tiene_algun_rol(...)` (`SECURITY DEFINER`) se usan en todas las políticas. Una persona puede tener varios roles. Un rol cuenta solo si el perfil está activo **y** la sesión del token sigue abierta en `auth.sessions`: cerrar sesión o desactivar a alguien corta el acceso al instante.
- **Doble factor obligatorio para Superadministrador, validado en la base de datos:** el rol `superadmin` solo cuenta en una sesión aal2 verificada con un factor TOTP **inscrito antes de recibir el rol** (ver «Alta de los primeros superadmins»). `mis_roles()` sí informa el rol, para que el panel pida el segundo factor.
- Desactivar a alguien (`perfiles.activo = false`) cierra todas sus sesiones y le bloquea el inicio de sesión; reactivarlo lo desbloquea.
- No se puede quitar ni desactivar al último superadmin activo. Los roles se asignan o se quitan, no se editan.
- Cada persona ve solo su propio perfil y sus roles; solo el superadmin ve los de todos.
- ◐ Editor y Eventos suben fotos a su propia carpeta y las usan en su contenido, pero solo editan o borran **las propias** (`fotos.creado_por`, `storage.objects.owner_id`). Superadmin y Multimedia gestionan todas.
- Multimedia no ve actividades en borrador ni gestiona sus fotos (es sección de Eventos); puede vincular álbumes y videos a actividades publicadas.
- El visitante anónimo no puede escribir en ninguna tabla ni leer perfiles, roles, versiones o el registro. Las tablas y funciones nuevas nacen sin privilegios para él.

**Contenido**
- Columnas comunes en todas las tablas; `creado_por` y `actualizado_por` los fija un trigger (el cliente no puede falsificarlos). `fotos.creado_por` es el «subida_por» de la propuesta.
- **Registro de actividad** automático por trigger: crear, editar, publicar, papelera, restaurar, eliminar, asignar o quitar rol. Solo lo lee el superadmin.
- **Artículos:** un artículo `programado` se vuelve público solo cuando llega `publicar_en` (no hace falta un proceso programado). La papelera guarda la fecha; `restaurar_articulo()` lo devuelve como borrador o en revisión, y `purgar_papelera_articulos()` (solo servidor) borra lo que lleva más de 30 días. Solo se puede borrar definitivamente desde la papelera.
- Cada edición guarda la versión anterior en `articulo_versiones` («Restaurar una versión»).
- `minutos_lectura` y el índice de búsqueda en español (sin tildes) se calculan desde los bloques de `cuerpo`. Búsqueda: `buscar_articulos(q)`.
- Una serie con artículos no se puede borrar; no se repite el n.º de parte dentro de una serie.
- **Actividades:** `anio` obligatorio y `fecha_inicio` opcional, con `fecha_precision = 'mes'` cuando solo se conoce mes y año. Solo una actividad puede ser «Próximo evento».
- Quitar una foto de una actividad o álbum no la borra de la biblioteca.
- Videos: solo enlaces de YouTube. Enlaces y URL del sitio: solo `https://`.
- `institucional` acepta los textos oficiales de JIUMP y queda vacía: los textos se cargan sin cambios desde el panel cuando lleguen (ver `docs/pendientes.md`).

**Fotos (Storage)**
- Bucket `fotos` **privado**: JPEG, PNG, WebP o AVIF, hasta 10 MB.
- El visitante solo puede leer (y firmar URL de) fotos usadas en contenido publicado. **El sitio debe mostrar las fotos con URL firmadas** (`createSignedUrl` con la clave pública, generadas en el servidor de Next.js y renovadas con la revalidación de la página). Una foto que se despublica deja de poder firmarse.
- Ruta: `<user_id>/<uuid>.<ext>` (cada persona sube en su carpeta) y versiones optimizadas en `<user_id>/<uuid>/<ancho>.webp`. Un archivo nunca sale de la carpeta de su dueño (no se puede «mover» a otra). Las transformaciones de imagen de Supabase son de pago, así que las versiones las genera la app al subir.
- `fotos.archivo` se valida (sin comodines ni carpetas ajenas) y no se puede cambiar: para reemplazar una foto se sube una nueva.

**Datos de prueba (`seed.sql`)**
- Solo contenido que ya está en el diseño aprobado: las 47 fotos reales con su texto alternativo, series y temas, los títulos de los 7 artículos, las 4 actividades 2026 y los álbumes de la Galería. Cuerpos, autores, fechas, lugares e introducciones quedan vacíos (pendientes de JIUMP).
- Cada foto se asocia a un solo evento (regla 2 del README); el logo no se asocia a ninguno.
- La Parte 2 de la Reforma queda «en revisión» porque su título está pendiente. El video de los 50 años queda en borrador.
- Los usuarios de prueba se crean solo dentro de las pruebas, con contraseñas aleatorias que no se guardan.

**Panel /admin (migración 8)**
- `mi_acceso()`: roles asignados y roles que la base reconoce en la sesión actual (el panel arma el menú y los 403 con esto).
- **Vista previa obligatoria, en la base:** pasar un artículo a `publicado` o `programado`, o cambiar el texto de uno ya publicado, exige que esa misma persona haya abierto la vista previa de ese mismo contenido (`articulo_vistas_previas`, con una huella que calcula la base). Solo se exige a las personas del panel; la service role y las migraciones no pasan por esa regla.
- **Cambios pendientes** (`articulo_cambios`): al editar un artículo publicado o programado, los cambios se guardan aparte y el sitio sigue mostrando la versión publicada hasta publicarlos.
- **Presencia** (`articulo_presencia`): quién tiene abierto cada artículo, para el aviso de edición simultánea. Guarda solo el nombre del perfil.
- **Papelera automática:** `pg_cron` (incluido en Supabase, también en el plan gratuito) ejecuta `purgar_papelera_articulos()` todos los días. No hace falta la service role ni un servicio externo.

**Panel /admin, etapa 2 (migración 9)**
- **Fotos optimizadas:** al subir, el panel guarda el original sin cambios y crea versiones WebP y AVIF de 480, 960 y 1600 px de ancho (nunca más grandes que el original, sin recortar). `fotos.anchos` dice cuáles existen; el sitio las usa con `srcset`.
- **Regla 2 (no mezclar eventos), en la base:** una foto está en a lo más una actividad y un álbum, y un álbum asociado a una actividad solo tiene fotos de esa actividad (los álbumes sin actividad, solo fotos sin actividad).
- **`usos_fotos()`:** dónde se usa cada foto, para avisar antes de eliminarla. El título de algo no publicado solo se muestra a quien puede entrar a esa sección.
- **Vista previa obligatoria** también para actividades, álbumes y videos (`vistas_previas_contenido` + trigger). La huella incluye secciones, enlaces y fotos: si algo cambia después de la vista previa, hay que verla de nuevo. Editar algo ya publicado se aplica al guardar.
- **`guardar_actividad()` y `guardar_album()`:** guardan datos, secciones, enlaces y fotos en una sola transacción, y rechazan el guardado si otra persona guardó antes.
- **`marcar_proximo()`:** marca el «Próximo evento» y desmarca el anterior (siempre uno solo).
- **Corrección:** ahora se puede borrar la cuenta de alguien que creó contenido (su contenido queda, sin autor). Antes la base lo impedía por error.

## Puesta en producción (cuando se autorice)

Solo en el plan gratuito y con autorización de la directiva:

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

`seed.sql` **no** se aplica en producción. Además, en el panel de Supabase del proyecto:

- **Authentication → Sign In / Providers:** desactivar «Allow new users to sign up». `config.toml` solo lo desactiva en local, y con el registro abierto cualquiera crearía una cuenta (sin roles, pero con perfil).
- **Authentication → Multi-Factor:** habilitar TOTP.
- **Authentication → URL Configuration:** agregar `https://<dominio>/admin/auth/confirmar**` a las Redirect URLs (enlace de «Recuperar contraseña»).
- **Authentication → Emails / SMTP:** el correo de Supabase gratuito tiene un límite muy bajo de envíos por hora; para recuperar contraseñas con tranquilidad conviene un SMTP propio (decisión pendiente).
- **Database → Extensions:** `pg_cron` queda activado por la migración 8 (vaciado diario de la papelera).

### Alta de los primeros superadmins (al menos dos)

**Desde el inicio debe haber al menos dos superadministradores activos** (decisión de la directiva). Si solo hubiera uno y perdiera su teléfono (su doble factor) o dejara el equipo, nadie podría administrar usuarios ni roles desde el panel. Con dos, uno puede ayudar al otro: por ejemplo, cuando alguien cambia de teléfono e inscribe un factor nuevo, el otro le vuelve a asignar el rol. La base ya impide quitar o desactivar al último superadmin activo, pero eso no reemplaza tener un segundo.

Para cada uno de los dos:

1. Invitar a la persona (Authentication → Users → Invite). Ella entra al panel e **inscribe su factor TOTP**.
2. Recién entonces, asignarle el rol desde el SQL Editor, usando el **id** del usuario (no el correo, que la persona puede cambiar):

```sql
insert into public.perfil_roles (perfil_id, rol)
select id, 'superadmin' from public.perfiles where user_id = '<id del usuario>';
```

Un rol de superadmin asignado antes de inscribir el factor no funciona: hay que quitarlo y volver a asignarlo. Lo mismo si la persona cambia de factor.

Antes del lanzamiento, comprobar que hay dos superadmins activos:

```sql
select count(*) from public.perfil_roles pr
join public.perfiles p on p.id = pr.perfil_id
where pr.rol = 'superadmin' and p.activo;   -- debe ser 2 o más
```

## Revisión de seguridad

Hallazgos corregidos en `migrations/…0600_seguridad.sql`; cada uno tiene pruebas en `tests/database/seguridad.test.sql` que fallan sin la corrección y pasan con ella:

| # | Gravedad | Hallazgo |
|---|---|---|
| H1 | Alta | El bucket era público: las fotos no publicadas (o ya despublicadas) se descargaban con su URL. |
| H2 | Alta | El doble factor se podía saltar: si el rol se asignaba antes de inscribir el factor, quien robara la contraseña inscribía su propio TOTP y obtenía el superadmin. |
| H3 | Media | Con «mover» de Storage, cualquier rol podía dejar un archivo en la carpeta de otra persona (por ejemplo, en la ruta de una foto publicada). |
| H6 | Media | Cerrar sesión o desactivar a alguien no cortaba un token ya emitido (válido hasta 1 h), y la persona desactivada podía seguir renovando su sesión. |
| H9 | Media | `fotos.archivo` sin validar: se podía registrar o cambiar la ruta hacia el archivo de otra persona, y los comodines `%`/`_` engañaban a la regla de «foto publicada». |
| H4 | Media | Multimedia leía actividades en borrador y gestionaba las fotos de actividades (fuera de su columna en la matriz). |
| H5 | Baja | Todo el equipo veía correo, estado y último ingreso de todas las personas. |
| H7 | Baja | Las asignaciones de rol se podían editar y falsear su fecha (que usa la regla del doble factor). |
| H8 | Baja | Series y temas sin artículos publicados eran visibles para el público. |
| H10 | Baja | Toda tabla o función nueva nacía con escritura/ejecución para el visitante anónimo (privilegios por defecto de Supabase). |

Riesgos aceptados (sin cambio): el visitante ve los UUID de `creado_por`/`actualizado_por` en el contenido publicado (no dan acceso a nada); `redirecciones` es pública, porque el sitio la necesita para redirigir.
