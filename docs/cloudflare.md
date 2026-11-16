# Preparación para Cloudflare Workers (plan gratuito)

Estado al 16 de noviembre de 2026. **Trabajo a medias:** este documento dice qué quedó hecho, dónde se detuvo y qué falta. No se creó ninguna cuenta ni se desplegó nada.

Límites del plan gratuito que hay que cumplir: 10 ms de procesador por solicitud, 100.000 solicitudes al día y un Worker de hasta 3 MB comprimido.

## Hecho

- **Adaptador OpenNext configurado** (`app/open-next.config.ts`, `app/wrangler.jsonc`), sin servicios adicionales (ni KV, ni R2, ni colas).
- **El sitio compila para Cloudflare** con `npm run cf:build`.
- **El sitio funciona dentro del Worker en local** (`wrangler dev`, que usa el mismo motor que Cloudflare): Inicio, Nosotros, Eventos, una actividad, Artículos, un artículo, Galería y el mapa del sitio responden 200; `/admin` redirige a «Ingresar» y «Ingresar» carga. Solo se comprobó que respondan; no se corrieron las pruebas de Playwright contra el Worker.
- **Tamaño del Worker: 1,9 MB comprimido** (límite gratuito: 3 MB). Medido con `wrangler deploy --dry-run`, que no despliega nada.
- `.dev.vars`, `.open-next/` y `.wrangler/` están en `.gitignore`: las claves locales no llegan al repositorio.

### Pruebas de Playwright contra el Worker local

Se corrió la suite completa con el Worker en el puerto de las pruebas: **174 pasan y 2 fallan** (de 176).

- Pasan, entre otras, las 6 de la biblioteca de fotos: subir, optimizar a WebP y AVIF, permisos por rol y quitar el GPS. En local no se aplica el límite de 10 ms, así que esto confirma que **funciona**, no que **quepa** en el plan gratuito.
- **Falla real: los archivos estáticos no llevan las cabeceras de seguridad.** `/marca/logo-jiump.png` sale sin `X-Content-Type-Options` ni las demás. En Cloudflare los archivos estáticos se sirven directo, sin pasar por Next.js, así que las cabeceras de `next.config.ts` no les llegan. Solución pendiente: un archivo `public/_headers` con las mismas cabeceras, y su prueba.
- La otra falla es del entorno de prueba, no del Worker: la base local no tenía aplicada la migración 12 al correr.

Esa corrida fue manual. Falta dejarla en el workflow.

### Cómo probarlo en local

Con Supabase local arriba, crear `app/.dev.vars` (no se sube al repositorio) con `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` de `npx supabase status`, y luego:

```bash
npm run cf:preview
```

Dos tropiezos que costaron tiempo y conviene conocer:

- Si `.dev.vars` trae una variable vacía, el sitio responde 500 («Faltan SUPABASE_URL…») aunque la variable figure como cargada. Eso fue lo que pasó en esta sesión: Docker estaba apagado y el archivo se generó vacío.
- Si existe la variable `HTTPS_PROXY`, `wrangler dev` envía por ese proxy también las consultas a Supabase local, y se cancelan. Hay que lanzarlo sin esas variables.

## Medición del procesador (antes de cualquier cambio)

El Worker local no informa el tiempo de procesador por solicitud. Como aproximación se midió el servidor Node (`next start`) en esta máquina: tiempo de procesador del proceso, promedio de 40 solicitudes seguidas por página.

| Página | Procesador por solicitud |
|---|---|
| Inicio | 31 ms |
| Actividad (Convención 2026) | 26 ms |
| Galería | 26 ms |
| Nosotros | 20 ms |
| Artículos | 20 ms |
| Artículo | 20 ms |
| Eventos | 18 ms |
| Panel · Ingresar | 13 ms |
| `robots.txt` | 2 ms |

**Conclusión: tal como está, el sitio no cabe en los 10 ms del plan gratuito.** Las páginas públicas gastan entre 2 y 3 veces el límite. La medición real en Cloudflare puede diferir (otro motor, otra máquina), pero no por tanto.

Dos consecuencias:

- **Guardar las páginas públicas ya armadas es obligatorio**, no una mejora. Una página guardada se sirve sin armarla y gasta muy poco.
- **El panel no se puede guardar armado**, y su página más simple ya mide 13 ms. Es muy probable que el panel no quepa en el plan gratuito aunque el sitio público sí. Opciones: el plan de US$5 al mes (necesita a la directiva), o reducir el trabajo del proxy en cada solicitud del panel (hoy valida la sesión y consulta los roles en cada una). **No hay que dar por hecho que el plan gratuito alcanza.**

## Falta, en orden

1. **Medir en el Worker real**, cuando exista la cuenta, para confirmar estas cifras.
2. **Guardar las páginas públicas ya armadas.** Hoy cada página se arma en cada visita. Hay tres cosas del sitio actual que lo impiden y hay que rediseñar:
   - **La política de contenido (CSP) usa un valor distinto en cada visita** (PR #8). Una página guardada no puede llevar un valor nuevo cada vez. Alternativa: una política basada en la huella (hash) de los scripts, o `'self'` sin valor por visita. Es una decisión de seguridad y necesita sus pruebas.
   - **Las direcciones firmadas de las fotos vencen a las 2 horas** (PR #11). Una página guardada más tiempo mostraría fotos rotas. Alternativas: firmar por más tiempo y renovar la página antes de que venzan, o servir las fotos públicas por una ruta propia del sitio.
   - **Modo mantenimiento, redirecciones y páginas retiradas** se consultan en cada visita, en el proxy. Tendrían que avisar al guardado cuando cambian, y el proxy tendría que dejar de consultar la base en cada visita pública.
3. **Actualizar al instante al publicar, editar o retirar** desde el panel: cada acción del panel que cambia contenido público debe invalidar las páginas afectadas (`revalidateTag`). Son unas 40 acciones en `app/src/lib/admin/acciones-*.ts`. El guardado de OpenNext en Cloudflare necesita un almacén (KV o R2, ambos con capa gratuita): hay que confirmar que cabe en el plan gratuito.
4. **El panel nunca se guarda armado:** ya responde `private, no-store`; hay que añadir una prueba que lo confirme dentro del Worker.
5. **Subida de fotos dentro del Worker: sin probar.** Quitar los metadatos de una foto de 10 MB en JavaScript puede pasar los 10 ms de procesador. Si no cabe, hay que mover esa limpieza al navegador (donde ya se crean las versiones) y dejar en el servidor solo la verificación.
6. **Medir de nuevo** y confirmar que cada página queda bajo 10 ms.
7. Pruebas del Worker en el workflow (levantar `wrangler dev` y correr una parte de Playwright contra él).

## Aviso sobre el build

OpenNext copia el contenido de `app/.env.local` dentro del Worker. En local solo hay claves de desarrollo, pero **el build de producción debe hacerse sin archivos `.env` con claves**: las variables se cargan en la cuenta de Cloudflare.

## Dependencias nuevas

`@opennextjs/cloudflare` y `wrangler`, solo de desarrollo. `npm audit` marca avisos moderados en dependencias internas de esas herramientas (`glob`, `minimatch`); no forman parte del sitio que se sirve.
