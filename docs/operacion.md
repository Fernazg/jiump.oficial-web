# Operación del sitio: errores, respaldos y continuidad

Guía para quien mantenga el sitio de JIUMP una vez lanzado. Todo lo que está aquí es gratuito. Lo que necesita una cuenta o una decisión de la directiva está marcado como **pendiente**.

## 1. Si algo falla

### Qué ve la persona

- Un aviso «No pudimos cargar esta página», con el botón «Reintentar» y un **código para soporte** (un número).
- Si el problema es de todo el sitio y va a durar, un Superadministrador puede activar el **modo mantenimiento** en el panel (Configuración). El panel sigue funcionando.

### Dónde mirar

1. **Registro del alojamiento** (Cloudflare o Vercel, sección de registros o «Logs»). Cada error del servidor deja una línea que empieza con `{"nivel":"error","origen":"jiump-sitio"…`. Busca el código para soporte en el campo `digest`: esa línea dice qué página falló y por qué.
2. **Estado de Supabase:** https://status.supabase.com y el panel del proyecto (Logs). Si la base no responde, el sitio muestra el aviso de error en menos de un segundo y se recupera solo cuando vuelve.
3. **Workflow «Pruebas»** en GitHub (pestaña Actions): si el último cambio dejó algo en rojo, ahí está el detalle.

El registro no guarda datos personales: ni cookies, ni formularios, ni los parámetros de la dirección.

### Avisos automáticos (pendiente, gratis)

Hoy nadie recibe un aviso si el sitio se cae. Dos opciones gratuitas, que necesitan crear una cuenta con el correo de JIUMP:

- **Vigilancia de disponibilidad** (por ejemplo UptimeRobot, plan gratuito): revisa el sitio cada 5 minutos y manda un correo si no responde. Es lo más útil y se configura en 10 minutos.
- **Avisos de errores** (por ejemplo Sentry, plan gratuito): junta los errores y avisa por correo. Solo vale la pena si el equipo técnico va a mirarlos.

Ninguna se instaló: crear cuentas necesita autorización.

## 2. Respaldos

### Base de datos (automático, cifrado)

El workflow `.github/workflows/respaldo.yml` hace un respaldo completo cada lunes y lo guarda cifrado por 90 días en GitHub. **No hace nada hasta que se configuren dos secretos** (GitHub → Settings → Secrets and variables → Actions):

| Secreto | Qué es | De dónde sale |
|---|---|---|
| `SUPABASE_DB_URL` | Dirección de conexión a la base | Supabase → botón «Connect» → «Session pooler». Incluye la contraseña de la base. |
| `RESPALDO_CLAVE` | Frase larga para cifrar el respaldo | La inventa la directiva. **Guardarla en dos lugares seguros**: sin ella, el respaldo no se puede abrir. |

Por qué va cifrado: el respaldo incluye los correos del equipo.

Para probarlo: Actions → «Respaldo» → «Run workflow». Al terminar, el archivo aparece en la ejecución, en «Artifacts».

El plan gratuito de Supabase no incluye respaldos automáticos propios; este workflow los reemplaza.

### Cómo restaurar

1. Descargar el archivo `jiump-respaldo-AAAA-MM-DD.tar.gz.gpg` desde la ejecución del workflow.
2. Descifrarlo y descomprimirlo (pide la frase):

```bash
gpg --decrypt jiump-respaldo-AAAA-MM-DD.tar.gz.gpg | tar -xz
```

3. En un proyecto de Supabase **nuevo y vacío**, aplicar los archivos en orden, con la dirección de conexión de ese proyecto:

```bash
psql "$DIRECCION_DE_LA_BASE_NUEVA" -f respaldo/1-roles.sql -f respaldo/2-estructura.sql
```

```bash
psql "$DIRECCION_DE_LA_BASE_NUEVA" -c "set session_replication_role = replica" -f respaldo/4-cuentas-y-archivos.sql -f respaldo/3-datos.sql
```

