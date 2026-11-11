# Migración desde Wix y lanzamiento

## Dominio jiump.cl (consulta whois, 8 nov 2026)
- Registrado directamente en **NIC Chile** (no en Wix). No requiere transferencia.
- Servidores de nombre actuales: `ns4.wixdns.net`, `ns5.wixdns.net` (Wix administra el DNS).
- En Wix figura «Gestionado por terceros · Conectado por DNS». No hay correo empresarial contratado en Wix (verificar registros MX antes del cambio).
- **Vence el 1 de febrero de 2027**: renovar antes, con o sin lanzamiento.
- El cambio de servidores de nombre lo hace el **titular** del dominio en su cuenta de NIC Chile.

## Contenido a migrar (inventario por completar)
- Artículos del blog de Wix (la página Artículos del diseño menciona más de 130). Conservar fecha original, autor, serie y temas.
- Series conocidas: Los Atributos de Dios, Ven y Sígueme, Nehemías: Un espíritu encendido, Pactos de Dios.
- Álbumes de la galería y sus fotos.
- Textos de «Quiénes somos» y «Qué creemos» (jiump.cl/quienes-somos), copiados sin cambios.
- Excluido: directorio de personas, podcast, recursos, contacto, ofrendas/donaciones.

## Plan de lanzamiento
1. Sitio nuevo terminado y probado en una dirección temporal (ej.: `*.pages.dev`).
2. Respaldo completo del contenido de Wix.
3. Copiar todos los registros DNS de Wix (sobre todo MX/TXT si existieran) al nuevo proveedor.
4. Redirecciones 301 de URL antiguas a nuevas.
5. El titular cambia los servidores de nombre en NIC Chile. Propagación: minutos a 48 h.
6. Verificación (HTTPS, formularios del panel, correo si existe, Google Search Console).
7. Cancelar Wix **solo** después de confirmar que todo funciona. Plan de vuelta atrás: restaurar `ns4/ns5.wixdns.net`.

**Ningún paso de este documento se ejecuta sin autorización de la directiva.**
