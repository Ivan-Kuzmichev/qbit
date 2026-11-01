import { Logo } from '../../components/ui/Logo'
import { t } from '../../i18n'
import styles from './LoginScreen.module.css'

/** Shown at startup while qBittorrent is unreachable; the app retries on its own. Same card as the login screen. */
export function OfflineScreen() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.logo}>
            <Logo />
          </div>
          <div className={styles.titles}>
            <h1 className={styles.title}>{t.app.name}</h1>
            <span className={styles.host}>{location.host}</span>
          </div>
        </div>
        <div role="status" className={styles.offline}>
          {t.connection.lost}
        </div>
      </div>
    </div>
  )
}
