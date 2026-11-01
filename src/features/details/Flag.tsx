import { useEffect, useState } from 'react'
import styles from './Flag.module.css'

// Lazy on purpose: each flag is its own asset, fetched only when a peer from that country shows up.
const FLAGS = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default' })

const loaderFor = (code: string) => FLAGS[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]

/** A country flag. Renders nothing for an empty or unknown code. `name` is the tooltip and accessible name. */
export function Flag({ code, name }: { code: string; name: string }) {
  const [loaded, setLoaded] = useState<{ code: string; url: string } | null>(null)
  useEffect(() => {
    const load = code ? loaderFor(code) : undefined
    if (!load) return
    let live = true
    load()
      .then((url) => live && setLoaded({ code, url }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [code])

  if (!code || !loaderFor(code)) return null
  // Keep the slot while the file loads, so rows don't shift.
  if (loaded?.code !== code) return <span className={styles.flag} aria-hidden="true" />
  return <img className={styles.flag} src={loaded.url} alt={name} title={name} width={20} height={14} loading="lazy" />
}
