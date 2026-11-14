# Sitio público y panel /admin de JIUMP (Next.js)

Next.js 16 + TypeScript + Tailwind 4. Lee **solo contenido publicado** desde Supabase con la **clave anónima** (las políticas RLS hacen el filtro). Las fotos se muestran con **URL firmadas**, porque el bucket es privado. Diseño: `docs/diseno.md` y `design/capturas/`.

```
src/app/(sitio)/        Inicio, Artículos, artículo, Nosotros, Eventos, actividad, Galería, álbum, 404
src/app/mantenimiento/  Página independiente de mantenimiento
src/proxy.ts            Modo mantenimiento (503) y redirecciones 301 desde las URL de Wix
src/lib/                Cliente Supabase (solo clave anónima), consultas, fotos firmadas, formato
src/components/         Encabezado/pie, estados vacíos, tarjetas, bloques del artículo, visor de fotos
src/app/admin/          Panel /admin (ver «Panel /admin» más abajo)
src/lib/admin/          Sesión, roles y secciones, consultas y acciones del servidor del panel
src/components/admin/   Barra lateral, editor por bloques, confirmaciones
tests/                  Pruebas Playwright (escritorio 1440 px y celular 390 px)
```

## Uso local

Requiere el Supabase local levantado (ver `supabase/README.md`) y las fotos del diseño subidas al Storage local.

1. Crea `app/.env.local` a partir de `app/.env.example` con la URL y la **clave anónima** de `npx supabase status`. Ese archivo no se sube al repositorio. Si por error pones la service role, el sitio se niega a arrancar.

```bash
cd app && npm ci
```

```bash
npm run dev
```

## Pruebas

```bash
npm run typecheck && npm run build
```

Las pruebas crean y borran datos de prueba en el Supabase **local**, así que necesitan la service role en el entorno. Solo la usan las pruebas, nunca el sitio, y se niegan a correr contra otra URL que no sea local:

```bash
eval "$(npx supabase status -o env)" && SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npx playwright test
```

Qué cubren:
- Todas las páginas cargan sin errores, con el menú unificado y sin ofrendas, donaciones ni secciones eliminadas.
- Un borrador, un artículo «en revisión» o un programado antes de su fecha no aparecen en Inicio, en el listado ni en la búsqueda, y su URL da 404. Lo mismo para una actividad en borrador.
- Las fotos usan URL firmadas, cargan y tienen texto alternativo. El HTML no expone claves.
- El cuerpo del artículo: negritas, referencias bíblicas resaltadas, índice, barra de lectura y tamaño de texto.
- Modo mantenimiento (503) y su foto configurable, redirecciones 301 y la 404.
- Páginas en borrador (404, fuera del menú, aun con la vista previa activada en producción), lema/cita/abreviatura y la Galería con sus álbumes.
- En celular: sin desborde horizontal y menú ☰ con enlaces de 52 px.

El workflow `.github/workflows/pruebas.yml` corre todo esto en cada push y pull request.

## Vista previa local

Una página completa solo se muestra si está **publicada** en `paginas`; si no, responde 404. Para ver una página en borrador mientras desarrollas:

1. Agrega `JIUMP_VISTA_PREVIA=1` a `app/.env.local`.
2. Usa `npm run dev`.

Solo funciona con las tres condiciones juntas: `next dev`, la variable y un Supabase local. En un build de producción no tiene efecto; las pruebas lo verifican levantando el build con la variable activada a propósito. La página muestra el aviso «Vista previa local». Solo salta la regla de la página: el contenido en borrador (artículos, actividades, secciones) sigue sin verse, porque los datos se leen con la clave anónima.

## Cómo decide qué mostrar

- **Textos institucionales** (presentación, cifras, «Quiénes somos», «Qué creemos»): vienen de la tabla `institucional`. Las secciones editables de Inicio y Nosotros vienen de `secciones` (página publicada + sección visible). Si no existen, la sección no se muestra, o se muestra el estado vacío del diseño. El sitio nunca completa con textos propios.
- **Fechas, lugares y autores:** solo si están en la base. En una serie del mes, el artículo muestra el mes de la serie.
- **Actividades:** el lema, la cita y la abreviatura se muestran solo si tienen valor (ver `docs/modelo-datos.md`).
- **Galería:** las fotos de cada álbum se ven dentro de `/galeria`; `/galeria/<slug>` es la misma vista, para compartir.
- **Sin sección «Realizados»:** Eventos muestra el próximo evento y las actividades del año más reciente.

## Panel /admin

Etapa 1: inicio de sesión, estructura, escritorio y artículos. Etapa 2: biblioteca de fotos, eventos y actividades, galerías y videos. Página web, institucional, menú, usuarios, registro y configuración ya están en el menú (con sus permisos y 403), pero su contenido llega en la próxima etapa.

