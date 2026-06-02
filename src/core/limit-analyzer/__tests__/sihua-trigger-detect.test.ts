import { describe, it, expect } from 'vitest'
import type { TriggerSihuaEntry } from '@/core/types'
import { detectSihuaTriggers } from '../sihua-trigger-engine'

describe('detectSihuaTriggers', () => {
  it('大限化禄本宫引动原局化禄', () => {
    const yuan: TriggerSihuaEntry[] = [
      { starName: '廉贞', palaceIndex: 4, type: '禄' },
    ]
    const daXian: TriggerSihuaEntry[] = [
      { starName: '武曲', palaceIndex: 4, type: '禄' },
    ]
    const triggers = detectSihuaTriggers(yuan, daXian, [])
    expect(triggers.some(t =>
      t.triggerLevel === 'daXian'
      && t.targetLevel === 'yuanJu'
      && t.relation === '本宫'
      && t.type === '禄',
    )).toBe(true)
  })

  it('流年化忌对宫引动大限化忌', () => {
    const yuan: TriggerSihuaEntry[] = []
    const daXian: TriggerSihuaEntry[] = [
      { starName: '太阳', palaceIndex: 0, type: '忌' },
    ]
    const liuNian: TriggerSihuaEntry[] = [
      { starName: '太阴', palaceIndex: 6, type: '忌' },
    ]
    const triggers = detectSihuaTriggers(yuan, daXian, liuNian)
    expect(triggers.some(t =>
      t.triggerLevel === 'liuNian'
      && t.targetLevel === 'daXian'
      && t.relation === '对宫'
      && t.type === '忌',
    )).toBe(true)
  })

  it('流年不直接引动原局', () => {
    const yuan: TriggerSihuaEntry[] = [
      { starName: '廉贞', palaceIndex: 2, type: '禄' },
    ]
    const daXian: TriggerSihuaEntry[] = []
    const liuNian: TriggerSihuaEntry[] = [
      { starName: '武曲', palaceIndex: 2, type: '禄' },
    ]
    const triggers = detectSihuaTriggers(yuan, daXian, liuNian)
    expect(triggers.some(t => t.targetLevel === 'yuanJu' && t.triggerLevel === 'liuNian')).toBe(false)
  })

  it('双夹检测', () => {
    const yuan: TriggerSihuaEntry[] = [
      { starName: '天同', palaceIndex: 5, type: '忌' },
    ]
    const daXian: TriggerSihuaEntry[] = [
      { starName: '巨门', palaceIndex: 4, type: '忌' },
      { starName: '贪狼', palaceIndex: 6, type: '忌' },
    ]
    const triggers = detectSihuaTriggers(yuan, daXian, [])
    expect(triggers.some(t => t.relation === '双夹' && t.type === '忌')).toBe(true)
  })
})
