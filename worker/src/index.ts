/**
 * Cloudflare Worker — lightweight CORS proxy for fetching PDFs.
 *
 * Usage:  GET https://<worker>.workers.dev/?url=<encoded-pdf-url>
 *
 * The worker fetches the remote PDF server-side and streams it back
 * with permissive CORS headers so the browser can read the bytes.
 */

interface Env {
  ALLOWED_ORIGINS: string
  MAX_SIZE: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    }

    if (request.method !== 'GET') {
      return jsonError(405, 'Method not allowed')
    }

    const { searchParams } = new URL(request.url)
    const target = searchParams.get('url')

    if (!target) {
      return jsonError(400, 'Missing ?url= parameter')
    }

    // Basic sanity check — only allow http(s) URLs.
    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return jsonError(400, 'Invalid URL')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return jsonError(400, 'Only http/https URLs are supported')
    }

    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'pdf-cors-proxy/1.0' },
        redirect: 'follow',
      })

      if (!upstream.ok) {
        return jsonError(upstream.status, `Upstream returned ${upstream.status}`)
      }

      // Enforce a size limit so the worker isn't abused to proxy huge files.
      const maxSize = parseInt(env.MAX_SIZE || '52428800', 10)
      const contentLength = parseInt(upstream.headers.get('content-length') || '0', 10)
      if (contentLength > maxSize) {
        return jsonError(413, `File too large (${contentLength} bytes, max ${maxSize})`)
      }

      const headers = new Headers(corsHeaders(request, env))
      headers.set('Content-Type', upstream.headers.get('content-type') || 'application/pdf')
      if (upstream.headers.has('content-length')) {
        headers.set('Content-Length', upstream.headers.get('content-length')!)
      }

      return new Response(upstream.body, { status: 200, headers })
    } catch (err) {
      return jsonError(502, `Fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
} satisfies ExportedHandler<Env>

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const allowedOrigins = env.ALLOWED_ORIGINS || '*'
  const origin = request.headers.get('Origin') || '*'

  // If ALLOWED_ORIGINS is "*", allow everything. Otherwise check the list.
  let allowOrigin = '*'
  if (allowedOrigins !== '*') {
    const list = allowedOrigins.split(',').map((s) => s.trim())
    allowOrigin = list.includes(origin) ? origin : list[0]
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
