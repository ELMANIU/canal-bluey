# Canal Bluey 24/7

Cloudflare Worker que genera una playlist HLS lineal 24/7 usando episodios almacenados en Cloudflare R2.

## Rutas

- `/` información básica
- `/live.m3u8` canal HLS
- `/status` episodio/segmento actual

## Cloudflare

El nombre del Worker debe ser `canal-bluey`, igual que en `wrangler.jsonc`.
