# PML Juegos 1.9.2

Servidor para fichas virtuales de PML Torneos: Cloudflare Workers + D1. No requiere Firebase Blaze. Autentica las cuentas existentes mediante tokens de Firebase y las claves públicas de Google. No contiene credenciales privadas.

## Estado

Implementado y probado localmente. Falta desplegar en la cuenta de Cloudflare del propietario y probar la conexión con una cuenta real desde la APK. No existe todavía una dirección de servidor de producción.

## Activar desde una computadora

1. Crear la cuenta gratuita de Cloudflare y verificar el correo.
2. Instalar Node.js 20 o posterior. En esta carpeta ejecutar `npm ci` y `npx wrangler login`.
3. Ejecutar `npx wrangler d1 create pml-juegos`.
4. Copiar el `database_id` obtenido en `wrangler.jsonc`, reemplazando `REEMPLAZAR_CON_ID_D1`.
5. Ejecutar `npx wrangler d1 execute pml-juegos --remote --file schema.sql`.
6. Ejecutar `npm run deploy`. Conservar el enlace HTTPS terminado en `.workers.dev`.
7. Abrir ese enlace agregando `/health`. Debe responder `service: pml-games`, `rules: 1`. Comprueba también que exista la base de datos.
8. En la APK, con la cuenta administradora: Entretenimiento → Juegos → Conectar servidor. Pegar la dirección sin `/health` y guardar.
9. Entrar con una cuenta lectora para comprobar 500 fichas, ticket, partida guardada y cobro. Verificar también desde otra sesión que no permita repetir el ticket o cobrar dos veces.

## Activar desde el panel de Cloudflare

Se puede hacer sin instalar herramientas. Crear una base D1 llamada `pml-juegos`; en su consola ejecutar el contenido de `schema.sql`. Crear un Worker llamado `pml-juegos`, reemplazar su código con `dist/worker.js` y publicar. En los bindings del Worker agregar la base D1 con nombre de variable **DB**. La versión compilada ya incluye el proyecto Firebase y el UID del propietario como valores predeterminados públicos. Mantener la fecha de compatibilidad 2026-10-01. Después completar los pasos 7–9 anteriores.

La cuenta no necesita agregar un dominio. Usar Workers Free/D1 Free. No crear otra base ni cambiar su identificador al actualizar: allí se conservan saldos y partidas.

## Reglas

- 500 fichas iniciales por UID, una sola vez. Son fichas internas sin valor monetario.
- Buscaminas lunes/martes, Penales miércoles/jueves, según America/Argentina/Buenos_Aires.
- Ticket 25 fichas; una partida por juego y día habilitado. El ticket no se devuelve. Al terminar el día vence la partida pendiente.
- Buscaminas: 36 casillas: 15×1, 10×2, 5×5, tres multiplicadores ×2/×4/×6 y tres minas. El multiplicador afecta lo acumulado en ese instante. Retiro voluntario; tercera mina pierde el acumulado.
- Penales: cinco tiros izquierda/centro/derecha. El servidor fija los cinco movimientos del arquero al crear la partida y no expone tiros futuros. Premios según goles: 0–1→0, 2→10, 3→25, 4→50, 5→100.
- Ranking por saldo y últimos 30 movimientos por usuario.
- Solo el propietario puede entregar 100 a todos. La entrega incluye perfiles registrados de Firebase que no habían abierto Juegos. Un ID de entrega repetido no vuelve a acreditar.

## Integridad

El cliente no decide saldo, minas, arquero ni premios. La identidad proviene del JWT firmado, con algoritmo, proyecto, emisor y caducidad verificados. La app no contiene claves de servidor. Los tokens se validan sin consultar revocaciones: tras revocar una sesión un token ya emitido puede seguir vigente hasta su expiración de Firebase.

Una restricción única impide duplicar tickets por UID/juego/día. Triggers SQL vinculan cargo, premio y movimientos al cambio de partida; las restricciones de saldo hacen rollback ante fondos insuficientes. Las jugadas usan versión y `UPDATE ... RETURNING` para evitar duplicación concurrente. El tablero secreto no se envía mientras está activa la partida.

En el plan gratuito hay cuotas. Al agotarlas el servicio puede dejar de responder hasta que se restablezcan. No existe saldo local de reemplazo. Un fallo de red requiere actualizar para recuperar el estado confirmado del servidor.

## Pruebas

`npm test`: 10 pruebas con SQLite real para cargos, premios, concurrencia, autorización, horarios, límites diarios, recuperación y firma RSA de tokens.

`npx wrangler deploy --dry-run --outdir dist`: compila el Worker.

`node test/runtime.mjs`: prueba el Worker compilado en workerd y D1 locales, con claves públicas simuladas de Google y JWT RSA firmado para el ensayo. Comprueba sesión, 500 iniciales, ticket único, juego, premio y rechazo de repeticiones. Si el día real es viernes–domingo omite la partida por el calendario habilitado.

La interfaz de APK fue probada en Chromium móvil con respuestas HTTP simuladas; no equivale a validación de producción ni ejecución en un teléfono Android.

## Pendiente de otro bloque

Apuestas (selección de partidos y liquidación), publicaciones por fichas y moderación. Esta entrega incluye los dos juegos y la billetera; no activa automáticamente esas funciones.

Referencias: https://developers.cloudflare.com/workers/get-started/dashboard/ · https://developers.cloudflare.com/d1/get-started/ · https://firebase.google.com/docs/auth/admin/verify-id-tokens


## Actualizar desde 1.9.0 / modo privado

No borrar ni volver a crear la base D1. En su consola ejecutar únicamente `practice-schema.sql`; agrega una tabla independiente, sin modificar saldos o partidas reales. Luego reemplazar el código del Worker con el contenido completo de `dist/worker.js` y publicar. Mantener el binding DB apuntando a pml-juegos. Al abrir /health debe figurar version 1.9.2 y practice true.

La APK 1.9.2 incorpora ENTRAR EN PRUEBA, visible solo para el creador con UID iCLoGhjbXNgY3Q7dbxX0456vagI2. El servidor usa ese UID fijo, independiente de roles y del OWNER_UID configurable. Cada prueba tiene saldo y movimientos separados dentro de practice_sessions. Se puede jugar cualquier día, repetir al terminar y reiniciar a500. No crea ni modifica las billeteras ni el ranking reales. Las rutas de prueba requieren autenticación y control de versión.

El botón aparece en la APK antes de actualizar el servidor, pero el modo no funciona hasta aplicar ambos pasos. Los juegos reales mantienen las reglas actuales.
