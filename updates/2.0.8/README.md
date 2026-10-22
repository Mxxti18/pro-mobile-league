# Cambios de cliente 2.0.8

Versión Android `2.0.8`, código `47`, paquete `com.promobileleague.torneos`. La firma es la misma que 2.0.7; los datos se conservan instalando encima.

Esta carpeta conserva los archivos modificados de la actualización. El proyecto completo, recursos y firma se encuentran en el respaldo privado del dueño; estos archivos no constituyen una app independiente.

- `cloud-v22.js`: recuperación de listeners de rol y nube, errores visibles y reintentos que respetan cambios de cuenta.
- `drafts208.js`: elimina solo borradores idénticos al resultado guardado; conserva cambios reales.
- `gateway208.js`: publicación protegida opcional para moderadores, con control de revisión. No vuelve a una escritura insegura cuando el servidor configurado rechaza una operación.
- `update-v208.js`: estado de conexión en MI PERFIL, recuperación de conflictos con copia previa, paginación de noticias y restricciones de administración de temporada.

En el cliente ensamblado se reemplaza `cloud-v22.js` y se cargan `drafts208.js`, `gateway208.js` y `update-v208.js`, en ese orden, después de `update-v26.js`. Se incrementan la versión nativa y la del comprobador de actualizaciones. La web agrupa estos mismos scripts en un archivo con hash y renueva las referencias de caché.

Pruebas de este delta:

```sh
node updates/2.0.8/test/recovery208.cjs
node updates/2.0.8/test/gateway208.cjs
```

También se probaron los controles de sincronización simultánea, permisos de equipos, eliminación conservando estadísticas y respuesta a pulsaciones de resultados de versiones anteriores; la interfaz ensamblada pasó pruebas de navegador para Android y web. La firma e integridad del APK están documentadas en `verification.json`. No se probó la instalación en un teléfono Android físico ni la activación del nuevo secreto con credenciales reales.
