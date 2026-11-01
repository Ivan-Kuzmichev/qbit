import { BASE_URL, PASSWORD, USERNAME, compose } from './env'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor<T>(what: string, fn: () => Promise<T | null>, timeoutMs = 90_000): Promise<T> {
  const end = Date.now() + timeoutMs
  let last: unknown
  while (Date.now() < end) {
    try {
      const v = await fn()
      if (v !== null) return v
    } catch (e) {
      last = e
    }
    await sleep(1000)
  }
  throw new Error(`Timed out waiting for ${what}${last ? `: ${String(last)}` : ''}`)
}

async function login(password: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: USERNAME, password }),
  })
  const body = await res.text()
  if (res.status !== 200 || body.trim() !== 'Ok.') return null
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('SID='))
  return cookie ? cookie.split(';')[0] : null
}

export default async function globalSetup(): Promise<void> {
  compose('down', '-v', '--remove-orphans')
  compose('up', '-d')

  // linuxserver prints a temporary admin password to the log when none is configured.
  const temp = await waitFor('temporary password in container logs', async () => {
    const m = compose('logs', '--no-color', 'qbittorrent').match(/temporary password[^:]*:\s*(\S+)/i)
    return m ? m[1] : null
  })
  const sid = await waitFor('login with temporary password', () => login(temp))

  const prefs = {
    web_ui_password: PASSWORD,
    alternative_webui_enabled: true,
    alternative_webui_path: '/qbit',
  }
  const res = await fetch(`${BASE_URL}/api/v2/app/setPreferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sid },
    body: new URLSearchParams({ json: JSON.stringify(prefs) }),
  })
  if (!res.ok) throw new Error(`setPreferences failed: ${res.status} ${await res.text()}`)

  await waitFor('login with test password', () => login(PASSWORD))
  // The alternative UI must now be served instead of the stock one.
  await waitFor('alternative WebUI', async () => {
    const html = await (await fetch(`${BASE_URL}/`)).text()
    return html.includes('id="root"') ? true : null
  })
}
