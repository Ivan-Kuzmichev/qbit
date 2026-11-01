import { describe, expect, it } from 'vitest'
import { formatBytes, formatEta, formatLimitSpeed, formatSpeed, percentOf, plural } from './format'

const P: [string, string, string] = ['пир', 'пира', 'пиров']

describe('formatLimitSpeed', () => {
  it('drops the zeros of a whole value and nothing else', () => {
    expect(formatLimitSpeed(5 * 1024 * 1024)).toBe('5 МБ/с')
    expect(formatLimitSpeed(50 * 1024 * 1024)).toBe('50 МБ/с')
    expect(formatLimitSpeed(1.5 * 1024 * 1024)).toBe('1.50 МБ/с')
    expect(formatLimitSpeed(500 * 1024)).toBe('500 КБ/с')
  })
})

describe('format', () => {
  it('formatBytes', () => {
    expect(formatBytes(833)).toBe('833 Б')
    expect(formatBytes(0)).toBe('0 Б')
    expect(formatBytes(NaN)).toBe('0 Б')
    expect(formatBytes(1024)).toBe('1.00 КБ')
    expect(formatBytes(2.6 * 1024 ** 3)).toBe('2.60 ГБ')
    expect(formatBytes(11.8 * 1024 ** 3)).toBe('11.8 ГБ')
    expect(formatBytes(150 * 1024 ** 2)).toBe('150 МБ')
    expect(formatBytes(1024 ** 2 - 1)).toBe('1.00 МБ')
    expect(formatBytes(1024 ** 5)).toBe('1024 ТБ')
  })
  it('formatSpeed', () => {
    expect(formatSpeed(0)).toBe('0 Б/с')
    expect(formatSpeed(310 * 1024)).toBe('310 КБ/с')
  })
  it('formatEta', () => {
    expect(formatEta(8 * 60)).toBe('8 мин')
    expect(formatEta(30)).toBe('< 1 мин')
    expect(formatEta(2 * 3600 + 5 * 60)).toBe('2 ч 5 мин')
    expect(formatEta(2 * 3600)).toBe('2 ч')
    expect(formatEta(3 * 86400)).toBe('3 д')
    expect(formatEta(8640000)).toBe('∞')
    expect(formatEta(9999999)).toBe('∞')
  })
  it('plural', () => {
    expect(plural(31, P)).toBe('31 пир')
    expect(plural(54, P)).toBe('54 пира')
    expect(plural(12, P)).toBe('12 пиров')
    expect(plural(11, P)).toBe('11 пиров')
    expect(plural(0, P)).toBe('0 пиров')
    expect(plural(111, P)).toBe('111 пиров')
    expect(plural(121, P)).toBe('121 пир')
  })
})

describe('percentOf', () => {
  it('floors without float error and never rounds up to 100', () => {
    expect(percentOf(0.29)).toBe(29)
    expect(percentOf(0.57)).toBe(57)
    expect(percentOf(0.58)).toBe(58)
    expect(percentOf(0.999)).toBe(99)
    expect(percentOf(1)).toBe(100)
    expect(percentOf(NaN)).toBe(0)
  })
})
