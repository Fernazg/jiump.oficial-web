# Revisión profesional del sitio y del panel

Bitácora de la revisión de seguridad, errores, accesibilidad, rendimiento, SEO, código, panel y operación, hecha el 15 de noviembre de 2026 sobre `main` (commit `4e0648d`). El resumen está primero; el detalle, después.

## Resumen

- **Ningún hallazgo de seguridad alto o medio queda sin corregir.** Se encontró uno medio y cuatro bajos; todos tienen corrección y prueba.
- **Todas las pruebas pasan**, y hay 86 pruebas nuevas del sitio y el panel más 17 de base de datos.
- **El sitio público cumple las metas de Lighthouse** en todas sus páginas. Una pantalla del panel (Biblioteca de fotos) queda en 85 en celular.
- Son **10 PR**. Nueve se pueden mezclar en orden; uno cambia el aspecto y espera a la directiva.
- No se creó ninguna cuenta, no se desplegó nada y no se tocó Wix ni los DNS.

## Orden para mezclar los PR

Mezclarlos en este orden. Los que dependen de otro incluyen sus commits; al mezclar en orden, cada uno muestra solo lo suyo. Se comprobó en local que los siete primeros se mezclan en orden sin conflictos.

| Orden | PR | Tema | Depende de |
|---|---|---|---|
| 1 | [#7](https://github.com/Fernazg/jiump.oficial-web/pull/7) | Prueba inestable del doble factor | nada |
| 2 | [#8](https://github.com/Fernazg/jiump.oficial-web/pull/8) | Seguridad y privacidad | nada |
| 3 | [#9](https://github.com/Fernazg/jiump.oficial-web/pull/9) | Errores y pruebas | nada |
| 4 | [#10](https://github.com/Fernazg/jiump.oficial-web/pull/10) | Accesibilidad | nada |
| 5 | [#11](https://github.com/Fernazg/jiump.oficial-web/pull/11) | Rendimiento | #10 |
| 6 | [#12](https://github.com/Fernazg/jiump.oficial-web/pull/12) | SEO | #11 |
| 7 | [#13](https://github.com/Fernazg/jiump.oficial-web/pull/13) | Código y escalabilidad | #7 a #12 |
| 8 | [#14](https://github.com/Fernazg/jiump.oficial-web/pull/14) | Experiencia del panel | #13 |
| 9 | [#16](https://github.com/Fernazg/jiump.oficial-web/pull/16) | Operación (errores, respaldo, guía) | nada |
| 10 | este PR | Documentación (bitácora y plan de lanzamiento) | conviene mezclarlo después de #16, que trae `docs/operacion.md` |
| aparte | [#15](https://github.com/Fernazg/jiump.oficial-web/pull/15) | **Cambio visual:** contraste en la cabecera azul de los artículos | #10, y **la aprobación de la directiva** |

Hay un PR anterior abierto que no es de esta revisión y no se tocó: [#6](https://github.com/Fernazg/jiump.oficial-web/pull/6) (reintento del workflow si un puerto está ocupado).

## 1. Resultados, antes y después

### Pruebas

| Conjunto | Antes | Después (todos los PR juntos) |
|---|---|---|
| Lint del esquema | sin errores | sin errores |
| pgTAP (base de datos) | 797 pasan | 814 pasan |
| Integración HTTP | 9 pasan | 9 pasan |
| Tipos y compilación | sin errores | sin errores |
| Playwright (sitio y panel) | 88 pasan, en 6,4 min | 174 pasan, en 6,0 min |

«Después» se midió en local, desde una base limpia, con los PR #7 a #14 unidos. El PR #16 se probó por separado (90 pasan, con sus 2 pruebas nuevas). En GitHub, el workflow corre sobre cada PR.

### Lighthouse

Build de producción en local. Cada celda: **rendimiento / accesibilidad / buenas prácticas / SEO**.

| Página | Escritorio antes | Escritorio después | Celular antes | Celular después |
|---|---|---|---|---|
| Inicio | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| Nosotros | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| Eventos | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| Actividad | 95 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 73 / 100 / 100 / 100 | 94 / 100 / 100 / 100 |
| Artículos | 100 / 96 / 100 / 100 | 100 / 100 / 100 / 100 | 99 / 96 / 100 / 100 | 100 / 100 / 100 / 100 |
| Artículo | 100 / 96 / 100 / 91 | 100 / 100 / 100 / 100 | 99 / 96 / 100 / 91 | 100 / 100 / 100 / 100 |
| Galería | 94 / 98 / 100 / 100 | 100 / 100 / 100 / 100 | 81 / 98 / 100 / 100 | 96 / 100 / 100 / 100 |
| Panel · Ingresar | 100 / 100 / 100 / 63 | 100 / 100 / 100 / 66 | 100 / 100 / 100 / 63 | 100 / 100 / 100 / 66 |
| Panel · Escritorio | 100 / 100 / 100 / 63 | sin medir | 100 / 100 / 100 / 63 | 100 / 100 / 100 / 66 |
| Panel · Artículos | 100 / 100 / 100 / 63 | 99 / 100 / 100 / 66 | 98 / 100 / 100 / 63 | 91 / 100 / 100 / 66 |
| Panel · Fotos | 99 / 100 / 100 / 63 | 99 / 100 / 100 / 66 | 82 / 100 / 100 / 63 | 85 / 100 / 100 / 66 |
| Panel · Eventos | 100 / 100 / 100 / 63 | 99 / 100 / 100 / 66 | 100 / 100 / 100 / 63 | 92 / 100 / 100 / 66 |

Cómo leer la tabla:

- **«Después» incluye el PR visual #15.** Sin él, Artículos y Artículo quedan en 96 de accesibilidad (la meta es 95).
- **«Antes» usó las fotos de prueba sin versiones optimizadas y «después», con ellas**, que es como quedan las fotos subidas desde el panel. Por eso la mejora de Actividad (73 a 94) y Galería (81 a 96) viene en parte de las fotos optimizadas y en parte del PR de rendimiento. Con las mismas fotos optimizadas y sin el PR, Galería marcaba 88.
- **Panel · SEO 66 es a propósito:** el panel pide a los buscadores que no lo indexen.
- **Panel · Fotos queda en 85 en celular**, bajo la meta de 90. Muestra 47 miniaturas a la vez; con la biblioteca paginada (60 por página) no empeorará al crecer. Es una pantalla interna.
- **Panel · Artículos y Eventos bajaron unos puntos en celular** (98 a 91 y 100 a 92). Siguen sobre la meta. No investigué la causa; la sospecha es el aviso «Cargando…», que retrasa lo que Lighthouse toma como contenido principal.
- «Panel · Escritorio» en escritorio quedó sin medir al final: Lighthouse falló en esa pasada y no la repetí.

## 2. Hallazgos corregidos, por gravedad

### Seguridad ([#8](https://github.com/Fernazg/jiump.oficial-web/pull/8))

| Gravedad | Hallazgo | Corrección |
|---|---|---|
| Media | El sitio y el panel no enviaban ninguna cabecera de seguridad: el panel se podía mostrar dentro de un marco en otra página (clickjacking) y un código inyectado en un texto se habría ejecutado. | Cabeceras en todas las respuestas y política de contenido (CSP) con un valor distinto en cada visita. |
| Baja | Con la clave pública, el visitante podía pedir columnas internas: qué cuenta creó y editó cada contenido y su paso por la papelera. | Migración 12: el visitante tiene permiso columna por columna. |
| Baja | Abrir `/admin/salir` como enlace cerraba la sesión de cualquiera. | Solo se cierra con el botón, o si la cuenta está desactivada. |
| Baja | Una redirección con destino `//otro-sitio` llevaba a otro dominio. | Se rechaza en el panel y en la base. |
| Baja | Auth local aceptaba contraseñas de 6 caracteres por la API. | Mínimo 10, igual que el panel. |

Revisado sin cambios: RLS por rol, doble factor ligado a un factor anterior al rol, uso de la service role (solo para invitar), cookies de sesión, fotos privadas con URL firmadas, limpieza de GPS y EXIF, y dependencias (0 vulnerabilidades).

### Errores ([#9](https://github.com/Fernazg/jiump.oficial-web/pull/9))

- `/articulos?q=%00`, `/articulos?q=a&q=b` y `/articulos/%E0%A4%A` daban error 500. Ahora los parámetros se limpian y una dirección mal codificada responde 400.
- No había páginas de error. Ahora hay avisos propios en español con «Reintentar».
- Con la base de datos caída, cada visita tardaba unos 14 s en mostrar el error. Ahora, menos de 1 s.
- Con la base caída, «Ingresar» culpaba a la contraseña. Ahora avisa que no hay conexión.

### Prueba inestable ([#7](https://github.com/Fernazg/jiump.oficial-web/pull/7))

- **Causa:** el ayudante de pruebas esperaba hasta 30 s a que cambiara el código del doble factor cada vez que la misma persona ingresaba dos veces seguidas, por suponer que el servidor rechaza un código repetido. Supabase Auth lo acepta.
- **Otras pruebas con el mismo problema:** `admin-sitio` y `admin-usuarios` tenían el límite subido a 120 s para taparlo. Se quitó.
- La prueba pasó de 14 s (hasta 30 s) a 1,7 s.

### Escalabilidad ([#13](https://github.com/Fernazg/jiump.oficial-web/pull/13))

- Supabase corta las consultas en 1.000 filas sin avisar: con más de 1.000 fotos, la biblioteca y los selectores habrían quedado incompletos. Ahora se lee por tramos.
- Inicio, el listado y cada artículo traían el cuerpo completo de todos los artículos ([#11](https://github.com/Fernazg/jiump.oficial-web/pull/11)).

## 3. Mejoras aplicadas y qué gana el sitio

| Mejora | PR | Qué gana el sitio |
|---|---|---|
| Cabeceras de seguridad y CSP | #8 | Un código malicioso inyectado no se ejecuta; nadie puede enmarcar el panel para engañar al equipo. |
| Columnas internas cerradas | #8 | El visitante no puede saber qué cuenta editó cada contenido. |
| Avisos de error propios | #9 | Si algo falla, el visitante ve un mensaje claro y puede reintentar. |
| Respuesta rápida con la base caída | #9 | Una caída de Supabase no deja el sitio colgado. |
| WCAG 2.2 AA revisado en 33 páginas | #10 | Se puede usar con teclado y lector de pantalla; queda una prueba automática que avisa si algo se rompe. |
| Fotos del tamaño justo y con dirección estable | #11 | Las páginas con fotos cargan más rápido y gastan menos datos; menos tráfico contado en el plan gratuito. |
| Menos consultas por visita | #11 | Inicio pasó de 23 consultas a la base a menos de la mitad. |
| Canónica, Open Graph, datos estructurados, sitemap | #12 | Los enlaces compartidos se ven con foto y descripción; los buscadores entienden artículos y eventos. |
| `/post/…` de Wix redirige solo | #12 | Los enlaces antiguos al blog no se pierden. |
| Listas completas y biblioteca paginada | #13 | El panel sigue funcionando bien con miles de fotos. |
| Índices y Dependabot | #13 | La base no se pone lenta con los años; las actualizaciones llegan solas una vez al mes. |
| Ayudas breves y aviso de carga | #14 | Alguien nuevo en el equipo entiende cada sección sin capacitación. |
| Registro de errores y respaldo semanal cifrado | #16 | Si algo falla se puede encontrar la causa; si se pierde la base, se puede recuperar. |

## 4. Decisiones tomadas

| Decisión | Motivo |
|---|---|
| La bitácora y el plan de lanzamiento van solo en el PR de documentación | Si cada PR tocara la bitácora, todos chocarían al mezclarlos. |
| Los PR dependientes se crean sobre `main` e incluyen los commits del anterior | Al mezclar en orden, nada termina en una rama equivocada. Es más seguro para quien mezcla sin ser técnico. |
| Las pruebas del doble factor usan el código vigente, sin esperar | Supabase Auth acepta el mismo código dentro de su ventana; esperar solo hacía lentas e inestables las pruebas. |
| HSTS sin `includeSubDomains` | `jiump.cl` podría tener otros subdominios que este sitio no controla. |
| CSP: estilos con `unsafe-inline`, scripts estrictos | React escribe estilos en atributos y no se pueden marcar uno a uno. Los scripts, que son lo que importa, quedan cerrados. |
| Una columna nueva nace cerrada para el visitante | Más seguro por defecto. Si el sitio debe mostrarla, su migración le da permiso. |
| Sin reintentos automáticos en las consultas del sitio público | En una caída real hacían esperar 14 s a cada visitante. |
| Los colores de bajo contraste que vienen del prototipo no se corrigen en el PR de accesibilidad | Cambian el diseño aprobado: van en el PR visual #15. Los que se apartaban del prototipo sí se corrigieron. |
| No se guardan páginas ni datos entre visitas; solo las direcciones de las fotos, una hora | Publicar y retirar contenido se nota al instante. Guardar páginas dejaría contenido retirado visible por un rato. |
| Direcciones de fotos válidas 2 h (antes 1 h) | Permite que el navegador guarde las fotos. Una foto retirada desaparece del sitio al instante igual. |
| Datos estructurados solo con datos de la base | Regla 1 del README: sin autor no se inventa una persona; sin fecha no se publica un evento. |
| Sin ESLint | Suma dependencias y reglas que mantener; con tipos estrictos y 174 pruebas el beneficio hoy es bajo. |
| Las ayudas del panel van en un PR normal | El encargo las pedía. Usan un estilo que ya existe y cerradas son una línea. Si la directiva prefiere verlas antes, #14 se puede dejar para el final. |
| Respaldo cifrado en GitHub, sin servicios nuevos | Gratis y sin crear cuentas. Va cifrado porque incluye los correos del equipo. |
| Recomendación de alojamiento: Cloudflare Workers | Vercel gratuito es para uso personal y limita las subidas a 4,5 MB, lo que rompería la subida de fotos. Ver `docs/lanzamiento.md`. |

## 5. Lo que no se pudo comprobar

- **El despliegue real.** No se podía desplegar. La comparación de alojamiento sale de la documentación de cada servicio; el plan incluye un ensayo antes de decidir.
- **La restauración de un respaldo** en un proyecto nuevo de Supabase. Los volcados y el cifrado sí se probaron en local.
- **El workflow de respaldo en GitHub**: no corre hasta que existan sus secretos.

## 6. Pendiente

### Necesita aprobación de la directiva

- [#15](https://github.com/Fernazg/jiump.oficial-web/pull/15): cambio de contraste en la cabecera azul de los artículos, con capturas.
- Bordes de los campos de texto: son gris muy claro, bajo el contraste 3:1 que WCAG pide para identificar un campo. Oscurecerlos cambia el diseño. No se hizo.
- Galería pública: el diseño muestra todas las fotos de todos los álbumes en una página. Con muchos álbumes será pesada. Propuesta: mostrar una parte de cada álbum con enlace al álbum completo.
- Alojamiento (Cloudflare o Vercel) y, si hace falta, el plan de US$5 al mes.
- Validar el modelo de datos y los permisos, que siguen como propuesta.
- Quiénes serán los dos primeros Superadministradores.
- Dónde se respaldan los archivos de las fotos y quién guarda la frase de cifrado.
- Todo el plan de `docs/lanzamiento.md`, incluido el cambio de DNS.

### Necesita contenido de JIUMP

- Lo que ya estaba en `docs/pendientes.md`: textos institucionales, autores, fechas y lugares de eventos, fotos de álbumes.
- Título y descripción para buscadores de cada página, y la foto por defecto para compartir.
- La lista de direcciones del sitio en Wix que cambian de nombre, para sus redirecciones.

### Necesita una cuenta en la nube (todo gratuito)

- CAPTCHA de Cloudflare Turnstile en el ingreso. Hoy el límite de intentos depende de Supabase Auth, que cuenta por la dirección del servidor del sitio y no por visitante.
- Vigilancia de disponibilidad, que avise por correo si el sitio se cae.
- Google Search Console, después del lanzamiento.

### Técnico, sin urgencia

- **Espacio de las fotos.** El panel guarda el original además de las versiones. Con originales de cámara (3 a 8 MB), 1 GB gratuito alcanza para unas 150 a 300 fotos. Mientras tanto: subir fotos ya reducidas. A futuro: que el panel reduzca el original al subir (la regla 2 permite redimensionar).
- Selectores de fotos de los editores: ya no se cortan, pero cargan toda la biblioteca. Con varios miles de fotos convendrá un selector con búsqueda y páginas.
- Supabase Auth acepta dos veces el mismo código del doble factor dentro de su ventana. Es comportamiento del servicio. Riesgo bajo: hace falta la contraseña y ver el código en esos segundos.
- Limitar la sesión por tiempo o inactividad es del plan pagado de Supabase. Sin costo, la sesión se corta al cerrarla o al desactivar a la persona.
- Adaptador OpenNext para Cloudflare: se agrega cuando se decida el alojamiento.
