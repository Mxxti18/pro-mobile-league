# Actualizar PML Torneos a 1.9.9

Esta versión corrige el selector de imágenes del lector, la escritura, los permisos visuales y la presentación de Resumen, Fechas y Medios. Agrega eliminar borradores y retirar noticias pendientes con devolución única.

## 1. D1
Cloudflare → Storage & databases → D1 SQLite Database → **pml-juegos** → Console.

Copiá todo [news-withdrawals-schema.sql](news-withdrawals-schema.sql), pegalo y pulsá **Execute**. El mensaje “This query returned no data” sin error es normal. No borra usuarios, saldos, publicaciones, juegos ni apuestas. Se puede ejecutar de nuevo.

Este paso supone que ya ejecutaste posts-schema.sql en 1.9.8, como confirmaste. No hace falta repetirlo.

## 2. Worker
Cloudflare → Compute → Workers & Pages → **pml-juegos** → Edit code.

Reemplazá todo `worker.js` por [dist/worker.js](dist/worker.js) y pulsá **Deploy**. Conservá **DB → pml-juegos** y las variables actuales.

## 3. APK
Instalá **PML-Torneos-1.9.9.apk** sobre la actual. No desinstales ni borres datos.

## Comprobación
- Lector → Publicar imagen → retomar el borrador pagado → Elegir imagen. Debe abrir el selector; no se vuelve a cobrar por el mismo borrador.
- Los avisos de envío indican solo el requisito que falta.
- Perfil → Mis noticias → Eliminar borrador o Retirar noticia. Pide confirmación, la quita del listado y devuelve 250 fichas si se pagaron. La operación se registra en el historial; no duplica devoluciones por reintento. Una noticia aprobada o rechazada no puede retirarse con otra devolución.
- Dueño → Usuarios registrados: cerrado por defecto, se despliega al tocarlo.
- Lector: no aparecen descargas, borrar resultados, reordenar partidos ni recalcular copa. Los DT conservan su apariencia normal y los permisos de edición anteriores.
- Resumen: un solo título en mayúsculas, descarga junto al título, flechas uniformes; Recalcular copa centrado. Clasificados también usa icono.
- Fechas: Reordenar partidos queda en la cabecera; Fecha cerrada se muestra sobre su marcador.
- Medios: noticias manuales con fondo oscuro y tipografía de diario. Las ediciones guardadas de título y texto prevalecen sobre cambios posteriores de los datos de origen. Las noticias borradas no se recuperan.

Pruebas locales: D1 real, concurrencia de retiro/aprobación, devolución única y permisos; Chromium móvil, selector con el identificador que exige Android y regresiones de juegos/perfil. El selector y la fluidez final deben verificarse en el teléfono real.
