# Diseño aprobado

Referencias visuales: `design/capturas/` y las láminas `PropuestaColor.jpg` y `PropuestaTipografia.jpg` (en `design/capturas/escritorio/`).

## Paleta (manual de identidad IUMP)

| Token | Color | Rol |
|---|---|---|
| `blanco` | `#FFFFFF` | Fondo principal (~70 %) y tarjetas |
| `gris-claro` | `#F2F4F5` | Separar secciones alternas |
| `azul-palabra` | `#0073B1` | **Único color de acción**: botones, enlaces, etiquetas, fechas, bloques destacados |
| `azul-palabra-oscuro` | `#005A8C` | Texto pequeño sobre fondos claros; hover |
| `azul-profundo` | `#062F4A` | Solo portada de Inicio, «Heme aquí» y velos sobre fotos con texto |
| `azul-claro` | `#E3F0F8` | Fondos de etiquetas, versículos, estados vacíos |
| `turquesa` | `#00AB9F` | Solo detalles (franja de marca, líneas, indicador activo). Nunca como texto sobre blanco |
| `turquesa-claro` | `#A6E9E2` | Texto turquesa sobre fondos oscuros |
| `rojo-antorcha` | `#DA3A38` | Identidad «Mes de la Reforma», distintivo «Próximo», acciones de eliminar |
| `rojo-oscuro` | `#B42F2D` | Texto rojo sobre fondos claros |
| `texto` | `#1C1E21` | Texto principal |
| `texto-secundario` | `#5F5A60` / `#43474D` | Texto secundario |

Todo texto cumple contraste WCAG AA (mín. 4,5:1). Franja de marca: turquesa 2/3 + azul 1/3.
Logo a color sobre blanco; versión blanca solo sobre azul profundo.

## Tipografía (escala de 11 niveles)

Familias: **Montserrat** (títulos) · **Open Sans** (≈ Segoe UI; botones, menú, etiquetas) · **Helvetica** (cuerpo; web: `'Helvetica Neue', Helvetica, Arial, sans-serif`).

| Nivel | Fuente | Peso | Escritorio | Celular | Interlínea | Espaciado |
|---|---|---|---|---|---|---|
| Display (portada, «Heme aquí») | Montserrat | 800 | 88 px | 44 px | 0,98 | −0,025 em |
| H1 página | Montserrat | 800 | 64 px | 38 px | 1,02 | −0,02 em |
| H2 sección | Montserrat | 800 | 48 px | 32 px | 1,05 | −0,02 em |
| H3 destacado | Montserrat | 700 | 30 px | 24 px | 1,15 | −0,01 em |
| H4 tarjeta | Montserrat | 700 | 22 px | 19 px | 1,25 | 0 |
| Entradilla | Helvetica | 400 | 20 px | 18 px | 1,6 | 0 |
| Cuerpo | Helvetica | 400 | 17 px | 16 px | 1,7 | 0 |
| Cuerpo de artículo | Helvetica | 400 | 19 px | 18 px | 1,8 | 0 (ajustable A−/A+) |
| Etiqueta | Open Sans | 600 | 13 px | 12 px | 1,3 | +0,12 em, MAYÚSCULAS |
| Botón / menú | Open Sans | 600 | 16 px | 16 px | 1 | 0 |
| Metadato | Helvetica | 600 | 14 px | 13 px | 1,5 | 0 |

Reglas: peso 800 solo en Display/H1/H2; máximo una etiqueta en mayúsculas por sección; líneas de lectura ≤ 65 caracteres.

## Responsive

- Puntos de quiebre: **1024 px** (tablet: márgenes 32 px), **900 px** (menú ☰ desplegable), **640 px** (celular: márgenes 20 px).
- Menú unificado: **Nosotros · Eventos · Artículos · Galería**. En celular, panel desplegable con enlaces de 52 px de alto.
- En celular, «Qué hacemos» (tarjetas 280×360) y «Actividades destacadas» (tarjetas de igual tamaño, 440 px de alto) son **carruseles horizontales con scroll-snap**; se ve una tarjeta completa y parte de la siguiente.
- Rejillas con `minmax(min(100%, Npx), 1fr)` para no desbordar en pantallas angostas.
- Agregar `<meta name="viewport" content="width=device-width, initial-scale=1">` en todas las páginas.

## Movimiento (criterios de diseño)

- Curva `cubic-bezier(.23,1,.32,1)`; interfaz bajo 300 ms. Botones: `scale(.97)` al presionar.
- Hover sutil (−2 px). Sin animaciones de aparición en cada sección.
- Respetar `prefers-reduced-motion`. Desactivar efectos de hover en pantallas táctiles.
- Sombras neutras suaves en vez de bordes sólidos en tarjetas.

## Páginas diseñadas

Inicio · Nosotros · Artículos · 7 páginas de artículo (4 «Mes de la Biblia», 3 «Mes de la Reforma») · Eventos · Galería · 4 páginas de actividad (Convención Nacional 2026, EMJ 2026, FEDI 2026, EJZ 2026) · Error 404 · Estados vacíos · Mantenimiento.
Panel /admin: Escritorio por rol, Artículos, Editor, Eventos y actividades, Administrar página web, Edición rápida, Biblioteca de fotos y galerías, Videos, Usuarios y roles.

## Componentes clave

- **Página de artículo:** cabecera por serie (Biblia: azul Palabra; Reforma: blanco con detalles rojos y afiche), índice lateral (fila deslizable en celular), selector de tamaño de texto, barra de progreso de lectura, versículos en recuadro azul claro, «Idea clave», «Para recordar», gráficos informativos y navegación anterior/siguiente de la serie.
- **Estados vacíos:** ícono + título + explicación + botón. Si una actividad no tiene videos, la sección se oculta.
- **Barra «Próximo evento»** en Inicio: solo se muestra cuando hay un evento publicado.
- **Página de mantenimiento:** independiente, activable desde /admin (Superadministrador).
- Redes sociales: **solo Instagram** — https://www.instagram.com/jiump.oficial
