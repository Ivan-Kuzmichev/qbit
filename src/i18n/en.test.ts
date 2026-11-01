import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ru } from './ru'

const leaves = (o: unknown, path = ''): [string, string][] =>
  typeof o === 'string'
    ? [[path, o]]
    : Object.entries(o as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))

describe('en dictionary', () => {
  it('has every key of ru and no others', () => {
    expect(leaves(en).map(([k]) => k).sort()).toEqual(leaves(ru).map(([k]) => k).sort())
  })

  it('holds no Cyrillic', () => {
    expect(leaves(en).filter(([, v]) => /[А-Яа-яЁё]/.test(v))).toEqual([])
  })

  it('keeps the same placeholders', () => {
    const count = (s: string) => (s.match(/%[A-Z]/g) ?? []).join()
    const r = new Map(leaves(ru))
    expect(leaves(en).filter(([k, v]) => count(v) !== count(r.get(k)!))).toEqual([])
  })
})
