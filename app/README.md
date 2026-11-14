# Sitio público de JIUMP (Next.js)

Next.js 16 + TypeScript + Tailwind 4. Lee **solo contenido publicado** desde Supabase con la **clave anónima** (las políticas RLS hacen el filtro). Las fotos se muestran con **URL firmadas**, porque el bucket es privado. Diseño: `docs/diseno.md` y `design/capturas/`.

```
src/app/(sitio)/        Inicio, Artículos, artículo, Nosotros, Eventos, actividad, Galería, álbum, 404
src/app/mantenimiento/  Página independiente de mantenimiento
src/proxy.ts            Modo mantenimiento (503) y redirecciones 301 desde las URL de Wix
src/lib/                Cliente Supabase (solo clave anónima), consultas, fotos firmadas, formato
src/components/         Encabezado/pie, estados vacíos, tarjetas, bloques del artículo, visor de fotos
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
