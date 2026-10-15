# Activar el modo de prueba privado

La APK 1.9.2 funciona con el servidor anterior para los juegos reales. Para entrar en prueba hay que actualizar el servidor una vez. No se cambia la URL guardada en la app.

1. Cloudflare → D1 → pml-juegos → Console. Ejecutar este SQL (no borra datos):

```sql
CREATE TABLE IF NOT EXISTS practice_sessions(
 uid TEXT PRIMARY KEY,
 state TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
```

2. Cloudflare → Workers & Pages → pml-juegos → Edit code. Reemplazar todo worker.js por el contenido de https://raw.githubusercontent.com/Mxxti18/pro-mobile-league/main/games-server/dist/worker.js y pulsar Deploy. Conservar el binding DB apuntando a pml-juegos.

3. Abrir https://pml-juegos.matifc-cai.workers.dev/health. Debe mostrar version 1.9.2 y practice true. En la app, Entretenimiento → Juegos → ENTRAR EN PRUEBA. Solo aparece para la cuenta creadora. El saldo de prueba y sus movimientos no afectan el ranking ni las fichas reales.

No volver a ejecutar entregas de fichas ni borrar las tablas existentes. La actualización solo agrega practice_sessions.
