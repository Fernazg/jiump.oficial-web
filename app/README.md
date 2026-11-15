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
- Errores (`tests/errores.spec.ts`): las direcciones mal formadas no dan error 500, y con la base de datos caída se ve un aviso claro en español con «Reintentar». Para eso Playwright levanta un segundo servidor (puerto 3101) apuntando a una base que no responde.
- Páginas en borrador (404, fuera del menú, aun con la vista previa activada en producción), lema/cita/abreviatura y la Galería con sus álbumes.
- En celular: sin desborde horizontal y menú ☰ con enlaces de 52 px.
- Accesibilidad (`tests/accesibilidad.spec.ts`): revisión automática WCAG 2.2 AA con axe-core de todas las páginas del sitio y del panel, en escritorio y celular, más el uso con teclado (saltar al contenido, menú, visor de fotos, foco que no queda tapado) y lectura a 320 px. **Al crear una página nueva, agrégala a la lista de ese archivo.**

El workflow `.github/workflows/pruebas.yml` corre todo esto en cada push y pull request.

## Seguridad en el navegador

- **Cabeceras en todas las respuestas** (`next.config.ts` y `src/lib/seguridad/cabeceras.ts`): nadie puede mostrar el sitio dentro de un marco (`X-Frame-Options`), el navegador no adivina tipos de archivo (`nosniff`), solo HTTPS en producción (`Strict-Transport-Security`), y cámara, micrófono, ubicación y pagos quedan bloqueados.
- **Política de contenido (CSP)**, puesta por `src/proxy.ts` con un valor distinto en cada visita: solo se ejecutan los scripts del propio sitio; las fotos solo vienen del sitio y del almacenamiento de Supabase; los videos, solo de YouTube sin cookies. Si un texto trajera código inyectado, el navegador no lo ejecuta. El panel además permite WebAssembly (optimiza las fotos al subirlas).
- **Si agregas un servicio externo** (otro proveedor de video, una fuente, un mapa), hay que permitirlo en `politicaContenido()`; si no, el navegador lo bloquea y `tests/seguridad.spec.ts` falla.
- `/admin/salir` solo cierra la sesión con el botón (POST). Abrirlo como enlace no saca del panel a quien tiene su acceso al día.

## Vista previa local

Una página completa solo se muestra si está **publicada** en `paginas`; si no, responde 404. Para ver una página en borrador mientras desarrollas:

1. Agrega `JIUMP_VISTA_PREVIA=1` a `app/.env.local`.
2. Usa `npm run dev`.

Solo funciona con las tres condiciones juntas: `next dev`, la variable y un Supabase local. En un build de producción no tiene efecto; las pruebas lo verifican levantando el build con la variable activada a propósito. La página muestra el aviso «Vista previa local». Solo salta la regla de la página: el contenido en borrador (artículos, actividades, secciones) sigue sin verse, porque los datos se leen con la clave anónima.

## Rendimiento

- **Fotos:** el sitio pide la versión del tamaño que se va a mostrar (`<picture>` con AVIF y WebP en 480, 960 y 1600 px), también en las miniaturas de galerías. Esas versiones solo existen para las fotos **subidas desde el panel**; una foto cargada por otro camino se sirve en su tamaño original.
- **Lo primero que se ve se carga de inmediato** (`prioridad` en `Foto`); el resto, al acercarse. Al agregar una sección con una foto grande arriba, márcala con `prioridad`.
- **Direcciones estables:** las URL firmadas del sitio público se reutilizan durante una hora (`firmarRutas` en `src/lib/datos.ts`), así el navegador guarda las fotos en vez de bajarlas otra vez en cada página. Si una foto se retira, desaparece del sitio al instante.
- **Consultas:** las lecturas compartidas van envueltas en `cache()` de React y se hacen una vez por visita. Los listados no piden el cuerpo de los artículos. No se guarda nada entre visitas: publicar o retirar se nota al instante.
- `tests/rendimiento.spec.ts` lo comprueba.

## SEO

