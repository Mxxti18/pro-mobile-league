# PML Torneos 2.0.9

Corrige un error de la APK 2.0.8: los archivos `gateway208.js`, `drafts208.js` y `update-v208.js` estaban incluidos, pero el cargador nativo no permitía acceder a ellos. La web sí los cargaba. Por eso faltaban el panel CONEXIÓN Y PERMISOS y parte de las mejoras de recuperación de sincronización en Android.

El cargador permite esos tres archivos solamente desde el origen interno HTTPS de la aplicación, mediante GET y en su ruta exacta. Conserva las restricciones de los demás recursos. La versión es 2.0.9, código 48, con el mismo paquete y certificado que 2.0.8.

Se reprodujo la ausencia del panel al aplicar la restricción nativa anterior en navegador y su aparición al permitir los archivos. Se verificó el cargador compilado dentro del APK, la presencia de todos los scripts de entrada y la firma v2/v3. No se realizó una instalación en un teléfono Android físico.

Instalar sobre la app actual, sin desinstalar. No requiere modificar Firebase, Cloudflare ni los datos del torneo. La web ya tenía estos scripts funcionando.

Para pedro.pablo: después de actualizar, abrir MI PERFIL y revisar el panel de conexión. Si Registrar jugador sigue bloqueado, el texto de ese panel permitirá distinguir un conflicto general de sincronización de un problema de verificación de permisos. El conflicto individual de Galatasaray–Vasco da Gama no demuestra por sí solo la causa del bloqueo del registro.

Comprobación del paquete: `python check-native-assets.py PML-Torneos-2.0.9.apk`. La misma prueba falla correctamente con el APK 2.0.8 porque detecta las tres rutas faltantes.
