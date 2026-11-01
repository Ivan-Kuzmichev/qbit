import { FileText, Folder, Upload, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Preferences } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'
import { formatBytes, plural } from '../../lib/format'
import type { AddTab } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { addTorrents, reportAddResult, type AddOptions } from './addFlow'
import styles from './AddDialog.module.css'
import { CategorySelect } from './CategorySelect'
import { parseTorrent, type ParsedTorrent } from './parseTorrent'
import { TagInput } from './TagInput'

export interface AddDialogProps {
  tab: AddTab
  files: File[]
  onClose(): void
}

interface Entry {
  id: number
  file: File
  /** null while reading, or when `failed`. */
  parsed: ParsedTorrent | null
  failed: boolean
  /** One flag per file of the torrent, padding files included. */
  selected: boolean[]
}

const tabs: { id: AddTab; label: string }[] = [
  { id: 'file', label: t.add.tabFile },
  { id: 'magnet', label: t.add.tabMagnet },
]

let nextId = 1

export function AddDialog({ tab: initialTab, files, onClose }: AddDialogProps) {
  const [tab, setTab] = useState<AddTab>(initialTab)
  const [entries, setEntries] = useState<Entry[]>([])
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
    const rows = fresh.map<Entry>((file) => ({ id: nextId++, file, parsed: null, failed: false, selected: [] }))
    setEntries((cur) => [...cur, ...rows])
    for (const row of rows) {
      void row.file
        .arrayBuffer()
        .then((buf) => parseTorrent(new Uint8Array(buf)))
        .then(
          (parsed) => ({ parsed, failed: false, selected: parsed.files.map(() => true) }),
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
  const shownFiles = single ? single.parsed!.files.map((f, i) => ({ ...f, i })).filter((f) => !f.pad) : []
  const pickedCount = single ? shownFiles.filter((f) => single.selected[f.i]).length : 0
  const magnetLines = magnets.split('\n').map((l) => l.trim()).filter(Boolean)

  const canSubmit = tab === 'magnet' ? magnetLines.length > 0 : valid.length > 0 && (!single || pickedCount > 0)

  function toggleFile(entryId: number, index: number, on: boolean) {
    setEntries((cur) => cur.map((e) => (e.id === entryId ? { ...e, selected: e.selected.map((s, i) => (i === index ? on : s)) } : e)))
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
            torrents: valid.map((e) => ({ name: e.file.name, data: e.file, infohash: e.parsed!.infohash, selected: e.selected })),
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

  return (
    <Dialog title={t.add.title} onClose={onClose} width={620}>
      <div className={styles.form}>
        <div className={styles.seg}>
          <Segmented<AddTab> options={tabs} value={tab} onChange={(id) => setTab(id)} aria-label={t.add.tabLabel} />
        </div>

        {tab === 'file' ? (
          <>
            <div className={styles.drop}>
              <Upload size={22} strokeWidth={1.8} aria-hidden="true" />
              <span className={styles.dropText}>
                {t.add.dropText}{' '}
                <button type="button" className={styles.link} onClick={() => picker.current?.click()}>
                  {t.add.dropPick}
                </button>
              </span>
              <span className={styles.dropHint}>{t.add.dropHint}</span>
              <input
                ref={picker}
                type="file"
                multiple
                accept=".torrent,application/x-bittorrent"
                hidden
                data-testid="file-input"
                onChange={(e) => {
                  ingest(Array.from(e.target.files ?? []))
                  e.target.value = ''
                }}
              />
            </div>

            {entries.length > 0 && (
              <ul className={styles.cards}>
                {entries.map((e) => (
                  <li key={e.id} className={styles.card}>
                    <FileText size={16} strokeWidth={1.8} aria-hidden="true" color={e.failed ? 'var(--danger)' : 'var(--accent)'} />
                    <div className={styles.cardText}>
                      <span className={styles.cardName}>{e.file.name}</span>
                      {e.parsed && (
                        <span className={styles.cardMeta}>
                          {formatBytes(e.parsed.size)} · {e.parsed.files.filter((f) => !f.pad).length} {plural(e.parsed.files.filter((f) => !f.pad).length, t.add.fileCount)}
                        </span>
                      )}
                      {e.failed && (
                        <span className={styles.cardError} role="alert">
                          {t.add.parseError}
                        </span>
                      )}
                    </div>
                    <button type="button" className={styles.remove} aria-label={t.add.removeFile} onClick={() => setEntries((cur) => cur.filter((x) => x.id !== e.id))}>
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className={styles.magnet}>
            <label className={styles.label} htmlFor={magnetId}>
              {t.add.magnetLabel}
            </label>
            <textarea
              id={magnetId}
              className={styles.textarea}
              rows={5}
              value={magnets}
              placeholder="magnet:?xt=urn:btih:…"
              spellCheck={false}
              autoFocus
              onChange={(e) => setMagnets(e.target.value)}
            />
            <span className={styles.hint}>{t.add.magnetHint}</span>
          </div>
        )}

        <div className={styles.grid}>
          <Field
            className={styles.wide}
            label={t.add.savePath}
            height={36}
            leading={<Folder size={14} strokeWidth={2} aria-hidden="true" />}
            value={savepath}
            onChange={(e) => {
              pathTouched.current = true
              setSavepath(e.target.value)
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <CategorySelect value={category} categories={Object.keys(categories).sort((a, b) => a.localeCompare(b))} onChange={changeCategory} onCreate={createCategory} />
          <TagInput value={tags} onChange={setTags} suggestions={knownTags} />
        </div>

        <div className={styles.options}>
          <Checkbox label={t.add.startNow} checked={start} onChange={setStart} />
          <Checkbox label={t.add.sequential} checked={sequential} onChange={setSequential} />
          <Checkbox label={t.add.firstLast} checked={firstLast} onChange={setFirstLast} />
          <Checkbox label={t.add.skipChecking} checked={skipChecking} onChange={setSkipChecking} />
        </div>

        {tab === 'file' && single && (
          <div className={styles.files}>
            <div className={styles.filesHead}>
              <span>{t.add.files}</span>
              <span>
                {t.add.selectedOf} {pickedCount} {t.add.of} {shownFiles.length}
              </span>
            </div>
            <ul className={styles.fileList}>
              {shownFiles.map((f) => {
                const cut = f.path.lastIndexOf('/') + 1
                return (
                  <li key={f.i} className={styles.fileRow}>
                    <Checkbox
                      checked={single.selected[f.i]}
                      onChange={(on) => toggleFile(single.id, f.i, on)}
                      label={
                        <span className={styles.path}>
                          <span className={styles.dir}>{f.path.slice(0, cut)}</span>
                          {f.path.slice(cut)}
                        </span>
                      }
                    />
                    <span className={styles.size}>{formatBytes(f.size)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.free}>{typeof free === 'number' && free >= 0 ? `${t.add.free} ${formatBytes(free)}` : ''}</span>
        <Button size="sm" onClick={onClose}>
          {t.dialogs.cancel}
        </Button>
        <Button size="sm" variant="primary" disabled={!canSubmit} onClick={submit}>
          {t.add.submit}
        </Button>
      </div>
    </Dialog>
  )
}