- **`SITIO_URL`** (variable de entorno, obligatoria en producción): la dirección pública, por ejemplo `https://jiump.cl`. De ahí salen las direcciones canónicas, Open Graph, `/sitemap.xml` y `/robots.txt`.
- **Por página** (`src/lib/seo.ts`, función `metadatos()`): título, descripción, dirección canónica y cómo se ve el enlace al compartirlo (con la foto de portada, o la foto por defecto de Configuración). El idioma es `es-CL`.
- **Datos estructurados** (`DatosEstructurados`): `Organization` en Inicio, `Article` en cada artículo y `Event` en las actividades que tienen fecha. Solo con datos de la base: si falta el autor, la fecha o el lugar, se omite.
- **`/sitemap.xml`** lista solo lo publicado; **`/robots.txt`** excluye el panel. Las búsquedas y filtros de Artículos no se indexan.
- **Direcciones de Wix:** `/post/<nombre>` redirige al artículo del mismo nombre si existe. Para cualquier otra dirección antigua, se agrega una redirección en Configuración.
- **Al crear una página nueva:** usa `metadatos()` en su `generateMetadata` y agrégala a `src/app/sitemap.ts`. `tests/seo.spec.ts` lo comprueba.

## Cómo decide qué mostrar

- **Textos institucionales** (presentación, cifras, «Quiénes somos», «Qué creemos»): vienen de la tabla `institucional`. Las secciones editables de Inicio y Nosotros vienen de `secciones` (página publicada + sección visible). Si no existen, la sección no se muestra, o se muestra el estado vacío del diseño. El sitio nunca completa con textos propios.
- **Fechas, lugares y autores:** solo si están en la base. En una serie del mes, el artículo muestra el mes de la serie.
- **Actividades:** el lema, la cita y la abreviatura se muestran solo si tienen valor (ver `docs/modelo-datos.md`).
- **Galería:** las fotos de cada álbum se ven dentro de `/galeria`; `/galeria/<slug>` es la misma vista, para compartir.
- **Sin sección «Realizados»:** Eventos muestra el próximo evento y las actividades del año más reciente.

## Si algo falla

- **Páginas de error propias** (`src/components/ErrorGeneral.tsx` y los `error.tsx`): si una página no se puede armar, el visitante ve «No pudimos cargar esta página» con «Reintentar», sin detalles técnicos. El «Código para soporte» permite encontrar el detalle en el registro del servidor.
- **Base de datos caída:** el sitio responde en menos de un segundo con ese aviso (cada consulta tiene un tope de 8 s y no se reintenta). «Ingresar» avisa que no hay conexión en vez de culpar a la contraseña.
- **Parámetros de la URL:** pasan por `parametros()` (`src/lib/parametros.ts`), que deja textos cortos y sin caracteres de control. Úsalo en cada página nueva que lea `searchParams`.

## Para que siga funcionando cuando crezca

- **Listas largas:** Supabase entrega como máximo 1.000 filas por consulta y no avisa cuando corta. Toda lista que pueda pasar de ahí (fotos, fotos de álbumes) se lee con `leerTodo()` (`src/lib/leer-todo.ts`). Úsalo en cualquier listado nuevo sin límite.
- **Biblioteca de fotos:** paginada de a 60; solo se firman y dibujan las fotos de la página.
- **Índices:** cada columna nueva que apunte a otra tabla necesita su índice (ver la migración 13).
- **Dependencias:** Dependabot (`.github/dependabot.yml`) propone las actualizaciones una vez al mes. Si el workflow «Pruebas» queda en verde, se pueden mezclar.

## Panel /admin

Etapa 1: inicio de sesión, estructura, escritorio y artículos. Etapa 2: biblioteca de fotos, eventos y actividades, galerías y videos. Etapa 3: página web, menú y pie, información institucional, usuarios y roles, registro de actividad y configuración. Con eso el panel queda completo.

