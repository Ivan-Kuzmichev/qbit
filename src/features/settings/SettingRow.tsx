import { useEffect, useState } from 'react'
import type { Preferences } from '../../api/types'
import { Toggle } from '../../components/ui/Toggle'
import { t } from '../../i18n/ru'
import { parseDecimal, parseLimitKb } from '../../lib/parseNumber'
import { useUi } from '../../store/ui'
import { ScheduleEditor } from './ScheduleEditor'
import { ACCENT_PRESETS, type Row } from './schema'
import styles from './SettingRow.module.css'

export interface SettingRowProps {
  row: Row
  draft: Preferences
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void
  setInvalid(key: string, bad: boolean): void
}


const trimNumber = (n: number) => String(Math.round(n * 100) / 100)

/** Text shown in a numeric field for a stored value; "no limit" is an empty field. */
function formatNumber(row: Row, value: number): string {
  if (row.kind === 'limit') return value > 0 ? trimNumber(value / 1024) : ''
  return value < 0 ? '' : String(value)
}

/** Stored value for what was typed; null when it is not acceptable. */
function parseNumberField(row: Row, text: string): number | null {
  if (row.kind === 'limit') return parseLimitKb(text)
  const s = text.trim()
  if (row.unlimited && (s === '' || s === '∞')) return -1
  const n = row.decimal ? parseDecimal(s) : /^\d+$/.test(s) ? Number(s) : null
  if (n === null || !Number.isFinite(n)) return null
  if (row.min !== undefined && n < row.min) return null
  if (row.max !== undefined && n > row.max) return null
  return n
}

function NumberInput({ row, draft, set, setInvalid }: SettingRowProps) {
  const key = row.key as keyof Preferences
  const [text, setText] = useState(() => formatNumber(row, draft[key] as number))
  const [bad, setBad] = useState(false)

  useEffect(() => () => setInvalid(key, false), [key, setInvalid])

  const onChange = (value: string) => {
    setText(value)
    const parsed = parseNumberField(row, value)
    setBad(parsed === null)
    setInvalid(key, parsed === null)
    if (parsed !== null) set(key, parsed as never)
  }
  const message = row.max !== undefined ? t.settings.invalidPort : t.settings.invalidNumber
  const noLimit = row.kind === 'limit' || row.unlimited
  return (
    <span className={styles.control}>
      <span className={`${styles.frame} ${styles.narrow}`} data-invalid={bad || undefined}>
        <input
          className={`${styles.input} ${styles.mono}`}
          aria-label={row.label}
          aria-invalid={bad || undefined}
          inputMode="decimal"
          placeholder={noLimit ? '∞' : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
        {row.unit && <span className={styles.unit}>{row.unit}</span>}
      </span>
      {bad && (
        <span className={styles.error} role="alert">
          {message}
        </span>
      )}
    </span>
  )
}

function Control(props: SettingRowProps) {
  const { row, draft, set } = props
  const key = row.key as keyof Preferences
  switch (row.kind) {
    case 'toggle': {
      const [off, on] = row.toggleValues ?? [0, 1]
      const checked = row.toggleValues ? draft[key] === on : Boolean(draft[key])
      return (
        <Toggle
          aria-label={row.label}
          checked={checked}
          onChange={(v) => set(key, (row.toggleValues ? (v ? on : off) : v) as never)}
        />
      )
    }
    case 'text':
    case 'password':
      return (
        <span className={`${styles.frame} ${styles.wide}`}>
          <input
            className={styles.input}
            aria-label={row.label}
            type={row.kind === 'password' ? 'password' : 'text'}
            autoComplete={row.kind === 'password' ? 'new-password' : 'off'}
            value={(draft[key] as string | undefined) ?? ''}
            onChange={(e) => set(key, e.target.value as never)}
          />
        </span>
      )
    case 'number':
    case 'limit':
      return <NumberInput {...props} />
    case 'select':
      return (
        <select
          className={`${styles.input} ${styles.select}`}
          aria-label={row.label}
          value={String(draft[key])}
          onChange={(e) => set(key, Number(e.target.value) as never)}
        >
          {row.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'schedule':
      return <ScheduleEditor draft={draft} set={set} />
    case 'accent':
      return <AccentPicker />
  }
}

function AccentPicker() {
  const accent = useUi((s) => s.accent)
  const setAccent = useUi((s) => s.setAccent)
  return (
    <div role="radiogroup" aria-label={t.settings.accentLabel} className={styles.swatches}>
      {ACCENT_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c.toLowerCase() === accent.toLowerCase()}
          aria-label={c}
          className={styles.swatch}
          style={{ '--swatch': c } as React.CSSProperties}
          onClick={() => setAccent(c)}
        />
      ))}
    </div>
  )
}

export function SettingRow(props: SettingRowProps) {
  const { row, draft } = props
  if (row.visibleIf && !row.visibleIf(draft)) return null
  // Controls with a label of their own (switches, fields) get it through aria-label.
  const hidden = row.kind === 'accent'
  return (
    <div className={styles.row}>
      {!hidden && (
        <div className={styles.text}>
          <span className={styles.label}>{row.label}</span>
          {row.hint && <span className={styles.hint}>{row.hint}</span>}
        </div>
      )}
      <Control {...props} />
    </div>
  )
}

