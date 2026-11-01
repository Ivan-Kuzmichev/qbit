import { t } from '../../i18n/ru'
import { useTorrents } from '../../store/torrents'
import styles from './ConnectionBanner.module.css'

export function ConnectionBanner() {
  const lost = useTorrents((s) => s.connection === 'lost')
  if (!lost) return null
  return (
    <div role="status" className={styles.banner}>
      {t.connection.lost}
    </div>
  )
}
