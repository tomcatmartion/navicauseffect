/**
 * 事项断语整流 — 最多 3 条、每条 ≤80 字，含对宫回退
 */

import type { MatterType, PalaceName, PalaceScore } from '@/core/types'
import { PALACE_NAMES, PALACE_NAME_TO_INDEX } from '@/core/types'
import { getEventStarAttributes } from '@/core/knowledge-dict/loader'
import { getStarAttr } from '@/core/knowledge-dict/query'

const MAX_ITEMS = 3
const MAX_LEN = 80

function mapWarmCoolToEventKey(label: PalaceScore['warmCoolLabel'] | undefined): string {
  if (label === '旺') return '实旺'
  if (label === '旺偏磨炼') return '磨炼'
  if (label === '虚浮') return '虚浮'
  if (label === '凶危') return '凶危'
  return '平'
}

function truncate(text: string): string {
  const t = text.trim()
  if (t.length <= MAX_LEN) return t
  return `${t.slice(0, MAX_LEN - 1)}…`
}

function lookupEventDescription(
  matterType: MatterType,
  palace: PalaceName,
  starName: string,
  brightnessKey: string,
): string | null {
  const raw = getEventStarAttributes() as {
    descriptions?: Record<string, Record<string, Record<string, Record<string, string>>>>
  }
  const text = raw.descriptions?.[matterType]?.[palace]?.[starName]?.[brightnessKey]
  return text ?? null
}

/** 获取对宫宫位名 */
function getOppositePalace(palace: PalaceName): PalaceName {
  const idx = PALACE_NAME_TO_INDEX[palace]
  if (idx === undefined) return palace
  return PALACE_NAMES[(idx + 6) % 12] as PalaceName
}

function fallbackStarDescription(starName: string): string | null {
  const attr = getStarAttr(starName as Parameters<typeof getStarAttr>[0])
  if (!attr) return null
  return `${starName}：${attr.coreTrait}`
}

export function slimEventDescriptions(
  matterType: MatterType,
  primaryPalace: PalaceName,
  secondaryPalaces: PalaceName[],
  palaceScores: PalaceScore[],
): string[] {
  const results: string[] = []
  const seen = new Set<string>()
  const targets = [primaryPalace, ...secondaryPalaces]

  for (const palace of targets) {
    if (results.length >= MAX_ITEMS) break
    const row = palaceScores.find(p => p.palace === palace)
    if (!row) continue
    const brightnessKey = mapWarmCoolToEventKey(row.warmCoolLabel)
    for (const ms of row.majorStars) {
      if (results.length >= MAX_ITEMS) break
      const key = `${palace}:${ms.star}`
      if (seen.has(key)) continue
      seen.add(key)
      // 优先精确匹配 → 亮度降级 → 对宫回退 → 通用星曜特质
      const fromEvent =
        lookupEventDescription(matterType, palace, ms.star, brightnessKey)
        ?? lookupEventDescription(matterType, palace, ms.star, '平')
      const fromOpposite = !fromEvent
        ? (lookupEventDescription(matterType, getOppositePalace(palace), ms.star, brightnessKey)
          ?? lookupEventDescription(matterType, getOppositePalace(palace), ms.star, '平'))
        : null
      const text = fromEvent ?? (fromOpposite ? `（对宫投射）${fromOpposite}` : null) ?? fallbackStarDescription(ms.star)
      if (text) results.push(truncate(text))
    }
  }

  return results.slice(0, MAX_ITEMS)
}
