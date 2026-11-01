import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIR = 'qbit/public'
const LIMIT = 300 * 1024

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const files = walk(DIR).filter((f) => /\.(js|css)$/.test(f))
// A sample torrent of src/demo: the simulated API must never reach the build people install.
const leaked = files.filter((f) => readFileSync(f, 'utf8').includes('Sintel.2010'))
if (leaked.length > 0) {
  console.error(`The demo leaked into the bundle: ${leaked.join(', ')}`)
  process.exit(1)
}

const total = files.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0)
const kb = (total / 1024).toFixed(1)

if (total > LIMIT) {
  console.error(`Bundle too large: ${kb} KB gzip (limit ${LIMIT / 1024} KB)`)
  process.exit(1)
}
console.log(`Bundle OK: ${kb} KB gzip (limit ${LIMIT / 1024} KB)`)
