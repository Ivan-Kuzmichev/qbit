// One-off: renders the logo glyph on an accent background into static/icons/*.png.
// The PNGs are committed; run `node scripts/generate-icons.mjs` only when the logo or accent changes.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ACCENT = '#60A5FA'
const INK = '#09090B'
// the glyph of src/components/ui/Logo.tsx, in its 24x24 box
const GLYPH = 'M12 4v11m0 0 4-4m-4 4-4-4M5 20h14'
const OUT = fileURLToPath(new URL('../static/icons/', import.meta.url))

const ICONS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]

// The iOS icon shape: a superellipse, whose corners ease into the edges rather than meet them at a circle.
function squircle(n = 5, steps = 240) {
  const points = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    const at = (v) => (12 + 12 * Math.sign(v) * Math.abs(v) ** (2 / n)).toFixed(3)
    points.push(`${at(Math.cos(a))} ${at(Math.sin(a))}`)
  }
  return `M${points.join('L')}Z`
}

const svg = (size, rounded = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  ${rounded ? `<path d="${squircle()}" fill="${ACCENT}"/>` : `<rect width="24" height="24" fill="${ACCENT}"/>`}
  <!-- glyph scaled to 60% around the centre: inside the maskable safe zone -->
  <g transform="translate(12 12) scale(0.6) translate(-12 -12.2)" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="${GLYPH}"/>
  </g>
</svg>`

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
try {
  for (const [name, size] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(`<body style="margin:0">${svg(size)}</body>`)
    await page.screenshot({ path: OUT + name, clip: { x: 0, y: 0, width: size, height: size } })
    await page.close()
    console.log(`wrote static/icons/${name}`)
  }
  // The README's logo: GitHub strips CSS, so the rounded corners have to be in the picture.
  const page = await browser.newPage({ viewport: { width: 384, height: 384 } })
  await page.setContent(`<body style="margin:0;background:transparent">${svg(384, true)}</body>`)
  await page.screenshot({ path: fileURLToPath(new URL('../docs/logo.png', import.meta.url)), omitBackground: true })
  await page.close()
  console.log('wrote docs/logo.png')
} finally {
  await browser.close()
}
