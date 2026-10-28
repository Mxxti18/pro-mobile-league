# Corrección del buscador de jugadores · PML Torneos 2.1.1

Se corrigió un error del servidor que impedía buscar jugadores: el entorno de Cloudflare Workers rechaza `redirect: error`. El integrador ahora usa `manual` y comprueba el estado de la respuesta sin seguir redirecciones externas.

Se agregó una búsqueda enfocada en futbolistas cuando la búsqueda general de Wikidata no encuentra una ficha apropiada por nombre o apellido.

Validación en Cloudflare Workers con consultas reales y descarga de retratos: Messi, Ronaldo, Álvaro Morata (buscando Morata), Lucas Digne, Lionel y Luis. Pruebas del integrador, validación de planteles y comunidad completadas.

La corrección está aplicada al servidor. No requiere descargar un APK nuevo, cambiar las reglas de Firebase ni modificar la configuración de Cloudflare. Cerrar y volver a abrir el formulario de registro y repetir la búsqueda.

La disponibilidad de cada jugador y fotografía sigue dependiendo de Wikidata y Wikimedia Commons.
