import type { api as realApi } from '../../api/client'
import { ApiError } from '../../api/client'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'

export interface AddOptions {
  savepath: string
  category: string
  tags: string[]
  /** "Запустить сразу". */
  start: boolean
  sequential: boolean
  firstLast: boolean
  skipChecking: boolean
}

export interface AddTorrentInput {
  /** Shown in reports. */
  name: string
  data: Blob
  infohash: string
  /** Other ids qBittorrent may file it under (hybrid torrents); `infohash` is used when absent. */
  ids?: string[]
  /** One flag per downloadable file of the torrent (padding files excluded), in order; null or all true means "everything". */
  selected: boolean[] | null
}

export interface AddRequest {
  torrents: AddTorrentInput[]
  magnets: string[]
  options: AddOptions
}

export interface AddResult {
  added: number
  failed: { name: string; reason: string }[]
}

export interface AddDeps {
  api: Pick<typeof realApi, 'get' | 'post'>
  sleep(ms: number): Promise<void>
  now(): number
}

const POLL_MS = 500
const WAIT_MS = 30_000

class Failure extends Error {}

function baseForm(o: AddOptions, stopped: boolean): FormData {
  const f = new FormData()
  // `paused` is the pre-5.0 name; 5.x honours `stopped`. Both carry the same value.
  f.set('stopped', String(stopped))
  f.set('paused', String(stopped))
  if (o.savepath) f.set('savepath', o.savepath)
  if (o.category) f.set('category', o.category)
  if (o.tags.length) f.set('tags', o.tags.join(','))
  f.set('sequentialDownload', String(o.sequential))
  f.set('firstLastPiecePrio', String(o.firstLast))
  f.set('skip_checking', String(o.skipChecking))
  return f
}

async function post(deps: AddDeps, form: FormData): Promise<void> {
  let body: unknown
  try {
    body = await deps.api.post('torrents/add', form)
  } catch (e) {
    if (e instanceof ApiError) throw new Failure(t.add.alreadyAdded)
    throw new Failure(t.add.network)
  }
  if (typeof body === 'string' && body.trim() === 'Fails.') throw new Failure(t.add.alreadyAdded)
}

/** Waits for the torrent to show up; returns its hash as qBittorrent spells it. */
async function waitFor(deps: AddDeps, ids: string[]): Promise<string> {
  const want = ids.map((i) => i.toLowerCase())
  const started = deps.now()
  for (;;) {
    try {
      const list = await deps.api.get<{ hash: string }[]>('torrents/info', { hashes: want.join('|') })
      const hit = list.find((x) => want.includes(x.hash.toLowerCase()))
      if (hit) return hit.hash
    } catch {
      throw new Failure(t.add.network)
    }
    if (deps.now() - started >= WAIT_MS) throw new Failure(t.add.notAppeared)
    await deps.sleep(POLL_MS)
  }
}

async function addOne(item: AddTorrentInput, o: AddOptions, deps: AddDeps): Promise<void> {
  const unchecked = item.selected ? item.selected.flatMap((on, i) => (on ? [] : [i])) : []
  // `torrents/add` takes no file selection, so a partial selection is applied after adding.
  const partial = unchecked.length > 0
  const form = baseForm(o, partial ? true : !o.start)
  form.set('torrents', item.data, item.name)
  await post(deps, form)
  if (!partial) return

  const hash = await waitFor(deps, item.ids?.length ? item.ids : [item.infohash])
  try {
    await deps.api.post('torrents/filePrio', { hash, id: unchecked.join('|'), priority: 0 })
    if (o.start) await deps.api.post('torrents/start', { hashes: hash })
  } catch {
    throw new Failure(t.add.prioFailed)
  }
}

export async function addTorrents(req: AddRequest, deps: AddDeps): Promise<AddResult> {
  const result: AddResult = { added: 0, failed: [] }
  const fail = (name: string, e: unknown) => result.failed.push({ name, reason: e instanceof Failure ? e.message : t.add.network })

  for (const item of req.torrents) {
    try {
      await addOne(item, req.options, deps)
      result.added++
    } catch (e) {
      fail(item.name, e)
    }
  }
  if (req.magnets.length > 0) {
    try {
      const form = baseForm(req.options, !req.options.start)
      form.set('urls', req.magnets.join('\n'))
      await post(deps, form)
      result.added += req.magnets.length
    } catch (e) {
      fail(t.add.magnets, e)
    }
  }
  return result
}

/** Failures become toasts; success is visible in the list and stays silent. */
export function reportAddResult(result: AddResult, show: (message: string) => void = toast): void {
  for (const f of result.failed) show(`${f.name}: ${f.reason}`)
}
