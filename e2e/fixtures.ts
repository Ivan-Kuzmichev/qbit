import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test as base, expect, type APIRequestContext, type Cookie } from '@playwright/test'
import { BASE_URL, PASSWORD, USERNAME } from './env'

export const TINY_TORRENT = fileURLToPath(new URL('./fixtures/tiny.torrent', import.meta.url))
export const TINY_NAME = 'qbit-e2e-tiny.bin'
export const MULTI_TORRENT = fileURLToPath(new URL('./fixtures/multi.torrent', import.meta.url))
export const HYBRID_TORRENT = fileURLToPath(new URL('./fixtures/hybrid.torrent', import.meta.url))
export const HYBRID_NAME = 'qbit-e2e-hybrid'
export const PADDED_TORRENT = fileURLToPath(new URL('./fixtures/padded.torrent', import.meta.url))
export const PADDED_NAME = 'qbit-e2e-padded'
export const MULTI_NAME = 'qbit-e2e-multi'

export interface Qb {
  /** Adds a .torrent from disk; stopped by default so nothing tries to download. */
  addTorrent(file?: string, opts?: { stopped?: boolean }): Promise<void>
  prefs(): Promise<Record<string, unknown>>
  setPrefs(prefs: Record<string, unknown>): Promise<void>
  maindata(rid?: number): Promise<{ torrents?: Record<string, Record<string, unknown>>; server_state?: Record<string, unknown> }>
  files(hash: string): Promise<{ index: number; name: string; priority: number }[]>
  filePrio(hash: string, id: string, priority: number): Promise<void>
  removeAll(): Promise<void>
  /** The fixture's own session cookies: lets a page start signed in without spending a login attempt. */
  cookies(): Promise<Cookie[]>
}

async function ok(res: { ok(): boolean; status(): number; text(): Promise<string> }, what: string) {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`)
}

async function makeQb(request: APIRequestContext): Promise<Qb> {
  const login = await request.post(`${BASE_URL}/api/v2/auth/login`, { form: { username: USERNAME, password: PASSWORD } })
  expect(await login.text()).toBe('Ok.')

  const qb: Qb = {
    async addTorrent(file = TINY_TORRENT, opts = {}) {
      const stopped = String(opts.stopped ?? true)
      // `paused` is the pre-5.0 name; sending both mirrors the client (see task-8 report).
      const res = await request.post(`${BASE_URL}/api/v2/torrents/add`, {
        multipart: {
          torrents: { name: 'tiny.torrent', mimeType: 'application/x-bittorrent', buffer: readFileSync(file) },
          stopped,
          paused: stopped,
        },
      })
      await ok(res, 'torrents/add')
    },
    async prefs() {
      const res = await request.get(`${BASE_URL}/api/v2/app/preferences`)
      await ok(res, 'app/preferences')
      return res.json()
    },
    async setPrefs(prefs) {
      const res = await request.post(`${BASE_URL}/api/v2/app/setPreferences`, { form: { json: JSON.stringify(prefs) } })
      await ok(res, 'app/setPreferences')
    },
    async maindata(rid = 0) {
      const res = await request.get(`${BASE_URL}/api/v2/sync/maindata?rid=${rid}`)
      await ok(res, 'sync/maindata')
      return res.json()
    },
    async files(hash) {
      const res = await request.get(`${BASE_URL}/api/v2/torrents/files?hash=${hash}`)
      await ok(res, 'torrents/files')
      return res.json()
    },
    async filePrio(hash, id, priority) {
      const res = await request.post(`${BASE_URL}/api/v2/torrents/filePrio`, { form: { hash, id, priority: String(priority) } })
      await ok(res, 'torrents/filePrio')
    },
    async cookies() {
      return (await request.storageState()).cookies
    },
    async removeAll() {
      const res = await request.post(`${BASE_URL}/api/v2/torrents/delete`, { form: { hashes: 'all', deleteFiles: 'true' } })
      await ok(res, 'torrents/delete')
    },
  }
  return qb
}

export const test = base.extend<{ qb: Qb; lang: string | null }>({
  // Specs read the Russian strings; null leaves the app on its own default.
  lang: ['ru', { option: true }],
  context: async ({ context, lang }, use) => {
    if (lang) await context.addInitScript((l) => localStorage.getItem('qbit.lang') ?? localStorage.setItem('qbit.lang', l), lang)
    await use(context)
  },
  qb: async ({ playwright }, use) => {
    const request = await playwright.request.newContext()
    const qb = await makeQb(request)
    await qb.removeAll()
    await use(qb)
    await qb.removeAll()
    await request.dispose()
  },
})

export { expect }
