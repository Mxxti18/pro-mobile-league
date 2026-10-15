# Canal de actualizaciones de PML Torneos

Estado: preparado localmente; falta habilitar escritura de la integración en el repositorio y ejecutar Actions. No hay un borrador nuevo publicado todavía.

Paquete Android: com.promobileleague.torneos.
Este canal reemplaza la distribución del APK antiguo, cuya firma es diferente.

1. Abrir el borrador de Release v1.6.0 preparado por Actions.
2. Adjuntar únicamente Pro-Mobile-League.apk, recibido junto con esta actualización.
3. El título debe ser PML Torneos 1.6.0. Conservar las notas que identifican el canal y paquete.
4. No marcar Pre-release. Marcar Set as latest release y publicar.
5. Comprobar Ajustes > Actualizaciones en el teléfono.

No subir el ZIP privado, la clave de firma, contraseñas ni respaldos del torneo.
El repositorio guarda solo metadatos públicos; no contiene la clave privada.

Para futuras publicaciones se actualiza release/pml-torneos.json con versión, código y hash del nuevo APK firmado. Actions prepara un borrador, y se adjunta el APK antes de publicarlo.