**Acceso**
- Correo y contraseña de Supabase Auth. No hay registro público.
- Doble factor TOTP: obligatorio para Superadministrador (si no lo tiene, debe inscribirlo antes de entrar), opcional para el resto desde «Mi cuenta». Con el factor inscrito, se pide el código en cada ingreso.
- «¿Olvidaste tu contraseña?» envía un enlace (`/admin/auth/confirmar`) para crear una nueva.
- Cerrar sesión o desactivar a una persona corta el acceso al instante: la sesión se borra en Supabase y la base deja de reconocer sus roles.

**Permisos (en el servidor, no solo en la interfaz)**
- `src/proxy.ts` protege todo `/admin`: sin sesión → «Ingresar»; con doble factor pendiente → código; sección que no es de sus roles → **403** (también para acciones del servidor enviadas a mano).
- Cada página y cada acción vuelve a comprobar el permiso (`exigirSeccion` / `permisoAccion`).
- El panel usa siempre la sesión de la persona con la clave anónima: **RLS aplica sus permisos**. Nunca usa la service role.
- Qué sección ve cada rol: `src/lib/admin/secciones.ts` (matriz de `docs/roles-permisos.md`).

**Artículos**
- Listado con filtros por estado, serie y tema, búsqueda (título, bajada, autor y texto completo del cuerpo) y papelera.
- Editor por bloques con los 13 tipos de `docs/modelo-datos.md`, guardado automático, botón **B** para negritas, portada e imágenes elegidas desde la biblioteca existente (subir fotos llega en la próxima etapa).
- Flujo Borrador → En revisión → Programado / Publicado. **Nada se publica sin vista previa**: la vista previa usa el mismo componente que el sitio (`ArticuloCompleto`) y la base de datos exige haberla abierto para ese mismo contenido.
- Un artículo publicado se puede seguir editando: los cambios quedan pendientes y el sitio no cambia hasta revisarlos y publicarlos.
- Programación con fecha y hora de Chile (`America/Santiago`, con cambio de horario).
- Papelera por 30 días (se vacía sola con `pg_cron`), con confirmación al eliminar. Historial de versiones con «Restaurar».
- Aviso de edición simultánea y protección contra sobrescribir: si otra persona guardó antes, se pide recargar.
- Series y temas: crear, editar y borrar (una serie con artículos no se puede borrar).

**Biblioteca de fotos** (todo el equipo; ◐ Editor y Eventos solo editan o borran las suyas)
- Subir arrastrando o eligiendo archivos: JPG, PNG, WebP o AVIF de hasta 10 MB, con texto alternativo obligatorio y crédito opcional.
- Al subir se guardan el original sin cambios y versiones WebP y AVIF de varios anchos (`sharp`, en el servidor). El sitio muestra esas versiones (más livianas, sin datos de ubicación).
- Buscar por descripción o crédito, filtrar (subidas por mí, en uso, sin usar, por álbum) y ver dónde se usa cada foto. Eliminar pide confirmación y avisa si está en uso.
- En el editor de artículos se puede subir una foto nueva como portada o imagen.

**Eventos y actividades** (Superadmin y Eventos)
- Todos los campos del modelo: año obligatorio, fecha opcional (día exacto o solo mes y año), lugar, zona, introducción, lema, cita bíblica, abreviatura.
- Secciones (Día 1, Día 2…) con los mismos bloques que los artículos, enlaces a videos y transmisiones, y fotos ordenadas con portada. Quitar una foto no la borra de la biblioteca.
- Vista previa obligatoria antes de publicar (misma página que el sitio). Destacar en Inicio y ordenar, y «Próximo evento» (uno solo).

**Galerías y videos** (Superadmin y Multimedia)
- Álbumes con fotos ordenadas, portada, año, lugar y actividad opcional. Un álbum tiene fotos de un solo evento (regla 2).
- Videos de YouTube asignados a un álbum o una actividad. Vista previa obligatoria antes de publicar.

**Pruebas del panel** (`tests/admin-*.spec.ts`): crean usuarios de prueba de cada rol en el Supabase local (con TOTP simulado) y cubren qué puede y qué no puede hacer cada uno (también entrando por URL), la subida y optimización de fotos, eventos, álbumes y videos con su vista previa, el doble factor, cerrar sesión y desactivar, recuperar la contraseña, el flujo completo de publicación, la programación, la papelera, las versiones, la edición simultánea, series y temas, y que lo no publicado nunca aparezca en el sitio público. Al terminar, borran todo lo que crearon (contenido, fotos, archivos y cuentas de prueba; queda solo la última cuenta de prueba con rol de superadmin, porque la base nunca deja el sitio sin uno).
