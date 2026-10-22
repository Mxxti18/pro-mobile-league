# Pro Mobile League 2.0.8 — activación del guardado protegido

La actualización corrige la recuperación de permisos, los conflictos visibles de sincronización, los borradores sin cambios, las reservas de apuestas vencidas y la paginación de noticias. Esas correcciones funcionan al actualizar la app, la web y el Worker.

**La protección adicional de las escrituras de moderadores requiere los pasos de abajo. Hasta completarlos, las reglas actuales de Firebase siguen vigentes.** No se requiere migrar resultados, fichas, noticias ni temporadas. No hay cambios de esquema en D1.

El servidor valida los cambios del torneo antes de publicarlos y evita reemplazar una revisión que otro editor acaba de guardar. Los moderadores mantienen la edición de resultados y la gestión de equipos, jugadores, escudos, fotos y DT. El cierre de temporadas, la configuración de competiciones y los cambios al historial archivado corresponden al dueño. Los permisos de lectores vinculados como DT se conservan.

## Orden de activación

1. Instalá PML Torneos **2.0.8**, código **47**, sobre la app actual. Pediles a los moderadores que también actualicen. En la web, recargá la página. Las versiones anteriores de la app no usan el nuevo guardado protegido.

2. Entrá a [Cuentas de servicio de Google Cloud](https://console.cloud.google.com/iam-admin/serviceaccounts?project=pro-mobile-league) con la cuenta propietaria. Confirmá que el proyecto sea **pro-mobile-league**. Creá una cuenta de servicio llamada `pml-sync`, concedele el rol **Cloud Datastore User** (`roles/datastore.user`) en ese proyecto y generá una clave de tipo **JSON** desde la pestaña Claves de esa cuenta. Es una credencial del servidor: guardala de forma privada; no la subas a GitHub ni la pegues en el chat.

3. En [Cloudflare](https://dash.cloudflare.com/7149fb3a1412d5cad1bbf784c855abed/workers/services/view/pml-juegos), abrí el Worker **pml-juegos → Settings → Variables and Secrets**. Agregá un **Secret** con nombre exacto `FIREBASE_SERVICE_ACCOUNT`. Su valor es el contenido completo del JSON del paso anterior. Guardá y desplegá el cambio. Conservá el enlace de la base D1 `DB` y los demás ajustes existentes.

4. Desde la cuenta dueña, abrí **MI PERFIL → COMPROBAR GUARDADO PROTEGIDO**. Debe confirmar la conexión. Este botón verifica que el servidor puede autenticarse y leer Firebase; no modifica el torneo. Antes de cambiar las reglas, comprobá un cambio legítimo pequeño de un moderador usando 2.0.8 y verificá que otro dispositivo lo reciba. Si aparece un error, conservá las reglas anteriores y corregí la configuración del servidor primero.

5. En [Firestore → Reglas](https://console.firebase.google.com/project/pro-mobile-league/firestore/rules), guardá una copia del texto actual y buscá este bloque:

   ```text
   match /leagues/main/data/{document=**} {
     allow read: if true;
     allow write: if editor();
   }
   ```

   Reemplazalo por:

   ```text
   match /leagues/main/data/{document=**} {
     allow read: if true;
     allow write: if owner();
   }
   ```

   Publicá las reglas. **Reemplazá el bloque: no agregues otro al lado**, porque una regla anterior que permite la escritura seguiría concediéndola. Conservá los bloques de perfiles, roles, imágenes, DT y jugadores, incluidos los permisos de la versión 2.0.7. Ningún otro bloque debe conceder escritura general a los moderadores sobre `/leagues/main/data`.

6. Recargá la web o cerrá y abrí la app 2.0.8. Verificá una edición normal del moderador y su recepción por la cuenta dueña. Los lectores deben seguir pudiendo consultar la liga; los DT vinculados deben conservar sus campos autorizados.

## Archivos incluidos

- `Bloque-Firebase-2.0.8.txt`: el bloque exacto que reemplaza al anterior.
- `Aplicar-Proteccion-Firebase.py`: aplica exclusivamente ese cambio sobre una copia de tus reglas actuales. Uso: `python Aplicar-Proteccion-Firebase.py reglas-actuales.rules reglas-nuevas.rules`. No publica nada automáticamente.
- `Firestore-PML-2.0.8-REFERENCIA.rules`: archivo completo basado en las reglas que compartiste para 2.0.7. Usalo solo si coincide con tus reglas actuales; el cambio por bloque preserva cualquier ajuste posterior.
- `worker.mjs`: copia del servidor preparado para esta versión. La base de juegos conserva sus tablas y datos; no ejecutes un esquema SQL nuevo sobre ella.

## Si hay un problema durante la activación

No borres la app ni sus datos. Los cambios pendientes se conservan en el dispositivo. En MI PERFIL podés volver a comprobar la conexión y, si existe un conflicto, guardar una copia antes de cargar la nube.

Para deshacer solamente la activación, restaurá primero la copia de las reglas anteriores. Después podés retirar el secreto del Worker. Eso devuelve el comportamiento previo de permisos y debe ser temporal mientras se revisa el problema. No retires el secreto con las reglas nuevas activas: los moderadores necesitarían el servidor para guardar.

## Verificación realizada y límite

Se probaron localmente permisos, validación de datos, ediciones simultáneas, conflictos, borradores, paginación, cobros y devoluciones. Se verificó que el formato del torneo descargado de Firebase es compatible sin modificarlo. La interfaz ensamblada de Android y web pasó pruebas de navegador. La firma del APK coincide con la versión 2.0.7. La activación con una cuenta de servicio real y las reglas efectivamente publicadas necesita verificarse después de estos pasos; no se dispone de acceso administrativo directo a Firebase desde esta sesión. No se realizó una instalación en un teléfono Android físico.

Referencias: [cuentas de servicio](https://docs.cloud.google.com/iam/docs/service-accounts-create), [autenticación y permisos de Firestore REST](https://firebase.google.com/docs/firestore/use-rest-api), [reglas de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions).
