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
- **Doble factor:** obligatorio para Superadministrador; opcional para el resto. Se exige en la base de datos (ver abajo).
- **Registro de actividad:** guardar quién hizo qué y cuándo (crear, editar, publicar, eliminar, cambios de rol).
- **Edición simultánea:** avisar si otra persona tiene abierto el mismo artículo.
- Los visitantes no inician sesión; el sitio público es de solo lectura.

## Sugerencia de implementación (Supabase)

- Tabla `perfiles` (1:1 con `auth.users`) y `perfil_roles` (rol enum: `superadmin`, `editor`, `eventos`, `multimedia`).
- Función `tiene_rol(r)` `SECURITY DEFINER` para usar en las políticas RLS.
- Lectura pública solo de filas con `estado = 'publicado'`; escritura según la matriz.
- Buckets de almacenamiento con políticas equivalentes (lectura pública de fotos publicadas, escritura por rol).

## Cómo quedó implementado (`supabase/migrations/`)

**Funciones de permisos.** `tiene_rol(r)` y `tiene_algun_rol(...)` (`SECURITY DEFINER`, `search_path` vacío) se usan en todas las políticas RLS y del bucket. Un rol cuenta solo si se cumplen tres condiciones:
1. el perfil está **activo**;
2. la **sesión** del token sigue abierta en `auth.sessions` (al cerrar sesión o desactivar a alguien, pierde el acceso al instante, aunque su token no haya vencido);
3. para **Superadministrador**, además: una sesión con doble factor verificado (aal2) **con un factor TOTP inscrito antes de recibir el rol**.

**Alta de un Superadministrador** (en este orden):
1. La persona recibe la invitación, entra al panel e inscribe su factor TOTP.
2. Otro superadmin (o, para el primero, el servidor) le asigna el rol.

Si alguien inscribe un factor nuevo (por ejemplo, porque cambió de teléfono), hay que volver a asignarle el rol. Así, quien robe solo la contraseña no puede inscribir su propio factor y obtener el rol.

**Desactivar a una persona** cierra todas sus sesiones y le bloquea el inicio de sesión. Al reactivarla, puede volver a entrar.

**Ajustes respecto a la matriz**
- Las cuatro columnas se aplican tal como están: Multimedia **no** lee actividades en borrador ni gestiona las fotos de las actividades. Sí puede vincular sus álbumes y videos a actividades publicadas.
- «Usuarios» es solo del superadmin: cada persona ve únicamente su propio perfil y sus roles; nadie más del equipo ve correos ni último ingreso.
- ◐ Editor y Eventos: suben fotos solo a su propia carpeta y solo editan o borran las suyas. Superadmin y Multimedia gestionan todas, pero un archivo nunca sale de la carpeta de su dueño.
- Nadie puede asignarse roles ni editar su propio perfil para darse permisos. Los roles no se editan: se asignan o se quitan. Siempre debe quedar al menos un superadmin activo.
- El registro de actividad no lo puede editar ni borrar nadie, tampoco el superadmin.
- El visitante anónimo no tiene ningún privilegio de escritura. Las tablas y funciones que se creen en el futuro nacen cerradas para él.

**Pruebas:** `supabase/tests/database/permisos.test.sql` y `supabase/tests/database/seguridad.test.sql` (pgTAP) recorren la matriz completa por rol (incluida una persona con dos roles, un superadmin sin doble factor, una persona desactivada y una sesión cerrada) y el bucket. `supabase/tests/api/permisos-api.test.mjs` lo comprueba con inicios de sesión reales.
