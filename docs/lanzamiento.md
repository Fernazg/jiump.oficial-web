# Plan de lanzamiento a producción

Pasos en orden para pasar del repositorio a `jiump.cl`. Cada paso dice quién lo hace y si necesita autorización.

**🔒 Directiva** = no se ejecuta sin autorización expresa de la directiva (reglas 6 y 7 del README).
Nada de este plan se ha ejecutado: no se creó ninguna cuenta, no se desplegó nada y no se tocó Wix ni los DNS.

## Antes de empezar

- [ ] Mezclar los PR de la revisión profesional, en el orden de `docs/revision-profesional.md`.
- [ ] 🔒 **Directiva:** validar el modelo de datos y los permisos (`docs/modelo-datos.md`, `docs/roles-permisos.md`), que siguen como propuesta.
- [ ] 🔒 **Directiva:** decidir quiénes serán los dos primeros Superadministradores (paso 4). El alojamiento ya está decidido: Cloudflare (paso 2).
- [ ] La **cuenta de Gmail dedicada a JIUMP** es `jiump.soporte@gmail.com` (paso 3). Todas las demás cuentas se crean con ese correo, nunca con el correo personal de alguien, para que el sitio no dependa de una sola persona. Activarle la verificación en dos pasos y guardar el acceso entre dos personas de la directiva.

## 1. Supabase gratuito con la cuenta de JIUMP

🔒 **Directiva** (crea una cuenta a nombre de JIUMP). Sin costo.

1. Crear la cuenta en supabase.com con el Gmail de JIUMP y un proyecto en la región más cercana (São Paulo). Guardar la contraseña de la base en un lugar seguro.
2. Aplicar las migraciones (el `seed.sql` **no** se aplica en producción):

```bash
npx supabase link --project-ref <referencia-del-proyecto>
```

```bash
npx supabase db push
```

3. Configurar en el panel de Supabase lo que `config.toml` solo fija en local. La lista completa está en `supabase/README.md`; lo esencial:
   - Authentication → desactivar «Allow new users to sign up».
   - Authentication → Multi-Factor → habilitar TOTP.
   - Authentication → largo mínimo de contraseña: 10.
   - Authentication → URL Configuration → «Site URL» `https://jiump.cl` y, en Redirect URLs, `https://jiump.cl/admin/auth/confirmar**` y `https://jiump.cl/admin/bienvenida` (más las de la dirección temporal del paso 2).
4. Comprobar con la clave pública que un visitante no puede leer nada sin publicar ni escribir (las pruebas de `supabase/tests/api` muestran cómo).

**Límites del plan gratuito que importan:** 500 MB de base de datos, 1 GB de archivos y 5 GB de tráfico al mes; el proyecto se pausa tras una semana sin uso. **Atención con el espacio de las fotos.** El panel guarda la foto original además de sus versiones livianas. Una foto directa de cámara o celular pesa entre 3 y 8 MB: con 1 GB caben solo unas 150 a 300. Reducidas antes de subirlas (unos 2.000 px de ancho, menos de 1 MB) caben más de 1.000. Recomendación para Multimedia: **subir las fotos ya reducidas** y guardar los originales en el Drive de JIUMP. Cuando el espacio se acerque al límite, la directiva decide entre el plan pagado (US$25 al mes) o retirar fotos antiguas.

## 2. Alojamiento: Cloudflare Workers, plan gratuito

**Alojamiento elegido: Cloudflare Workers, plan gratuito.** Se descartó Vercel: su plan gratuito es para uso personal y limita cada envío a 4,5 MB, lo que haría fallar la subida de fotos grandes del panel.

🔒 **Directiva** (crea la cuenta a nombre de JIUMP). Sin costo.

Límites del plan gratuito: 10 ms de procesador por solicitud, 100.000 solicitudes al día y un Worker de hasta 3 MB comprimido. **El sitio público cabe:** el Worker entrega cada página pública ya armada sin pasar por Next.js, y en el motor de Cloudflare cada página guardada gasta entre 4,6 y 6 ms (medido en local; detalle y método en `docs/cloudflare.md`). El workflow «Pruebas» lo vuelve a medir en cada cambio y falla si una página llega a 10 ms.

Dos avisos:

- **Primera visita después de un cambio.** Cuando se publica o edita algo, la siguiente visita a cada página la arma de nuevo (20 a 35 ms) y la guarda. Lo mismo pasa con las búsquedas de Artículos y las direcciones que no existen, que no se guardan. Cloudflare tolera pasarse de vez en cuando, pero no está garantizado: en el ensayo del paso 6 hay que revisar que no aparezca el error «1102».
- **El panel no cabe en 10 ms** (no se puede guardar armado: cada persona ve lo suyo). Su página más simple mide 19 ms en el mismo motor. Se puede ensayar en el plan gratuito; si el ensayo muestra errores «1102» en el panel, la salida es el plan Workers Paid (US$5 al mes), que **necesita autorización de la directiva**.

### Crear la cuenta

