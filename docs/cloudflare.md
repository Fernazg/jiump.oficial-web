# Preparación para Cloudflare Workers (plan gratuito)

Estado al 16 de noviembre de 2026. **Trabajo a medias:** este documento dice qué quedó hecho, dónde se detuvo y qué falta. No se creó ninguna cuenta ni se desplegó nada.

Límites del plan gratuito que hay que cumplir: 10 ms de procesador por solicitud, 100.000 solicitudes al día y un Worker de hasta 3 MB comprimido.

## Hecho

- **Adaptador OpenNext configurado** (`app/open-next.config.ts`, `app/wrangler.jsonc`), sin servicios adicionales (ni KV, ni R2, ni colas).
- **El sitio compila para Cloudflare:** `npm run cf:build` termina bien, con Turbopack y con webpack.
- **Tamaño del Worker: 1,9 MB comprimido** (límite gratuito: 3 MB). Medido con `wrangler deploy --dry-run`, que no despliega nada.
- `.dev.vars`, `.open-next/` y `.wrangler/` están en `.gitignore`: las claves locales no llegan al repositorio.

## Dónde se detuvo

**El Worker arranca en local (`wrangler dev`), pero el sitio no funciona dentro de él:** las páginas públicas responden 500 («Faltan SUPABASE_URL y SUPABASE_ANON_KEY») y el panel, 503 («Panel sin configurar»).

Lo que se comprobó, con una ruta y una página de diagnóstico temporales (ya retiradas):

- `wrangler dev` carga las variables de `.dev.vars`, y OpenNext las copia a `process.env` al iniciar.
- **Dentro de una ruta y de una página normales, las variables sí están.**
- **Dentro de `src/proxy.ts` no están.** Ese archivo protege el panel, pone la política de contenido y resuelve el modo mantenimiento y las redirecciones. El 503 del panel sale de ahí.
- El error 500 de las páginas sale de una parte del Worker donde el cliente de Supabase quedó empaquetado junto al proxy (`handler.mjs`, línea 762), no del código normal de las páginas.
- Pasa igual con Turbopack y con webpack, y con la opción `nodejs_compat_populate_process_env`.

**Causa: no encontrada.** Dos hipótesis que se probaron y no lo explican:

- *Que el adaptador no admita `proxy.ts` (entorno Node de Next.js 16).* Se compiló con el formato anterior, `middleware.ts`, que el adaptador sí admite: falla exactamente igual.
- *Que fuera el empaquetador.* Falla igual con Turbopack y con webpack.

Lo que queda por explicar es por qué una página de diagnóstico sí ve las variables y las páginas del sitio no, dentro del mismo Worker. Siguiente paso: reproducirlo en un proyecto mínimo (Next.js 16.4 + OpenNext 1.20 + un proxy que lea `process.env`) y revisar las incidencias del adaptador. No se pudo consultar su documentación desde este entorno (`opennext.js.org` está fuera de la red permitida).

**Nota para probar en este tipo de entorno:** si existe la variable `HTTPS_PROXY`, `wrangler dev` envía por ese proxy también las consultas a Supabase local, y se cancelan. Hay que lanzarlo sin esas variables.

Hasta resolver esto no se puede medir el procesador ni probar la subida de fotos dentro del Worker.

## Falta, en orden

1. **Hacer que `proxy.ts` funcione dentro del Worker** (punto anterior).
2. **Medir el procesador por página** en el Worker local, antes de cualquier cambio. Es el dato que decide todo lo demás.
3. **Guardar las páginas públicas ya armadas.** Hoy cada página se arma en cada visita. Hay tres cosas del sitio actual que lo impiden y hay que rediseñar:
   - **La política de contenido (CSP) usa un valor distinto en cada visita** (PR #8). Una página guardada no puede llevar un valor nuevo cada vez. Alternativa: una política basada en la huella (hash) de los scripts, o `'self'` sin valor por visita. Es una decisión de seguridad y necesita sus pruebas.
   - **Las direcciones firmadas de las fotos vencen a las 2 horas** (PR #11). Una página guardada más tiempo mostraría fotos rotas. Alternativas: firmar por más tiempo y renovar la página antes de que venzan, o servir las fotos públicas por una ruta propia del sitio.
   - **Modo mantenimiento, redirecciones y páginas retiradas** se consultan en cada visita. Tendrían que avisar al guardado cuando cambian.
4. **Actualizar al instante al publicar, editar o retirar** desde el panel: cada acción del panel que cambia contenido público debe invalidar las páginas afectadas (`revalidateTag`). Son unas 40 acciones en `app/src/lib/admin/acciones-*.ts`. El guardado de OpenNext en Cloudflare necesita un almacén (KV o R2, ambos con capa gratuita): hay que confirmar que cabe en el plan gratuito.
5. **El panel nunca se guarda armado:** ya responde `private, no-store`; hay que añadir una prueba que lo confirme dentro del Worker.
6. **Subida de fotos dentro del Worker.** Quitar los metadatos de una foto de 10 MB en JavaScript puede pasar los 10 ms de procesador. Si no cabe, hay que mover esa limpieza al navegador (donde ya se crean las versiones) y dejar en el servidor solo la verificación.
7. **Medir de nuevo** y confirmar que cada página queda bajo 10 ms.
8. Pruebas del Worker en el workflow (levantar `wrangler dev` y correr una parte de Playwright contra él).

## Aviso sobre el build

OpenNext copia el contenido de `app/.env.local` dentro del Worker. En local solo hay claves de desarrollo, pero **el build de producción debe hacerse sin archivos `.env` con claves**: las variables se cargan en la cuenta de Cloudflare.

## Dependencias nuevas

`@opennextjs/cloudflare` y `wrangler`, solo de desarrollo. `npm audit` marca avisos moderados en dependencias internas de esas herramientas (`glob`, `minimatch`); no forman parte del sitio que se sirve.
