# jiump.oficial-web

Nuevo sitio web de **JIUMP — Jóvenes Unidos para Adorar a Cristo**, movimiento juvenil de la Iglesia Unida Metodista Pentecostal. Reemplazará al sitio actual en Wix (jiump.cl).

## Estado

| Etapa | Estado |
|---|---|
| Auditoría del sitio actual | ✅ |
| Diseño visual (escritorio, tablet, celular) y panel /admin | ✅ aprobado |
| Modelo de datos y permisos | 📝 propuesta en `docs/` (por validar) |
| Backend (base de datos, acceso, archivos) | ⏳ siguiente |
| Sitio público y panel /admin | ⏳ |
| Migración de contenido desde Wix | ⏳ |
| Pruebas y lanzamiento (cambio de DNS) | ⏳ |

## Estructura

```
docs/                 Documentación del proyecto (leer primero)
  diseno.md           Paleta, tipografía, componentes y reglas responsive aprobadas
  modelo-datos.md     Propuesta de tablas y relaciones
  roles-permisos.md   Roles del panel y qué puede hacer cada uno
  migracion-wix.md    Contenido a migrar, dominio y plan de lanzamiento
  pendientes.md       Contenido que aún debe entregar JIUMP
design/
  capturas/           Capturas de cada página (escritorio 1440 px y celular 390 px)
  prototipos/         Prototipos HTML fuente (formato del lienzo de diseño)
  fotos/              Fotos reales usadas en el diseño + índice
supabase/             (vacío) migraciones SQL, políticas y semillas
app/                  (vacío) sitio y panel
```

## Tecnología propuesta

Propuesta inicial, abierta a cambios del equipo de desarrollo:

- **Next.js + TypeScript + Tailwind** para el sitio y el panel /admin.
- **Supabase** (PostgreSQL, autenticación, almacenamiento de fotos, Row Level Security). Plan gratuito para empezar.
- **Alojamiento:** Cloudflare (gratuito, recomendado) o Vercel Pro (US$20/mes). **Pendiente de decisión.**

## Reglas del proyecto (acordadas con la directiva)


1. **Respetar el manual de identidad** (ver `docs/diseno.md`).
2. **El sitio no incluye ofrendas, donaciones, aportes económicos ni solicitudes de dinero**, en ninguna parte (sitio, menú ni panel).
3. **No tocar Wix ni los DNS de jiump.cl** hasta que el sitio nuevo esté terminado, respaldado, probado y aprobado.
4. **No contratar servicios ni planes pagados** sin autorización de la directiva.
5. Los permisos se validan **en el servidor y en la base de datos**, nunca solo en la interfaz.
6. Las claves y contraseñas **nunca** se suben al repositorio (usar variables de entorno).

## Cómo ver el diseño

- Lo más rápido: abrir las imágenes de `design/capturas/`.
- Los prototipos de `design/prototipos/` se diseñaron en un lienzo que los procesa; abiertos directamente en el navegador muestran las plantillas sin datos (`{{ }}`). Sirven como referencia exacta de estilos, textos y estructura.

## Contacto del proyecto

Coordinación: Fernando (JIUMP).
