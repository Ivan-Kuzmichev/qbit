import type { Preferences } from '../../api/types'
import { t } from '../../i18n/ru'
import styles from './SettingRow.module.css'

const pad = (n: number) => String(n).padStart(2, '0')

export interface ScheduleEditorProps {
  draft: Preferences
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void
}

/** Start and end of the alternative-limits window, as two time inputs. */
export function ScheduleEditor({ draft, set }: ScheduleEditorProps) {
  const edit = (hourKey: 'schedule_from_hour' | 'schedule_to_hour', minKey: 'schedule_from_min' | 'schedule_to_min') =>
    (value: string) => {
      const m = /^(\d{2}):(\d{2})$/.exec(value)
      if (!m) return
      set(hourKey, Number(m[1]))
      set(minKey, Number(m[2]))
    }
  return (
    <div className={styles.schedule}>
      <input
        type="time"
        className={styles.input}
        aria-label={t.settings.scheduleFrom}
        value={`${pad(draft.schedule_from_hour)}:${pad(draft.schedule_from_min)}`}
        onChange={(e) => edit('schedule_from_hour', 'schedule_from_min')(e.target.value)}
      />
      <span aria-hidden="true">–</span>
      <input
        type="time"
        className={styles.input}
        aria-label={t.settings.scheduleTo}
        value={`${pad(draft.schedule_to_hour)}:${pad(draft.schedule_to_min)}`}
        onChange={(e) => edit('schedule_to_hour', 'schedule_to_min')(e.target.value)}
      />
    </div>
  )
}
