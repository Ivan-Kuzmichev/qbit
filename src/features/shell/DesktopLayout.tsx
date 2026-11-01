import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import styles from './DesktopLayout.module.css'

/** `bare`: the page brings its own padding, as settings does. */
export function DesktopLayout({ children, bare }: { children?: ReactNode; bare?: boolean }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={`${styles.content} ${bare ? styles.bare : ''}`}>{children}</main>
    </div>
  )
}
