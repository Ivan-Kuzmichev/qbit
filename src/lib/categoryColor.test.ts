import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE, categoryColor } from './categoryColor'

describe('categoryColor', () => {
  it('has six colours including the mockup teal', () => {
    expect(CATEGORY_PALETTE).toHaveLength(6)
    expect(CATEGORY_PALETTE).toContain('#2DD4BF')
  })
  it('is stable and always in the palette', () => {
    for (const name of ['Софт', 'Кино', '', 'a', 'x'.repeat(500)]) {
      expect(categoryColor(name)).toBe(categoryColor(name))
      expect(CATEGORY_PALETTE).toContain(categoryColor(name))
    }
  })
  it('spreads different names over more than one colour', () => {
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(categoryColor)).size).toBeGreaterThan(1)
  })
})
