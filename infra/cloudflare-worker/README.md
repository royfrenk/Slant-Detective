# sd-telemetry Cloudflare Worker

Aggregate-only telemetry ingest for Slant Detective. AGPL-3.0.

## What it does

Accepts one POST per device per day from the Slant Detective extension, validates the
payload schema, writes one row to Cloudflare Analytics Engine, returns 204.

IP is **never** written. It is read from `CF-Connecting-IP` only as a rate-limit bucket
key (in-memory, discarded on request end).

## Deploy

```bash
cd infra/cloudflare-worker
npm install
wrangler deploy
```

Deploys to: `sd-telemetry.rabbit-factory.workers.dev`

## Tail logs (dev)

```bash
wrangler tail
```

Logs show only `METHOD /path` and status code. No request bodies are logged.

## Rotate secrets

No secrets currently. The Analytics Engine binding is configured in `wrangler.toml`.
