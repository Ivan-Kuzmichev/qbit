import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../../i18n/ru'
import { useDialogs } from '../../store/dialogs'
import styles from './DropOverlay.module.css'

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
const isTorrent = (f: File) => /\.torrent$/i.test(f.name) || f.type === 'application/x-bittorrent'

/** Opens the add dialog when .torrent files are dropped anywhere on the page. Dragged text is left alone. */
export function DropOverlay() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    function over(e: DragEvent) {
      if (!hasFiles(e)) return
      // without this the browser would navigate to the dropped file
      e.preventDefault()
      setActive(true)
    }
    function leave(e: DragEvent) {
      // relatedTarget is null when the pointer leaves the window
      if (!e.relatedTarget) setActive(false)
    }
    function drop(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      setActive(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter(isTorrent)
      if (files.length > 0) useDialogs.getState().openAdd('file', files)
    }
    window.addEventListener('dragenter', over)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', over)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  if (!active) return null
  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.box}>
        <Upload size={22} strokeWidth={1.8} />
        <span>{t.add.dropOverlay}</span>
      </div>
    </div>
  )
}
