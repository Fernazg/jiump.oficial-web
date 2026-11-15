# Revisión profesional del sitio y del panel

Bitácora de la revisión de seguridad, calidad, accesibilidad, rendimiento y SEO.
Se actualiza a medida que avanza el trabajo. Lo pendiente está al final.

## 1. Punto de partida (15 nov 2026, rama `main`, commit `4e0648d`)

### Pruebas

| Conjunto | Resultado |
|---|---|
| Lint del esquema (`supabase db lint`) | sin errores |
| pgTAP (base de datos) | 797 pruebas, todas pasan |
| Integración HTTP | 9 pruebas, todas pasan |
| Tipos (`tsc`) y compilación | sin errores |
| Playwright (sitio y panel) | 88 pruebas, todas pasan, en 6,4 min |

### Lighthouse

Medido contra el build de producción en local (Supabase local, datos del seed).
Cada celda: **rendimiento / accesibilidad / buenas prácticas / SEO**.

| Página | Escritorio | Celular | LCP en celular |
|---|---|---|---|
| Inicio | 100 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 0.6 s |
| Nosotros | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 0.6 s |
| Eventos | 100 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 0.8 s |
| Actividad (Convención 2026) | 95 / 100 / 100 / 100 | 73 / 100 / 100 / 100 | 7.2 s |
| Artículos | 100 / 96 / 100 / 100 | 99 / 96 / 100 / 100 | 0.6 s |
| Artículo | 100 / 96 / 100 / 91 | 99 / 96 / 100 / 91 | 0.6 s |
| Galería | 94 / 98 / 100 / 100 | 81 / 98 / 100 / 100 | 4.2 s |
| Panel · Ingresar | 100 / 100 / 100 / 63 | 100 / 100 / 100 / 63 | 0.8 s |
| Panel · Escritorio | 100 / 100 / 100 / 63 | 100 / 100 / 100 / 63 | 0.6 s |
| Panel · Artículos | 100 / 100 / 100 / 63 | 98 / 100 / 100 / 63 | 0.7 s |
| Panel · Fotos | 99 / 100 / 100 / 63 | 82 / 100 / 100 / 63 | 4.0 s |
| Panel · Eventos | 100 / 100 / 100 / 63 | 100 / 100 / 100 / 63 | 0.8 s |

Lo que no llegaba a la meta (95 en accesibilidad, buenas prácticas y SEO; 90 en rendimiento en celular):

- **Actividad, celular: rendimiento 73.** La foto principal tarda 7,2 s en aparecer.
- **Galería, celular: rendimiento 81.** Lo mismo, 4,2 s.
- **Panel · Fotos, celular: rendimiento 82.**
- **Artículo: SEO 91.** Falta la descripción de la página.
- **Artículos y Artículo: accesibilidad 96.** Un texto con poco contraste.
- **Galería: accesibilidad 98.** Orden de los títulos.
- **Panel: SEO 63.** Es a propósito: el panel pide a los buscadores que no lo indexen. No se corrige.

## 2. Hallazgos y correcciones

### PR 0 · Prueba inestable «doble factor opcional para Editor» ([#7](https://github.com/Fernazg/jiump.oficial-web/pull/7))

- **Causa:** el ayudante de pruebas esperaba hasta 30 s a que cambiara el código del doble factor cada vez que la misma persona ingresaba dos veces seguidas, por suponer que el servidor rechaza un código repetido. Supabase Auth lo acepta, así que la espera sobraba.
- **Corrección:** las pruebas usan el código vigente, sin esperar.
- **Otras pruebas con el mismo problema:** `admin-sitio` y `admin-usuarios` tenían el límite subido a 120 s para tapar la misma espera. Se quitó ese límite.
- **Resultado:** la prueba pasó de 14 s (hasta 30 s) a 1,7 s. La suite completa, de 6,4 a 3,2 min. Ninguna prueba supera los 11 s.

### PR 1 · Seguridad y privacidad ([#8](https://github.com/Fernazg/jiump.oficial-web/pull/8))

