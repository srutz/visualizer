# pdf-cors-proxy

A Cloudflare Worker that acts as a CORS proxy for fetching PDFs from arbitrary URLs. Used by the [PDF Visualizer](https://srutz.github.io/visualizer/) to load cross-origin PDFs that don't serve permissive CORS headers.

## How it works

The worker accepts a `GET` request with a `?url=` parameter, fetches the target PDF server-side, and streams it back to the browser with the appropriate `Access-Control-Allow-Origin` header.

```
GET https://pdf-cors-proxy.srutz.workers.dev/?url=https://example.com/document.pdf
```

## Usage from the visualizer

The visualizer supports two query parameters for loading remote PDFs:

| Parameter    | CORS required? | Example |
|-------------|---------------|---------|
| `?pdf=`      | Yes — the remote server must allow your origin | `https://srutz.github.io/visualizer/?pdf=https://cors-friendly-host.com/doc.pdf` |
| `?proxypdf=` | No — routed through this worker | `https://srutz.github.io/visualizer/?proxypdf=https://any-host.com/doc.pdf` |

## Setup

```bash
npm install
```

## Local development

```bash
npm run dev
```

This starts a local dev server (default `http://localhost:8787`). Test with:

```
http://localhost:8787/?url=https://example.com/some.pdf
```

## Deploy

```bash
npx wrangler login   # one-time authentication
npm run deploy
```

This deploys to `https://pdf-cors-proxy.<your-subdomain>.workers.dev`.

## Configuration

Environment variables are set in `wrangler.toml`:

| Variable          | Default                      | Description |
|-------------------|------------------------------|-------------|
| `ALLOWED_ORIGINS` | `https://srutz.github.io`    | Comma-separated list of allowed origins, or `*` for any |
| `MAX_SIZE`        | `52428800` (50 MB)           | Maximum upstream PDF size in bytes |

## Cloudflare Workers free tier

- 100,000 requests per day
- 10 ms CPU time per invocation
- No cold starts

More than enough for typical usage.
