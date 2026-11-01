import { FileText, Folder, Upload, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { t } from '../../i18n'
import { formatBytes, plural } from '../../lib/format'
import type { AddTab } from '../../store/dialogs'
import styles from './AddDialog.module.css'
import { CategorySelect } from './CategorySelect'
import { TagInput } from './TagInput'
import { useAddForm } from './useAddForm'

export interface AddDialogProps {
  tab: AddTab
  files: File[]
  onClose(): void
}

const tabs: { id: AddTab; label: string }[] = [
  { id: 'file', label: t.add.tabFile },
  { id: 'magnet', label: t.add.tabMagnet },
]

export function AddDialog({ tab: initialTab, files, onClose }: AddDialogProps) {
  const {
    tab, setTab, entries, setEntries, magnets, setMagnets, savepath, editSavepath, category, tags, setTags,
    start, setStart, sequential, setSequential, firstLast, setFirstLast, skipChecking, setSkipChecking,
    categories, knownTags, free, magnetId, picker,
    ingest, single, shownFiles, pickedCount, canSubmit, toggleFile, changeCategory, createCategory, submit,
  } = useAddForm({ tab: initialTab, files, onClose })

  return (
    <Dialog
      title={t.add.title}
      onClose={onClose}
      width={620}
      anchorTop
      footer={
        <>
          <span className={styles.free}>{typeof free === 'number' && free >= 0 ? `${t.add.free} ${formatBytes(free)}` : ''}</span>
          <Button size="sm" onClick={onClose}>
            {t.dialogs.cancel}
          </Button>
          <Button size="sm" variant="primary" disabled={!canSubmit} onClick={submit}>
            {t.add.submit}
          </Button>
        </>
      }
    >
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
                          {formatBytes(e.parsed.size)} · {plural(e.parsed.files.filter((f) => !f.pad).length, t.add.fileCount)}
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
            mono
            leading={<Folder size={14} strokeWidth={2} aria-hidden="true" />}
            value={savepath}
            onChange={(e) => editSavepath(e.target.value)}
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

    </Dialog>
  )
}
