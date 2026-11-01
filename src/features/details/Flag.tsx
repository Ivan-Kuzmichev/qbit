import styles from './Flag.module.css'

// Only a code -> URL map ships in the bundle; each SVG is fetched when its <img> is rendered (loading="lazy").
const FLAGS = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', { eager: true, query: '?url', import: 'default' })

const urlFor = (code: string): string | undefined => FLAGS[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]

/** A country flag. Renders nothing for an empty or unknown code. `name` is the tooltip and accessible name. */
export function Flag({ code, name }: { code: string; name: string }) {
  const url = code ? urlFor(code) : undefined
  if (!url) return null
  return <img className={styles.flag} src={url} alt={name} title={name} width={20} height={14} loading="lazy" />
}