| Gravedad | Hallazgo | Corrección |
|---|---|---|
| Media | El sitio y el panel no enviaban ninguna cabecera de seguridad: el panel se podía mostrar dentro de un marco en otra página y un código inyectado en un texto se habría ejecutado. | Cabeceras en todas las respuestas y política de contenido (CSP) con un valor distinto en cada visita. |
| Baja | Con la clave pública, el visitante podía pedir columnas internas: qué cuenta creó y editó cada contenido y su paso por la papelera. | Migración 12: el visitante tiene permiso columna por columna. |
| Baja | Abrir `/admin/salir` como enlace cerraba la sesión de cualquiera. | Solo se cierra con el botón, o si la cuenta está desactivada. |
| Baja | Una redirección con destino `//otro-sitio` llevaba a otro dominio. | Se rechaza en el panel y en la base. |
| Baja | Auth local aceptaba contraseñas de 6 caracteres por la API. | Mínimo 10, igual que el panel. |

Revisado sin cambios: RLS por rol, doble factor, uso de la service role (solo para invitar), cookies de sesión, fotos privadas con URL firmadas, limpieza de GPS y EXIF, y dependencias (0 vulnerabilidades).

### PR 2 · Errores y pruebas ([#9](https://github.com/Fernazg/jiump.oficial-web/pull/9))

- `/articulos?q=%00`, `/articulos?q=a&q=b` y `/articulos/%E0%A4%A` daban error 500. Corregido: los parámetros se limpian y una dirección mal codificada responde 400.
- No había páginas de error. Ahora hay avisos propios en español con «Reintentar», para el sitio y el panel.
- Con la base de datos caída, cada visita tardaba unos 14 s en mostrar el error. Ahora responde en menos de 1 s.
- Con la base caída, «Ingresar» culpaba a la contraseña. Ahora avisa que no hay conexión.
- 15 pruebas nuevas, con un segundo servidor de prueba que simula la base caída.

## 3. Decisiones tomadas

| Decisión | Motivo |
|---|---|
| La bitácora y `docs/lanzamiento.md` van solo en el PR de documentación | Si cada PR tocara la bitácora, todos chocarían entre sí al mezclarlos. |
| Las pruebas del doble factor usan el código vigente en vez de esperar uno nuevo | Supabase Auth acepta el mismo código dentro de su ventana; esperar solo hacía lentas e inestables las pruebas. |
| HSTS sin `includeSubDomains` | `jiump.cl` podría tener otros subdominios que este sitio no controla. |
| CSP: estilos con `unsafe-inline`, scripts estrictos | React escribe estilos en atributos y no se pueden marcar uno a uno. Lo que importa (los scripts) queda cerrado. |
| Una columna nueva nace cerrada para el visitante | Más seguro por defecto. Si el sitio debe mostrarla, su migración le da permiso. |
| Sin reintentos automáticos en las consultas del sitio público | En una caída real hacían esperar 14 s a cada visitante. |

## 4. Pendiente

- Supabase Auth acepta dos veces el mismo código del doble factor dentro de su ventana de 30 a 90 s. Es comportamiento del servicio, no del panel. Riesgo bajo: hace falta la contraseña y ver el código en esos segundos.
- **Límite de intentos de ingreso.** Hoy depende del límite de Supabase Auth, que cuenta por la dirección del servidor del sitio y no por visitante. Para reforzarlo conviene activar el CAPTCHA gratuito de Cloudflare Turnstile en Supabase. Necesita una cuenta en la nube: va en el plan de lanzamiento.
- **Duración de las sesiones.** Limitar la sesión por tiempo o por inactividad es una función del plan pagado de Supabase. Sin costo, la sesión se corta al cerrar sesión o al desactivar a la persona.
- Hay un PR anterior abierto que no es de esta revisión: [#6](https://github.com/Fernazg/jiump.oficial-web/pull/6) (reintento del workflow si un puerto está ocupado). No se tocó.