**Acceso**
- Correo y contraseña de Supabase Auth. No hay registro público.
- Doble factor TOTP: obligatorio para Superadministrador (si no lo tiene, debe inscribirlo antes de entrar), opcional para el resto desde «Mi cuenta». Con el factor inscrito, se pide el código en cada ingreso.
- «¿Olvidaste tu contraseña?» envía un enlace (`/admin/auth/confirmar`) para crear una nueva.
- Cerrar sesión o desactivar a una persona corta el acceso al instante: la sesión se borra en Supabase y la base deja de reconocer sus roles.

**Permisos (en el servidor, no solo en la interfaz)**
- `src/proxy.ts` protege todo `/admin`: sin sesión → «Ingresar»; con doble factor pendiente → código; sección que no es de sus roles → **403** (también para acciones del servidor enviadas a mano).
- Cada página y cada acción vuelve a comprobar el permiso (`exigirSeccion` / `permisoAccion`).
- El panel usa siempre la sesión de la persona con la clave anónima: **RLS aplica sus permisos**. La única excepción es **invitar a alguien** (ver «Usuarios y roles»).
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
- **Privacidad:** al subir, el servidor quita del original la ubicación GPS y los demás metadatos personales (EXIF, XMP, comentarios, IPTC) **sin recodificar**: los píxeles quedan idénticos y solo se conserva la orientación (para que la foto no se vea girada) y el perfil de color (`src/lib/admin/metadatos.ts`). Si no se pueden quitar sin alterar la foto (un AVIF con EXIF), la subida se rechaza con un mensaje claro. Las fotos del seed (`design/fotos`) se revisaron: no traen datos personales (lo comprueba `tests/metadatos.spec.ts`).
- Al subir se guardan el original (ya limpio) y versiones WebP y AVIF de 480, 960 y 1600 px. **Las versiones las crea el navegador de quien sube** (WebAssembly: codificadores de Squoosh vía jSquash, licencia Apache 2.0), así que no dependen del alojamiento: funciona igual en Cloudflare, Vercel o un servidor propio, sin servicios pagados. El servidor solo verifica, con JavaScript puro (`src/lib/admin/imagen.ts`), que el original y cada versión sean imágenes reales del tipo y ancho esperados, y las guarda. Si un navegador no pudiera optimizar, se guarda solo el original y el sitio lo usa tal cual. El sitio muestra las versiones (más livianas, sin datos de ubicación).
- Los codificadores (`.wasm`) se copian a `public/wasm` al compilar o al iniciar `npm run dev` (`scripts/copiar-wasm.mjs`); no se suben al repositorio.
- Buscar por descripción o crédito, filtrar (subidas por mí, en uso, sin usar, por álbum) y ver dónde se usa cada foto. Eliminar pide confirmación y avisa si está en uso.
- En el editor de artículos se puede subir una foto nueva como portada o imagen.

**Eventos y actividades** (Superadmin y Eventos)
- Todos los campos del modelo: año obligatorio, fecha opcional (día exacto o solo mes y año), lugar, zona, introducción, lema, cita bíblica, abreviatura.
- Secciones (Día 1, Día 2…) con los mismos bloques que los artículos, enlaces a videos y transmisiones, y fotos ordenadas con portada. Quitar una foto no la borra de la biblioteca.
- Vista previa obligatoria antes de publicar (misma página que el sitio). Destacar en Inicio y ordenar, y «Próximo evento» (uno solo).
- Igual que los artículos: al editar algo **ya publicado** (actividad, álbum o video), los cambios quedan pendientes y el sitio no cambia hasta revisar la vista previa y «Publicar cambios» (o «Descartar cambios»). Lo exige la base de datos.

**Galerías y videos** (Superadmin y Multimedia)
- Álbumes con fotos ordenadas, portada, año, lugar y actividad opcional. Un álbum tiene fotos de un solo evento (regla 2).
- Videos de YouTube asignados a un álbum o una actividad. Vista previa obligatoria antes de publicar.