4. Cambiar `SUPABASE_URL` y las claves en el alojamiento para que apunten al proyecto nuevo.

**Hacer un ensayo de restauración antes del lanzamiento** y después una vez al año. Un respaldo que nunca se probó no es un respaldo.

### Respaldo de las fotos (pendiente de decisión)

El respaldo de la base guarda la lista de fotos, pero **no los archivos**. GitHub no sirve para guardarlos (el espacio gratuito es de 500 MB). Opciones sin costo:

- **Recomendada:** que Multimedia conserve los originales de cada evento en el Google Drive de la cuenta de JIUMP (15 GB gratis), en una carpeta por evento. Es simple y no depende de nadie técnico.
- Alternativa técnica: una copia mensual del almacenamiento de Supabase a ese mismo Drive con `rclone`. Requiere que alguien la configure y la vigile.

Queda anotado en `docs/pendientes.md` para que la directiva elija.

### Antes de un cambio grande

Antes de migrar contenido o de un cambio importante: ejecutar el respaldo a mano (Actions → Respaldo → Run workflow) y esperar a que termine.

## 3. Mantenimiento periódico

| Cada cuánto | Qué hacer |
|---|---|
| Cada mes | Revisar los PR de Dependabot (actualizaciones). Si «Pruebas» está en verde, mezclarlos. |
| Cada mes | Comprobar que el último «Respaldo» terminó bien. |
| Cada 3 meses | Revisar en Supabase el uso del plan gratuito (base de datos, almacenamiento y tráfico). |
| Cada año | Renovar el dominio `jiump.cl` en NIC Chile (vence el 1 de febrero). Ensayar una restauración. |
| Cuando alguien deja el equipo | Desactivar su cuenta en el panel (Usuarios). Corta su acceso al instante. |

**El plan gratuito de Supabase pausa los proyectos sin uso durante una semana.** Con visitas diarias no ocurre. Si ocurriera, se reactiva desde el panel de Supabase.

## 4. Para quien continúe el proyecto

Leer en este orden:

1. `README.md`: qué es el proyecto y las **reglas acordadas con la directiva** (son obligatorias).
2. `docs/roles-permisos.md` y `docs/modelo-datos.md`: quién puede hacer qué y cómo se guardan los datos.
3. `supabase/README.md`: base de datos, permisos, cómo levantar todo en local y la revisión de seguridad.
4. `app/README.md`: el sitio y el panel, con una guía corta por tema (seguridad, errores, rendimiento, SEO, crecimiento).
5. `docs/revision-profesional.md`: qué se revisó, qué se decidió y por qué.
6. `docs/lanzamiento.md`: el plan para pasar a producción.

### Cómo se trabaja

- Cada cambio va en un PR pequeño desde `main`. El workflow «Pruebas» levanta una base local y corre todo: nada se mezcla en rojo.
- Cada corrección lleva su prueba. Hay pruebas de base de datos (pgTAP), de permisos por HTTP y del sitio y el panel completos (Playwright).
- Los permisos se validan en la base de datos (RLS), no solo en la interfaz.
- Lo que cambia el aspecto aprobado va en un PR aparte, con capturas, para la directiva.

### Para agregar una sección nueva al sitio

1. La tabla y sus permisos, en una migración nueva con sus pruebas (`supabase/`). Recordar: una columna nueva nace cerrada para el visitante.
2. La página en `app/src/app/(sitio)/`, usando `metadatos()` para el SEO.
3. Su pantalla en el panel en `app/src/app/admin/(panel)/`, registrada en `src/lib/admin/secciones.ts` con sus roles, y con su ayuda breve.
4. Agregarla al mapa del sitio (`src/app/sitemap.ts`) y a las listas de `tests/accesibilidad.spec.ts`.
5. Verificar que no rompe las reglas 4 y 5 del README (nada de dinero, nada de secciones eliminadas): hay pruebas que lo revisan.
