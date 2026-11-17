# Cloudflare Workers, plan gratuito

Estado al 17 de noviembre de 2026. **El sitio público cabe en el plan gratuito** (medido en local con el motor de Cloudflare). No se creó ninguna cuenta ni se desplegó nada. Los pasos para crear la cuenta y conectar el repositorio están en `docs/lanzamiento.md`, paso 2.

Límites del plan gratuito: 10 ms de procesador por solicitud, 100.000 solicitudes al día, un Worker de hasta 3 MB comprimido (el del sitio pesa 1,9 MB) y, en KV, 100.000 lecturas y 1.000 escrituras al día.

## Cómo funciona

Armar una página con Next.js cuesta entre 20 y 35 ms de procesador, y solo pasar por Next.js ya cuesta unos 8. Por eso las visitas públicas no pasan por Next.js si la página ya está armada:

1. **El Worker** (`app/cloudflare/worker.ts`) recibe cada visita. Si es pública (no `/admin`, no `/_next`, no `/api`, no una acción de formulario), consulta `estado_sitio()` en la base: una sola consulta que dice si hay mantenimiento, si la dirección tiene una redirección y la **versión del contenido**.
2. Con mantenimiento o redirección, todo sigue como antes: lo resuelve Next.js (`proxy.ts`).
3. Si no, busca en KV la página guardada **para esa versión**. Si está, la entrega sin armarla. Si no, la arma Next.js, se entrega y se guarda (hasta 24 horas).
4. **La versión sube sola** con cualquier cambio en el contenido público (triggers en la base, migración `20261117000100_version_sitio.sql`), y también cuando un artículo programado llega a su hora. Por eso publicar, editar, retirar, activar el mantenimiento o agregar una redirección se nota **al instante**, igual que antes. No depende de que el panel avise.

Lógica: `app/src/lib/paginas-guardadas.ts`. El espacio de KV `PAGINAS` se crea solo en el primer despliegue (`app/wrangler.jsonc`, sin `id`).

### Lo que cambió en el sitio para lograrlo (sin cambiar el aspecto)

- **Enlaces normales en vez de `<Link>` de Next.js** (`components/Enlace.tsx`). `<Link>` pide a Next.js, al pasar el cursor y al hacer clic, una versión especial de la página que se arma en cada petición y no se puede guardar. Con un enlace normal cada clic carga la página completa, que llega guardada. Se ve igual; el panel sigue usando `<Link>`.
- **Política de contenido (CSP) con valor nuevo en cada visita**, también en las páginas guardadas: el Worker reemplaza el valor solo en las etiquetas que Next.js marcó (`[nonce]`), con el motor de Cloudflare (`HTMLRewriter`). Un texto del contenido nunca gana permiso para ejecutarse.
- **Las fotos públicas se firman por 26 horas** (antes 2), para que nunca venzan dentro de una página guardada (máximo 24 horas). Una foto retirada desaparece del sitio al instante; solo quien ya tenía su dirección puede abrirla hasta que venza. Las vistas previas del panel siguen en 2 horas.
- **El logo se entrega como archivo estático** (`unoptimized`). Con la optimización de Next.js, cada visita pedía además `/_next/image`, que en Cloudflare pasa por el Worker (sin el servicio pagado de imágenes entrega el mismo PNG) y gasta del límite de 100.000 solicitudes diarias.
- **Cada despliegue usa sus propias páginas guardadas** (`version_metadata` en `wrangler.jsonc`). Sin esto, después de publicar código nuevo se entregarían páginas armadas con el código anterior.
- **Mantenimiento con estado 503 también en Cloudflare.** OpenNext perdía el 503 que pone `proxy.ts` y respondía 200; el Worker lo repone.
- **El panel no se arma al compilar** (`dynamic = 'force-dynamic'` en `app/admin/layout.tsx`). Cloudflare compila sin las claves de Supabase y `/admin/verificar` hacía fallar la compilación.
- **Cabeceras de seguridad en los archivos estáticos.** En Cloudflare los estáticos no pasan por Next.js; `npm run cf:build` genera `_headers` desde la misma fuente que usa Next.js (`scripts/cabeceras-estaticas.mjs`). Era la falla que encontró la corrida de Playwright contra el Worker.

### Qué no se guarda

- **El panel** (`/admin`): cada persona ve lo suyo.
- **Las búsquedas** (`/articulos?q=…`): cada texto es distinto y gastaría el límite de 1.000 escrituras diarias de KV.
- **Las direcciones que no existen** (404), por la misma razón.
- Los parámetros que no cambian la página (por ejemplo `?utm_source=whatsapp`) se ignoran: usan la misma página guardada. Solo cuentan `serie`, `tema` y `filtro`.

## Medición del procesador

