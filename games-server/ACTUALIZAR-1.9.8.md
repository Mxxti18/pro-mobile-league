# Activar publicaciones con fichas · 1.9.8

La APK conserva los juegos y apuestas. Este bloque agrega publicaciones con aprobación y requiere actualizar D1 y el Worker una vez.

## 1. Agregar las tablas

Cloudflare → Storage & databases → D1 SQLite Database → **pml-juegos** → Console.

Copiá todo [posts-schema.sql](posts-schema.sql), pegalo en la consola y pulsá **Execute**. “This query returned no data” sin error es normal. Se puede ejecutar de nuevo: no borra usuarios, saldos, juegos ni apuestas.

## 2. Actualizar el servidor

Cloudflare → Compute → Workers & Pages → **pml-juegos** → Edit code.

Reemplazá todo `worker.js` por el contenido completo de [dist/worker.js](dist/worker.js) y pulsá **Deploy**. Conservá la vinculación D1 **DB → pml-juegos** y las variables actuales.

## 3. Instalar y comprobar

Instalá **PML-Torneos-1.9.8.apk** sobre la actual.

- Usuario sin administración: Medios → Publicar imagen → confirmar 250 fichas → editar título, división, equipo, texto e imagen. Cerrar y volver conserva el borrador; Guardar borrador lo conserva también en el servidor.
- Enviar pide confirmación: la noticia queda pendiente y no aparece públicamente.
- Perfil → Mis noticias muestra el estado. Solo el autor puede editar su borrador; una vez enviado queda bloqueado para revisión.
- Administración: Perfil → Noticias pendientes → Revisar. Aprobar publica; Rechazar requiere un motivo y devuelve 250 fichas una sola vez.
- El creador conserva su editor directo; los moderadores publican sin costo mediante el nuevo editor.
- Perfil → Historial de fichas muestra el pago y la devolución.

Las pruebas se realizaron en un servidor local con D1 y en Chromium con los servicios simulados. Falta verificar el despliegue real y el selector nativo de imágenes en el teléfono.

## Conservación y permisos

No se alteran las reglas de Firebase ni los datos anteriores de la liga. Las noticias nuevas se guardan en D1 y se cargan desde el servidor; solo las aprobadas aparecen en Medios. Las competiciones desactivadas siguen ocultas. La cola muestra las primeras 10 pendientes y avanza a medida que se revisan; Mis noticias conserva a la vista el borrador y las últimas 10 entradas. El contenido aprobado tiene paginación.
