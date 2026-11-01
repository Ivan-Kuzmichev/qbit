// Serves dist-demo at /qbit/, the path it gets on GitHub Pages, so a wrong absolute path fails here too.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x')
  if (!pathname.startsWith('/qbit/')) return res.writeHead(404).end()
  let file = join('dist-demo', normalize(decodeURIComponent(pathname.slice('/qbit/'.length))))
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}).listen(Number(process.argv[2]))
