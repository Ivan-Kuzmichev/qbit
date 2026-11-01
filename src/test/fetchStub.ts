import { vi } from 'vitest'

export type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

export function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Routes fetch by API path (the part after `api/v2/`, without the query). */
export function stubFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const path = url.replace(/^.*api\/v2\//, '').replace(/\?.*$/, '')
    const handler = routes[path]
    if (!handler) return text('', 404)
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
