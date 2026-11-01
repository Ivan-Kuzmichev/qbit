import { Toggle } from '../../components/ui/Toggle'
import { t } from '../../i18n/ru'
import { formatBytes, formatSpeed } from '../../lib/format'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { toggleAltLimits } from '../torrents/actions'
import { Sparkline } from './Sparkline'
import styles from './SpeedCard.module.css'

export function SpeedCard() {
  const server = useTorrents((s) => s.server)
  const history = useTorrents((s) => s.speedHistory)
  const [value, unit] = formatBytes(server.dl_info_speed ?? 0).split(' ')
  const limit = server.dl_rate_limit ?? 0
  const limitText = limit > 0 ? `${t.speed.limit} ${formatSpeed(limit)}` : t.speed.noLimit
  // The visible text is a mix of fragments; spell the values out for assistive tech.
  const label = `${t.speed.openLimits}: ${t.speed.download} ${formatSpeed(server.dl_info_speed ?? 0)}, ${t.speed.upload} ${formatSpeed(server.up_info_speed ?? 0)}, ${limitText}`

  return (
    <div className={styles.card}>
      <button type="button" className={styles.open} aria-label={label} onClick={() => useDialogs.getState().openLimits('global')}>
        <span className={styles.title}>{t.speed.download}</span>
        <span className={styles.speed}>
          <span className={styles.value}>{value}</span>
          <span className={styles.unit}>{unit + t.units.perSecond}</span>
        </span>
        <Sparkline values={history.map((p) => p.dl)} />
        <span className={styles.meta}>
          <span>↑ {formatSpeed(server.up_info_speed ?? 0)}</span>
          <span>{limitText}</span>
        </span>
      </button>
      <div className={styles.alt}>
        <span>{t.speed.altLimits}</span>
        <Toggle
          checked={Boolean(server.use_alt_speed_limits)}
          onChange={() => void toggleAltLimits()}
          aria-label={t.speed.altLimits}
        />
      </div>
    </div>
  )
}
