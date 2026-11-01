import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Preferences } from '../../api/types'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'
import type { AddTab } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { addTorrents, reportAddResult, type AddOptions } from './addFlow'
import { parseTorrent, type ParsedTorrent } from './parseTorrent'

export interface AddFormArgs {
  tab: AddTab
  files: File[]
  onClose(): void
}

export interface AddEntry {
  id: number
  file: File
  /** null while reading, or when `failed`. */
  parsed: ParsedTorrent | null
  failed: boolean
  /** One flag per downloadable file (padding files excluded: qBittorrent does not index them). */
  selected: boolean[]
}

let nextId = 1

/** State and submit logic shared by the desktop dialog and the mobile sheet. */
export function useAddForm({ tab: initialTab, files, onClose }: AddFormArgs) {
  const [tab, setTab] = useState<AddTab>(initialTab)
  const [entries, setEntries] = useState<AddEntry[]>([])
  const [magnets, setMagnets] = useState('')
  const [savepath, setSavepath] = useState('')
  const [defaultPath, setDefaultPath] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [start, setStart] = useState(true)
  const [sequential, setSequential] = useState(false)
  const [firstLast, setFirstLast] = useState(false)
  const [skipChecking, setSkipChecking] = useState(false)

  const categories = useTorrents((s) => s.categories)
  const knownTags = useTorrents((s) => s.tags)
  const free = useTorrents((s) => s.server.free_space_on_disk)
  const magnetId = useId()
  const picker = useRef<HTMLInputElement>(null)
  const seen = useRef(new Set<File>())
  /** Once the user edits the folder, a late settings response must not overwrite it. */
  const pathTouched = useRef(false)

  useEffect(() => {
    api
      .get<Preferences>('app/preferences')
      .then((p) => {
        if (typeof p.save_path !== 'string') return
        setDefaultPath(p.save_path)
        if (!pathTouched.current) setSavepath(p.save_path)
      })
      .catch(() => {
        // the field stays empty and qBittorrent's own default applies
      })
  }, [])

  function ingest(list: readonly File[]) {
    const fresh = list.filter((f) => !seen.current.has(f))
    if (fresh.length === 0) return
    fresh.forEach((f) => seen.current.add(f))
    const rows = fresh.map<AddEntry>((file) => ({ id: nextId++, file, parsed: null, failed: false, selected: [] }))
    setEntries((cur) => [...cur, ...rows])
    for (const row of rows) {
      void row.file
        .arrayBuffer()
        .then((buf) => parseTorrent(new Uint8Array(buf)))
        .then(
          (parsed) => ({ parsed, failed: false, selected: parsed.files.filter((f) => !f.pad).map(() => true) }),
          () => ({ parsed: null, failed: true, selected: [] as boolean[] }),
        )
        .then((patch) => setEntries((cur) => cur.map((e) => (e.id === row.id ? { ...e, ...patch } : e))))
    }
  }

  // Files dropped while the dialog is already open: show the file tab (adjusted during render, not in an effect).
  const [seenFiles, setSeenFiles] = useState(files)
  if (files !== seenFiles) {
    setSeenFiles(files)
    if (files.length > 0) setTab('file')
  }
  useEffect(() => ingest(files), [files])

  const valid = entries.filter((e) => e.parsed)
  // The per-file list is for one torrent; with several, each is added whole.
  const single = valid.length === 1 ? valid[0] : null
  const shownFiles = single ? single.parsed!.files.filter((f) => !f.pad).map((f, i) => ({ ...f, i })) : []
  const pickedCount = single ? shownFiles.filter((f) => single.selected[f.i]).length : 0
  const magnetLines = magnets.split('\n').map((l) => l.trim()).filter(Boolean)

  // a file that is still being read could turn out to be the only valid one, or an invalid one: wait for it
  const parsing = entries.some((e) => !e.parsed && !e.failed)
  const canSubmit = tab === 'magnet' ? magnetLines.length > 0 : !parsing && valid.length > 0 && (!single || pickedCount > 0)

  function toggleFile(entryId: number, index: number, on: boolean) {
    setEntries((cur) => cur.map((e) => (e.id === entryId ? { ...e, selected: e.selected.map((s, i) => (i === index ? on : s)) } : e)))
  }

  function editSavepath(value: string) {
    pathTouched.current = true
    setSavepath(value)
  }

  function changeCategory(name: string) {
    pathTouched.current = true
    setCategory(name)
    setSavepath(categories[name]?.savePath || defaultPath)
  }

  async function createCategory(name: string): Promise<boolean> {
    try {
      await api.post('torrents/createCategory', { category: name, savePath: '' })
    } catch {
      toast(t.add.categoryFailed)
      return false
    }
    void useTorrents.getState().refresh().catch(() => {})
    return true
  }

  function submit() {
    if (!canSubmit) return
    const options: AddOptions = { savepath: savepath.trim(), category, tags, start, sequential, firstLast, skipChecking }
    const req =
      tab === 'magnet'
        ? { torrents: [], magnets: magnetLines, options }
        : {
            torrents: valid.map((e) => ({ name: e.file.name, data: e.file, infohash: e.parsed!.infohash, ids: e.parsed!.ids, selected: single ? e.selected : null })),
            magnets: [],
            options,
          }
    onClose()
    void addTorrents(req, { api, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now() })
      .then(reportAddResult)
      .then(() => useTorrents.getState().refresh())
      .catch(() => {
        // the next poll shows the new torrents anyway
      })
  }

  return {
    tab, setTab, entries, setEntries, magnets, setMagnets, savepath, editSavepath, category, tags, setTags,
    start, setStart, sequential, setSequential, firstLast, setFirstLast, skipChecking, setSkipChecking,
    categories, knownTags, free, magnetId, picker,
    ingest, valid, single, shownFiles, pickedCount, canSubmit, toggleFile, changeCategory, createCategory, submit,
  }
}
