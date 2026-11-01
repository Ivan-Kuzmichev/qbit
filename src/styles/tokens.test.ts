import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

const tokens: Record<string, string> = {
  '--bg': '#09090B',
  '--surface': '#0C0C0E',
  '--card': '#0F0F12',
  '--row-selected': '#16171B',
  '--hover': '#18181B',
  '--chip': '#1C1C20',
  '--border': '#27272A',
  '--border-subtle': '#1F1F23',
  '--divider': '#18181B',
  '--text': '#FAFAFA',
  '--text-2': '#D4D4D8',
  '--muted': '#A1A1AA',
  '--dim': '#71717A',
  '--accent': '#60A5FA',
  '--seed': '#4ADE80',
  '--queue': '#FBBF24',
  '--danger': '#F87171',
  '--danger-bg': '#DC2626',
}

describe('tokens.css', () => {
  it('covers all 18 spec tokens', () => {
    expect(Object.keys(tokens)).toHaveLength(18)
  })

  it.each(Object.entries(tokens))('%s is %s', (name, value) => {
    const re = new RegExp(`${name}:\\s*${value}\\s*;`, 'i')
    expect(css).toMatch(re)
  })
})
