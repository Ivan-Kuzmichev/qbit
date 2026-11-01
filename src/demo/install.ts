import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoBanner } from './DemoBanner'
import { createDemoServer, type DemoRequest } from './server'

function requestFrom(url: URL, body: BodyInit | null | undefined): DemoRequest {
  const form = body instanceof FormData ? body : null
  const fields = typeof body === 'string' ? new URLSearchParams(body) : null
  return {
    get: (name) => {
      const inForm = form?.get(name)
      return (typeof inForm === 'string' ? inForm : null) ?? fields?.get(name) ?? url.searchParams.get(name)
    },
    file: (name) => (form?.getAll(name) ?? []).filter((v): v is File => v instanceof File),
  }
}

/** Answers the app's WebAPI calls in the page, then shows the notice saying so. */
export function installDemo(): void {
  const server = createDemoServer()
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    const at = url.pathname.indexOf('api/v2/')
    if (at < 0) return realFetch(input, init)
    const res = await server.handle(url.pathname.slice(at + 'api/v2/'.length), requestFrom(url, init?.body))
    return res.json !== undefined
      ? new Response(JSON.stringify(res.json), { status: res.status, headers: { 'Content-Type': 'application/json' } })
      : new Response(res.text ?? '', { status: res.status, headers: { 'Content-Type': 'text/plain' } })
  }

  const host = document.createElement('div')
  document.body.append(host)
  createRoot(host).render(createElement(DemoBanner))
}
