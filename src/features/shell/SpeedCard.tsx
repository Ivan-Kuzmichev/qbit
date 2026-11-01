import { api } from '../../api/client'
import { Toggle } from '../../components/ui/Toggle'
import { t } from '../../i18n/ru'
import { formatBytes, formatSpeed } from '../../lib/format'
import { useTorrents } from '../../store/torrents'
import { Sparkline } from './Sparkline'
import styles from './SpeedCard.module.css'

async function toggleAltLimits(): Promise<void> {
  try {
    await api.post('transfer/toggleSpeedLimitsMode', {})
  } catch {
    // the next sync shows the real state; a failed toggle just stays off
    return
  }
  await useTorrents.getState().refresh().catch(() => {})
}

export function SpeedCard() {
  const server = useTorrents((s) => s.server)
  const history = useTorrents((s) => s.speedHistory)
  const [value, unit] = formatBytes(server.dl_info_speed ?? 0).split(' ')
  const limit = server.dl_rate_limit ?? 0

  return (
    <div className={styles.card}>
      <span className={styles.title}>{t.speed.download}</span>
      <div className={styles.speed}>
        <span className={styles.value}>{value}</span>
        <span className={styles.unit}>{unit + t.units.perSecond}</span>
      </div>
      <Sparkline values={history.map((p) => p.dl)} />
      <div className={styles.meta}>
        <span>↑ {formatSpeed(server.up_info_speed ?? 0)}</span>
        <span>{limit > 0 ? `${t.speed.limit} ${formatSpeed(limit)}` : t.speed.noLimit}</span>
      </div>
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