1. Entrar a https://dash.cloudflare.com/sign-up y registrarse con **`jiump.soporte@gmail.com`** y una contraseña larga y única. Guardarla entre dos personas de la directiva.
2. Confirmar el correo desde la bandeja de `jiump.soporte@gmail.com`.
3. Activar la **verificación en dos pasos** de la cuenta de Cloudflare (My Profile → Authentication) y guardar los códigos de recuperación junto con la contraseña.
4. Elegir el plan **Free** cuando lo pregunte. No ingresar medios de pago.
5. No agregar todavía el dominio `jiump.cl`: eso es parte del paso 7.

### Antes del primer despliegue: migraciones

El Worker usa la función `estado_sitio()` de la migración `20261117000100_version_sitio.sql`. Aplicarla en Supabase de producción con el workflow «Migraciones de producción» (Actions → Run workflow). Sin ella el sitio funciona, pero arma cada página en cada visita (más de 10 ms).

### Conectar el repositorio desde el panel de Cloudflare (Workers Builds)

Cloudflare compila y despliega solo cada vez que cambia `main`. Sin costo (el plan gratuito incluye minutos de compilación).

1. En https://dash.cloudflare.com: **Workers & Pages → Create → Workers → Import a repository**.
2. **Connect GitHub**: autorizar la app de Cloudflare **solo** para el repositorio `Fernazg/jiump.oficial-web`.
3. Configurar la compilación:

