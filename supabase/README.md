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
seed.sql                    Datos de prueba SOLO para desarrollo local
scripts/subir-fotos-diseno.sh   Sube design/fotos/ al Storage local
tests/database/             Pruebas pgTAP de permisos y reglas (85)
tests/api/                  Prueba de integración HTTP: login, 2FA, REST y Storage (6)
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
- `tiene_rol(r)` y `tiene_algun_rol(...)` (`SECURITY DEFINER`) se usan en todas las políticas. Una persona puede tener varios roles; un perfil `activo = false` pierde todos los permisos.
- **Doble factor obligatorio para Superadministrador, validado en la base de datos:** el rol `superadmin` solo cuenta si el JWT trae `aal = aal2` (TOTP verificado). `mis_roles()` sí lo informa, para que el panel pida el segundo factor.
- No se puede quitar ni desactivar al último superadmin activo.
- ◐ Editor y Eventos suben fotos y las usan en su contenido, pero solo editan o borran **las propias** (`fotos.creado_por`, `storage.objects.owner_id`). Superadmin y Multimedia gestionan todas.
- Multimedia puede **leer** actividades en borrador y gestionar `actividad_fotos`, para vincular álbumes, videos y fotos.
- El visitante anónimo no puede escribir en ninguna tabla ni leer perfiles, roles, versiones o el registro.

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
- Bucket `fotos`: JPEG, PNG, WebP o AVIF, hasta 10 MB.
- Ruta: `<user_id>/<uuid>.<ext>` (cada persona sube en su carpeta) y versiones optimizadas en `<user_id>/<uuid>/<ancho>.webp`. Las transformaciones de imagen de Supabase son de pago, así que las versiones las genera la app al subir.
- **Por decidir con la directiva:** el bucket es de lectura pública por URL, para que el sitio cargue rápido y se pueda cachear. Las rutas llevan un UUID que no se puede adivinar, y listar el bucket solo muestra fotos usadas en contenido publicado. Para que las fotos no publicadas tampoco se puedan ver por URL, basta con `public = false`. La política de lectura ya está preparada, pero entonces el sitio necesita URL firmadas.

**Datos de prueba (`seed.sql`)**
- Solo contenido que ya está en el diseño aprobado: las 47 fotos reales con su texto alternativo, series y temas, los títulos de los 7 artículos, las 4 actividades 2026 y los álbumes de la Galería. Cuerpos, autores, fechas, lugares e introducciones quedan vacíos (pendientes de JIUMP).
- La Parte 2 de la Reforma queda «en revisión» porque su título está pendiente. El video de los 50 años queda en borrador.
- Los usuarios de prueba se crean solo dentro de las pruebas, con contraseñas aleatorias que no se guardan.

## Puesta en producción (cuando se autorice)

Solo en el plan gratuito y con autorización de la directiva:

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

`seed.sql` **no** se aplica en producción. El primer superadmin se asigna una vez, desde el SQL Editor del proyecto:

```sql
insert into public.perfil_roles (perfil_id, rol)
select id, 'superadmin' from public.perfiles where correo = '<correo>';
```
