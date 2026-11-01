import { FileText, Folder, Upload, X } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { Toggle } from '../../components/ui/Toggle'
import { t } from '../../i18n'
import { formatBytes, plural } from '../../lib/format'
import type { AddTab } from '../../store/dialogs'
import { CategorySelect } from '../add/CategorySelect'
import { useAddForm } from '../add/useAddForm'
import styles from './MobileAddSheet.module.css'

export interface MobileAddSheetProps {
  tab: AddTab
  files: File[]
  onClose(): void
}

const tabs: { id: AddTab; label: string }[] = [
  { id: 'file', label: t.mobile.addFile },
  { id: 'magnet', label: t.mobile.addMagnet },
]

/** "Добавить торрент" as a bottom sheet over the list; same logic as the desktop dialog. */
export function MobileAddSheet({ tab: initialTab, files, onClose }: MobileAddSheetProps) {
  const {
    tab, setTab, entries, setEntries, magnets, setMagnets, savepath, editSavepath, category, start, setStart,
    sequential, setSequential, firstLast, setFirstLast, categories, magnetId, picker,
    ingest, canSubmit, changeCategory, createCategory, submit,
  } = useAddForm({ tab: initialTab, files, onClose })
  const options = [
    { label: t.add.startNow, checked: start, set: setStart },
    { label: t.add.sequential, checked: sequential, set: setSequential },
    { label: t.add.firstLast, checked: firstLast, set: setFirstLast },
  ]

  return (
    <Dialog
      title={t.add.title}
      onClose={onClose}
      footerKind="sheet"
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose}>
            {t.dialogs.cancel}
          </button>
          <button type="button" className={styles.submit} disabled={!canSubmit} onClick={submit}>
            {t.add.submit}
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Segmented<AddTab> options={tabs} value={tab} onChange={setTab} aria-label={t.add.tabLabel} />

        {tab === 'file' ? (
          <div className={styles.files}>
            <button type="button" className={styles.pick} onClick={() => picker.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              {t.mobile.pickFile}
            </button>
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
            {entries.length > 0 && (
              <ul className={styles.cards}>
                {entries.map((e) => {
                  const count = e.parsed ? e.parsed.files.filter((x) => !x.pad).length : 0
                  return (
                    <li key={e.id} className={styles.card}>
                      <FileText size={16} aria-hidden="true" color={e.failed ? 'var(--danger)' : 'var(--accent)'} />
                      <div className={styles.cardText}>
                        <span className={styles.cardName}>{e.file.name}</span>
                        {e.parsed && (
                          <span className={styles.cardMeta}>
                            {formatBytes(e.parsed.size)} · {plural(count, t.add.fileCount)}
                          </span>
                        )}
                        {e.failed && (
                          <span className={styles.cardError} role="alert">
                            {t.add.parseError}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={t.add.removeFile}
                        onClick={() => setEntries((cur) => cur.filter((x) => x.id !== e.id))}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className={styles.magnet}>
            <label className={styles.label} htmlFor={magnetId}>
              {t.add.magnetLabel}
            </label>
            <textarea
              id={magnetId}
              className={styles.textarea}
              rows={3}
              value={magnets}
              placeholder="magnet:?xt=urn:btih:…"
              spellCheck={false}
              onChange={(e) => setMagnets(e.target.value)}
            />
            <span className={styles.hint}>{t.add.magnetHint}</span>
          </div>
        )}

        <Field
          label={t.add.savePath}
          mono
          leading={<Folder size={15} strokeWidth={2} aria-hidden="true" />}
          value={savepath}
          onChange={(e) => editSavepath(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <CategorySelect
          value={category}
          categories={Object.keys(categories).sort((a, b) => a.localeCompare(b))}
          onChange={changeCategory}
          onCreate={createCategory}
        />

        <div className={styles.options}>
          {options.map((o) => (
            <div key={o.label} className={styles.option}>
              <span>{o.label}</span>
              <Toggle aria-label={o.label} checked={o.checked} onChange={o.set} />
            </div>
          ))}
        </div>
      </div>

    </Dialog>
  )
}