| Campo | Valor |
|---|---|
| Project name | `jiump-sitio` (debe coincidir con `name` en `app/wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | `app` |
| Build command | `npm run cf:build` |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | Desactivado |

4. **Create and deploy.** El primer despliegue crea solo el espacio de KV `PAGINAS` (gratis) y deja el sitio en una dirección temporal `jiump-sitio.<cuenta>.workers.dev`, **sin tocar el dominio**.
5. Cargar las variables en **Workers → jiump-sitio → Settings → Variables and Secrets**, todas como **Secret** (nunca en el repositorio ni en el chat):

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Dirección del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave pública (anon). El sitio se niega a arrancar si aquí va una clave secreta |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio. Solo la usa «Invitar usuario» |
| `SITIO_URL` | La dirección temporal mientras dure el ensayo; `https://jiump.cl` en el paso 7 |

6. **Deployments → Retry build** (o un cambio en `main`) para que el sitio arranque con las variables.
7. Agregar la dirección temporal a las Redirect URLs de Supabase (paso 1) y abrirla: Inicio debe cargar. En **Workers → jiump-sitio → Observability** se ve el procesador de cada visita.

## 3. Correo con la cuenta de Gmail de JIUMP

Sin costo. Lo configura el equipo técnico con acceso de la directiva a la cuenta.

El correo incluido en Supabase gratuito envía muy pocos mensajes por hora y no sirve para invitar al equipo. Se reemplaza por el Gmail de JIUMP:

1. En la cuenta de Gmail: activar la verificación en dos pasos y crear una **contraseña de aplicación**.
2. En Supabase → Authentication → Emails → SMTP: servidor `smtp.gmail.com`, puerto `465`, usuario el correo de JIUMP, contraseña la de aplicación, remitente «JIUMP».
3. Traducir al español las plantillas de «Invitación» y «Recuperar contraseña» (Authentication → Emails → Templates).
4. Probar: invitar a una persona de prueba y recuperar una contraseña.

Gmail permite unos 500 correos al día: sobra para el panel. La contraseña de aplicación se guarda solo en Supabase.

## 4. Alta de los dos primeros Superadministradores

🔒 **Directiva** (decide quiénes son). Debe haber **al menos dos** desde el primer día: si hubiera uno solo y perdiera su teléfono, nadie podría administrar usuarios.

El procedimiento exacto está en `supabase/README.md` › «Alta de los primeros superadmins». En resumen, para cada uno:

1. Crear su cuenta desde el panel de Supabase (Authentication → Users → Invite).
2. La persona entra a `/admin`, crea su contraseña y **activa su doble factor** con una app autenticadora.
3. **Después**, asignarle el rol de Superadministrador desde el editor SQL de Supabase. El orden importa: la base solo reconoce el rol si el doble factor es anterior.

Desde ahí, el resto del equipo se invita desde el panel (Usuarios → Invitar).

Cada Superadministrador debe guardar su app autenticadora con respaldo (por ejemplo, la copia en la nube de Google Authenticator). Si alguien cambia de teléfono, otro Superadministrador le reasigna el rol.

## 5. Migración del contenido desde Wix y redirecciones

🔒 **Directiva** (entrega el contenido pendiente de `docs/pendientes.md`). **Wix no se modifica en ningún momento:** solo se lee.

1. **Respaldo de Wix primero:** guardar copia de todos los artículos, fotos y textos antes de empezar.
2. **Todo el contenido se carga desde el panel**, no directo en la base:
   - Las fotos subidas desde el panel pierden su ubicación (GPS), reciben texto alternativo y generan las versiones livianas. Una foto cargada por otro camino queda pesada y hace lento el sitio.
   - Cada álbum, con fotos de un solo evento (regla 2).
3. Artículos (más de 130): conservar título, fecha original, autor si existe, serie y temas. No se inventan autores ni fechas (regla 1).
4. Textos de «Quiénes somos» y «Qué creemos»: copiados sin cambios desde el sitio actual, en Información institucional.
5. No se migra: directorio, podcast, recursos, contacto, ofrendas ni donaciones (reglas 4 y 5).
6. **Redirecciones.** Hacer la lista de todas las direcciones del sitio actual (el mapa del sitio de Wix la entrega) y, para cada una:
   - `/post/<nombre>` ya redirige solo al artículo con el mismo nombre. Si el nombre cambió, agregar la redirección en Configuración.
   - Las demás páginas (por ejemplo `/quienes-somos` → `/nosotros`): agregarlas en Configuración → Redirecciones.
   - Las de secciones eliminadas: redirigirlas a Inicio.
7. Completar en el panel el título y la descripción para buscadores de cada página y la foto para compartir.

## 6. Pruebas finales y respaldo

Todo en la dirección temporal, antes de tocar el dominio.

- [ ] Workflow «Pruebas» en verde sobre `main`.
- [ ] **Ensayo de alojamiento:** recorrer todas las páginas; subir una foto de 10 MB desde un celular; publicar, editar y retirar un artículo; invitar a una persona. Revisar el registro del alojamiento: no debe haber errores (en Cloudflare, atención al error «1102»).
- [ ] Lighthouse en la dirección temporal, celular: 90 o más en rendimiento, 95 o más en lo demás.
- [ ] Cada rol entra y ve solo lo suyo. Un Superadministrador sin doble factor no entra.
- [ ] Todas las direcciones antiguas de la lista redirigen bien.
- [ ] Compartir un artículo por WhatsApp: se ve con título, descripción y foto.
- [ ] Configurar el respaldo (`docs/operacion.md`): los dos secretos en GitHub, ejecutarlo a mano y **ensayar una restauración** en un proyecto de prueba.
- [ ] Decidir dónde se respaldan los archivos de las fotos.
- [ ] Opcional, gratis: activar en Supabase el CAPTCHA de Cloudflare Turnstile para el ingreso, y una vigilancia de disponibilidad.
- [ ] 🔒 **Directiva:** revisión y aprobación final del sitio completo en la dirección temporal.

## 7. Cambio de DNS, al final y con vuelta atrás

🔒 **Directiva** y el **titular del dominio** en NIC Chile. Es el único paso que afecta al sitio actual.

Antes:

1. Renovar `jiump.cl` si falta poco para su vencimiento (1 de febrero de 2027).
2. **Copiar todos los registros DNS que hoy administra Wix** al nuevo proveedor (Cloudflare), sobre todo los de correo (MX y TXT), si existen.
3. Agregar el dominio en el alojamiento, cambiar `SITIO_URL` a `https://jiump.cl` y confirmar que las Redirect URLs de Supabase incluyen el dominio.
4. Elegir un día y una hora de poco tráfico, con el equipo técnico disponible las 48 horas siguientes.
5. Ejecutar un respaldo a mano.

El cambio:

6. El titular cambia los servidores de nombre en NIC Chile, de `ns4.wixdns.net` y `ns5.wixdns.net` a los que indique Cloudflare. Tarda entre minutos y 48 horas.

Después:

7. Verificar: el sitio carga con HTTPS, el panel permite ingresar, llegan los correos de invitación, las redirecciones funcionan.
8. Dar de alta el sitio en Google Search Console y enviar `https://jiump.cl/sitemap.xml`.

**Cómo volver atrás.** Si algo falla, el titular restaura en NIC Chile los servidores `ns4.wixdns.net` y `ns5.wixdns.net`. El sitio de Wix vuelve a verse tal como estaba, porque nunca se modificó.

**Wix no se cancela** hasta que el sitio nuevo lleve al menos dos semanas funcionando bien y la directiva lo autorice. Mientras Wix siga contratado, la vuelta atrás existe.

## Resumen de autorizaciones

| Paso | Necesita a la directiva | Costo |
|---|---|---|
| Cuenta de Gmail de JIUMP | Sí (acceso compartido) | Gratis |
| 1. Supabase | Sí | Gratis |
| 2. Alojamiento (Cloudflare) | Sí (crea la cuenta) | Gratis; US$5 al mes solo si el panel da errores «1102» en el ensayo |
| 3. Correo | No (usa la cuenta ya creada) | Gratis |
| 4. Superadministradores | Sí (quiénes) | Gratis |
| 5. Contenido y redirecciones | Sí (entrega el contenido) | Gratis |
| 6. Pruebas y respaldo | Sí (aprobación final) | Gratis |
| 7. DNS | Sí, y el titular del dominio | Renovación anual del dominio |
| Cancelar Wix | Sí | Ahorra el plan de Wix |

Fuentes de la comparación de alojamiento: [límites de Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits), [OpenNext para Cloudflare](https://opennext.js.org/cloudflare), [plan Hobby de Vercel](https://vercel.com/docs/plans/hobby) y [uso justo de Vercel](https://vercel.com/docs/platform/fair-use-policy). Conviene volver a leerlas al decidir: estos límites cambian.
