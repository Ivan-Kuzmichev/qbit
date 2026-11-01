import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import styles from './DesktopLayout.module.css'

export function DesktopLayout({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.content}>{children}</main>
    </div>
  )
}
