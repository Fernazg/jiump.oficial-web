# Roles y permisos del panel /admin

Cuatro roles. Una persona puede tener más de uno (ej.: Eventos + Multimedia).
**Los permisos se validan en el servidor y con Row Level Security en la base de datos**; ocultar botones en la interfaz no es suficiente.

## Matriz (tomada del diseño aprobado)

| Sección | Superadministrador | Editor | Eventos | Multimedia |
|---|:-:|:-:|:-:|:-:|
| Escritorio | ● | ● | ● | ● |
| Artículos, series y categorías | ● | ● | — | — |
| Eventos y actividades (incluye destacar en Inicio) | ● | — | ● | — |
| Biblioteca de fotos (subir y usar) | ● | ◐ | ◐ | ● |
| Galerías, álbumes y videos | ● | — | — | ● |
| Administrar página web (secciones de Inicio, páginas, menú y pie) | ● | — | — | — |
| Información institucional | ● | — | — | — |
| Usuarios, roles, registro de actividad y configuración (incl. modo mantenimiento) | ● | — | — | — |

● acceso total · ◐ puede subir fotos y usarlas en su propio contenido, pero no editar ni borrar fotos de otros · — sin acceso

## Reglas adicionales

- **Flujo de publicación de artículos:** Borrador → En revisión → Programado / Publicado. Nada se publica sin vista previa.
- **Eliminar** siempre pide confirmación. Los artículos eliminados pasan a una papelera recuperable por 30 días.
- Una **serie** con artículos no se puede borrar hasta mover sus artículos.
- Las fotos eliminadas de una actividad **quedan en la biblioteca**.
- **Doble factor:** obligatorio para Superadministrador; opcional para el resto.
- **Registro de actividad:** guardar quién hizo qué y cuándo (crear, editar, publicar, eliminar, cambios de rol).
- **Edición simultánea:** avisar si otra persona tiene abierto el mismo artículo.
- Los visitantes no inician sesión; el sitio público es de solo lectura.

## Sugerencia de implementación (Supabase)

- Tabla `perfiles` (1:1 con `auth.users`) y `perfil_roles` (rol enum: `superadmin`, `editor`, `eventos`, `multimedia`).
- Función `tiene_rol(r)` `SECURITY DEFINER` para usar en las políticas RLS.
- Lectura pública solo de filas con `estado = 'publicado'`; escritura según la matriz.
- Buckets de almacenamiento con políticas equivalentes (lectura pública de fotos publicadas, escritura por rol).
