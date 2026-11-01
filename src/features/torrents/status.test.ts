import { describe, expect, it } from 'vitest'
import type { Torrent } from '../../api/types'
import { uiStatus } from './status'

const mk = (o: Partial<Torrent>): Torrent =>
  ({
    state: 'downloading', progress: 0.5, size: 3.4 * 1024 ** 3, completed: 2.65 * 1024 ** 3,
    uploaded: 5.76 * 1024 ** 3, eta: 480, num_seeds: 50, num_leechs: 4, ...o,
  }) as Torrent

describe('uiStatus', () => {
  it.each([
    ['downloading', 'downloading', 'stop'],
    ['forcedDL', 'downloading', 'stop'],
    ['metaDL', 'downloading', 'stop'],
    ['forcedMetaDL', 'downloading', 'stop'],
    ['stalledDL', 'downloading', 'stop'],
    ['uploading', 'seeding', 'stop'],
    ['forcedUP', 'seeding', 'stop'],
    ['stalledUP', 'seeding', 'stop'],
    ['stoppedUP', 'done', 'start'],
    ['stoppedDL', 'paused', 'start'],
    ['queuedDL', 'queued', 'forceStart'],
    ['queuedUP', 'queued', 'forceStart'],
    ['checkingDL', 'checking', null],
    ['checkingUP', 'checking', null],
    ['checkingResumeData', 'checking', null],
    ['moving', 'moving', null],
    ['error', 'error', 'recheck'],
    ['missingFiles', 'error', 'recheck'],
  ])('%s -> %s / %s', (state, kind, action) => {
    const r = uiStatus(mk({ state }))
    expect(r.kind).toBe(kind)
    expect(r.action).toBe(action)
  })

  it('builds sub lines', () => {
    expect(uiStatus(mk({ state: 'downloading' })).sub).toBe('54 пира · осталось 8 мин')
    expect(uiStatus(mk({ state: 'stalledDL' })).sub).toBe('Ищет пиров')
    expect(uiStatus(mk({ state: 'uploading', num_leechs: 12 })).sub).toBe('12 пиров · отдано 5.76 ГБ')
    expect(uiStatus(mk({ state: 'stoppedUP' })).sub).toBe('3.40 ГБ')
    expect(uiStatus(mk({ state: 'stoppedDL' })).sub).toBe('2.65 ГБ из 3.40 ГБ')
    expect(uiStatus(mk({ state: 'queuedDL' })).sub).toBe('Ждёт своей очереди')
    expect(uiStatus(mk({ state: 'checkingDL', progress: 0.427 })).sub).toBe('42%')
    expect(uiStatus(mk({ state: 'moving', progress: 1 })).sub).toBe('100%')
    expect(uiStatus(mk({ state: 'error' })).sub).toBe('Ошибка')
    expect(uiStatus(mk({ state: 'missingFiles' })).sub).toBe('Файлы не найдены')
  })

  it('unknown states fall back by progress', () => {
    expect(uiStatus(mk({ state: 'unknown', progress: 0.3 })).kind).toBe('paused')
    expect(uiStatus(mk({ state: 'weird', progress: 1 })).kind).toBe('done')
  })

  it('magnet without metadata has no NaN', () => {
    for (const state of ['downloading', 'stoppedDL', 'stoppedUP', 'uploading', 'checkingDL', 'unknown']) {
      const sub = uiStatus(mk({ state, size: 0, completed: 0, progress: 0, eta: 8640000 })).sub
      expect(sub).not.toContain('NaN')
    }
    expect(uiStatus(mk({ state: 'downloading', size: 0, eta: 8640000 })).sub).toBe('54 пира · осталось ∞')
    const bad = uiStatus(mk({ state: 'downloading', progress: NaN, eta: NaN, num_seeds: undefined as never }))
    expect(bad.sub).not.toContain('NaN')
  })
})