**Administrar página web** (solo Superadmin)
- Pestañas por página (Inicio, Nosotros, Eventos, Artículos, Galería). Cada sección de Inicio y Nosotros se ordena (↑ ↓), se muestra u oculta y se editan sus textos, botones, fotos y tarjetas. El diseño de cada sección es fijo (`src/lib/catalogo-secciones.ts`): así la página siempre se ve bien. Las secciones automáticas (actividades destacadas, próximo evento, artículos recientes, álbumes, textos institucionales) solo se ordenan u ocultan.
- SEO de cada página y **publicar o retirar** la página completa (retirada: 404 y su enlace sale del menú).
- **Menú, enlaces y pie:** enlaces ordenables que se pueden ocultar. Un enlace a una página no publicada nunca aparece.
- Igual que el resto del panel: si la página ya está publicada, lo que se guarda queda **pendiente** hasta revisar la vista previa (la misma página del sitio) y publicar. Lo exige la base de datos.

**Información institucional** (solo Superadmin)
- Identidad, «Quiénes somos», visión, historia, declaraciones de fe y cifras. Todos los campos parten **vacíos**: se llenan con los textos oficiales cuando JIUMP los entregue; mientras tanto, el sitio no muestra esos bloques. Cambios pendientes y vista previa (en Nosotros) antes de publicar.

**Usuarios y roles** (solo Superadmin)
- Lista con roles, doble factor, último ingreso, invitación pendiente y la tabla «Qué puede hacer cada rol».
- **Invitar por correo:** se crea la cuenta y Supabase envía un correo; la persona abre el enlace (`/admin/bienvenida`), crea su contraseña y entra con los roles asignados.
- Asignar y quitar roles; desactivar (corta sus sesiones al instante) y reactivar.
- Reglas: Superadministrador solo se asigna a quien ya inscribió su doble factor (la base además exige que el factor sea anterior al rol); deben quedar **al menos dos** Superadministradores activos (lo exigen el panel y la base de datos: no se puede quitar el rol ni desactivar a un superadmin si quedarían menos de dos; agregar siempre se puede, partiendo de cero); nadie se quita su propio rol de Superadministrador ni se desactiva a sí mismo.
- **Por qué invitar usa la service role:** crear la cuenta de otra persona y enviarle la invitación es una operación de administración de Supabase Auth; ninguna sesión normal puede hacerlo (el registro público está cerrado a propósito). Por eso, solo esa acción usa la clave de servicio (`src/lib/admin/invitar.ts`, solo servidor), después de comprobar que quien invita es Superadmin con doble factor vigente. Los roles se asignan luego con la sesión de quien invita (RLS normal). Requiere la variable de entorno del servidor `SUPABASE_SERVICE_ROLE_KEY` (nunca en el repositorio ni en el navegador); sin ella, el resto del panel funciona y «Invitar» muestra un aviso.

**Registro de actividad** (solo Superadmin): quién hizo qué y cuándo, con filtros por persona, acción, tipo de contenido y fechas. Solo lectura: lo escriben triggers de la base.

**Configuración** (solo Superadmin)
- Modo mantenimiento con confirmación (el sitio responde 503 con la página de mantenimiento; el panel sigue funcionando), su foto, enlace de Instagram, barra «Próximo evento» y SEO por defecto (título y descripción del sitio).
- Redirecciones 301 desde las direcciones antiguas de Wix (se acepta la URL completa y se guarda su ruta).

**Pruebas del panel** (`tests/admin-*.spec.ts`): crean usuarios de prueba de cada rol en el Supabase local (con TOTP simulado) y cubren qué puede y qué no puede hacer cada uno (también entrando por URL), la subida y optimización de fotos, eventos, álbumes y videos con su vista previa, el doble factor, cerrar sesión y desactivar, recuperar la contraseña, el flujo completo de publicación, la programación, la papelera, las versiones, la edición simultánea, series y temas, las secciones de página web, menú, institucional, la invitación por correo (Mailpit local), los cambios de rol, el modo mantenimiento, las redirecciones, y que lo no publicado nunca aparezca en el sitio público. Al terminar, borran todo lo que crearon (contenido, fotos, archivos y cuentas de prueba; quedan las dos últimas cuentas de prueba con rol de superadmin, porque la base nunca deja menos de dos).
