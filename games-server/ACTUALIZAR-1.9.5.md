# Activar el servidor para PML Torneos 1.9.5

La APK se puede instalar sobre la actual. Buscaminas y Penales conservan sus datos.
Esta actualización de Apuestas necesita agregar tablas y reemplazar el código del Worker. No cambia la dirección del servidor ni la conexión de Firebase.

1. En Cloudflare → D1 → pml-juegos → Console, ejecutar TODO el contenido de [bets-schema.sql](https://github.com/Mxxti18/pro-mobile-league/blob/main/games-server/bets-schema.sql). Es una migración aditiva: no borrar las tablas existentes ni ejecutar instrucciones de reinicio.
2. En Workers & Pages → pml-juegos → Edit code, reemplazar TODO el contenido de worker.js con [dist/worker.js](https://raw.githubusercontent.com/Mxxti18/pro-mobile-league/main/games-server/dist/worker.js) y pulsar Deploy. Conservar la vinculación D1 llamada DB.
3. Abrir `https://pml-juegos.matifc-cai.workers.dev/health`: debe indicar version 1.9.5 y bets true.
4. En la APK → Entretenimiento → Juegos → Apuestas, usar PROBAR APUESTAS con tu cuenta creadora. Habilitar el período DE PRUEBA, apostar, probar resultados y reiniciar cuando quieras. Estas fichas son independientes de las reales y del modo de prueba de Buscaminas/Penales.

## Temporada real

Este fin de semana las apuestas reales están deshabilitadas por el servidor. A partir del lunes 19/10/2026, los seis partidos se preparan automáticamente al consultar Apuestas, siempre que haya una temporada abierta con al menos seis pendientes. La selección alterna las competiciones activas y prioriza sus primeras fechas pendientes. No repite partidos seleccionados en períodos previos que sigan vigentes.

El creador revisa la selección y pulsa HABILITAR ESTE PERÍODO. Los participantes eligen local, empate o visitante por partido, apostando un máximo TOTAL de 150 fichas por período. Un acierto devuelve el doble de la apuesta, incluida la cantidad inicial. Una apuesta registrada no se puede editar. El servidor cierra el viernes a las 01:30 GMT−3 (04:30 UTC).

El creador puede corregir partidos pendientes de liquidación aunque tengan apuestas: el partido anterior se anula, devuelve las fichas y registra el motivo. Las apuestas nunca se trasladan a otro partido. El reemplazo necesita ser un partido pendiente de la misma temporada. Un partido ya liquidado no se vuelve a pagar ni se reemplaza mediante esta operación.

## Dos confirmaciones en Fechas

Guardar el marcador y completar goleadores no liquida apuestas. En los partidos seleccionados aparece CONFIRMAR PARA APUESTAS. Después de sincronizar el marcador, un administrador revisa la segunda pantalla y pulsa CONFIRMAR Y REPARTIR FICHAS. El servidor verifica su rol y el marcador realmente publicado en Firebase; no confía en un marcador enviado por un participante. La liquidación se realiza una sola vez.

Los débitos, premios y devoluciones reales aparecen en Perfil → Historial de fichas.

## Verificación realizada

Pruebas en D1/workerd y Chromium: horario GMT−3, selección equilibrada, control de creador/moderador, débitos y pagos idempotentes, tope concurrente de 150, devolución al corregir, separación de pruebas, selectores y pantallas. No se dispone de teléfono/emulador Android para comprobar la instalación física.
