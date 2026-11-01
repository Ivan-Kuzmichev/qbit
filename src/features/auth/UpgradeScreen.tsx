import { t } from '../../i18n/ru'
import styles from './LoginScreen.module.css'

export function UpgradeScreen({ appVersion, apiVersion }: { appVersion: string; apiVersion: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.card} role="alert">
        <div className={styles.titles}>
          <h1 className={styles.title}>{t.upgrade.title}</h1>
          <span className={styles.host}>
            {t.app.qbittorrent} {appVersion} · {t.app.webApi} {apiVersion}
          </span>
        </div>
        <span>{t.upgrade.hint}</span>
      </div>
    </div>
  )
}