`app/scripts/medir-procesador.mjs` mide el procesador de todos los procesos `workerd` (el motor de Cloudflare) durante N visitas seguidas a cada página. En local eso incluye el proxy de `wrangler dev`, que mueve los bytes de cada respuesta y que en Cloudflare no se cobra: un archivo estático de 112 KB, que en Cloudflare no ejecuta el Worker, marca 6,8 ms en local. Por eso el script da dos columnas: **Total** (todo, cota superior) y **Neto** (el total menos lo que marca `wrangler dev` con un archivo estático del mismo tamaño). El Neto todavía incluye el KV simulado de `wrangler dev` (~1,5 ms) y la consulta a la base.

Promedio de 60 visitas, misma máquina, 17 de noviembre (última corrida, con todos los cambios):

| Página | Antes (armada en cada visita) | Ahora, total | Ahora, neto |
|---|---|---|---|
| Inicio | 36 ms | 10,3 ms | 5,9 ms |
| Nosotros | 24,5 ms | 9,5 ms | 6,5 ms |
| Eventos | 26 ms | 9,3 ms | 5,8 ms |
| Actividad | 33 ms | 10,2 ms | 5,4 ms |
| Artículos | 27 ms | 9,5 ms | 5,7 ms |
| Artículo | 25,5 ms | 9,0 ms | 5,5 ms |
| Artículos de una serie | 23,5 ms | 9,3 ms | 6,1 ms |
| Galería (y filtrada por año) | 27,5 ms | 9,2–9,3 ms | 5,0–5,1 ms |
| Álbum | 28 ms | 9,2 ms | 5,2 ms |
| Mapa del sitio, robots, mantenimiento | 8–15 ms | 6,7–8,2 ms | 5,6–5,9 ms |
| Panel · Ingresar (no se guarda) | 19 ms | 19 ms | — |

Las cifras varían ±1 ms entre corridas. El «total» de Inicio y Actividad roza los 10 ms solo porque son las páginas más pesadas y `wrangler dev` cobra por mover bytes; en Cloudflare esa parte no existe.

**El aspecto no cambió:** capturas de página completa de 10 páginas (incluida la 404), en escritorio (1440 px) y celular (390 px), son idénticas píxel a píxel entre el Worker y Next.js directo.

El workflow «Pruebas» compila el Worker, corre `scripts/probar-worker.mjs` (páginas guardadas, valor nuevo de la CSP en cada visita, cambios al instante, mantenimiento, redirecciones, panel y búsquedas sin guardar, cabeceras de los estáticos) y vuelve a medir: **falla si una página guardada llega a 10 ms neto.** El resultado queda en el resumen de cada ejecución.

**Falta confirmarlo en Cloudflare**, cuando exista la cuenta: Workers → jiump-sitio → Observability muestra el procesador de cada visita.

## Lo que sigue pasando de 10 ms

- **La primera visita a cada página después de un cambio** (20–35 ms): la arma y la guarda. Pasa una vez por página y por cambio. Cloudflare tolera excesos ocasionales, sin garantía.
- **Búsquedas y direcciones inexistentes** (19–32 ms): se arman siempre.
- **El panel** (19 ms o más): no se puede guardar. Si en el ensayo da errores «1102», la salida es el plan de US$5 al mes (**necesita a la directiva**) o reducir el trabajo del panel por solicitud.
- **Subida de fotos dentro del Worker: sin medir.** Quitar los metadatos de una foto de 10 MB puede pasar el límite. Si no cabe, mover esa limpieza al navegador (donde ya se crean las versiones).

## Límite de escrituras de KV

Cada página armada es una escritura. Con 1.000 al día alcanza para unas 20 rondas de cambios con 50 páginas visitadas entre cada una. Si se pasa el límite, el sitio sigue funcionando, pero arma las páginas en cada visita hasta el día siguiente. KV → `PAGINAS` → Metrics muestra el uso.

## Cómo probar en local

Con Supabase local arriba, crear `app/.dev.vars` (no se sube al repositorio) con `SUPABASE_URL` y `SUPABASE_ANON_KEY` de `npx supabase status`, y luego:

```bash
npm run cf:preview
```

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/probar-worker.mjs http://127.0.0.1:8787
```

Tropiezos conocidos:

- Si `.dev.vars` trae una variable vacía, el sitio responde 500 («Faltan SUPABASE_URL…»).
- Si existe la variable `HTTPS_PROXY`, `wrangler dev` envía por ese proxy también las consultas a Supabase local, y se cancelan. Hay que lanzarlo sin esas variables.
- OpenNext copia `app/.env.local` dentro del Worker. En Cloudflare (Workers Builds) no existe ese archivo; en local solo tiene claves de desarrollo.

## Dependencias

`@opennextjs/cloudflare` y `wrangler`, solo de desarrollo. `npm audit` marca avisos moderados en dependencias internas de esas herramientas (`glob`, `minimatch`); no forman parte del sitio que se sirve.
