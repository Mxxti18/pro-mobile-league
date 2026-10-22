# Servidor PML 2.0.8

Worker desplegado: `pml-juegos`. D1: binding `DB`, base existente `pml-juegos`. El entry point `worker.mjs` utiliza `dist/worker-2.0.8.mjs`, el mismo bundle verificado que se despliega en Cloudflare. El código y los tests actuales están en `v2.0.8/`; los módulos anteriores se conservan como referencia.

## Desarrollo y verificación

Usar Node.js 24 o posterior para los tests con `node:sqlite`:

```sh
cd games-server/v2.0.8
npm ci
npm test
npm run build
```

El esquema SQL incluido se usa solo en la base temporal de los tests. **No ejecutarlo sobre la base de producción existente.** Esta versión no necesita migración SQL. Las pruebas simulan cuentas, Firebase y D1; no editan el torneo real.

## Despliegue

La configuración `wrangler.jsonc` conserva el binding D1 y el proyecto de Firebase. Desde `games-server`, el comando existente `npm run deploy` publica el bundle. No recrear la base ni retirar los secretos existentes. Tras publicar, `/health` debe indicar `2.0.8`.

La recuperación de permisos, borradores y conflictos está en el cliente. En el servidor se corrigieron las reservas de apuestas sin abrir que vencen y se agregó paginación estable de noticias.

El guardado protegido de moderadores utiliza el secreto opcional `FIREBASE_SERVICE_ACCOUNT`. Seguir [el orden de activación](../updates/2.0.8/firebase/Activar-Proteccion-Firebase-2.0.8.md) antes de restringir escrituras en Firestore. Sin ese secreto se conserva el circuito anterior. No publicar la credencial en este repositorio.
