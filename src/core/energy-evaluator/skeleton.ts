/**
 * M2: 宫位评分 — 骨架映射库
 *
 * P01-P12：12种骨架（以紫微所在宫位命名）
 * 每种骨架定义12地支对应的旺弱等级
 *
 * 来源：SKILL_宫位原生能级评估 V1.0
 */

import type { DiZhi, PalaceBrightness } from '../types'

/** 骨架条目 */
export interface SkeletonEntry {
  /** 骨架序号 */
  id: string
  /** 命宫描述（紫微+地支） */
  description: string
  /** 12地支 → 旺弱等级 */
  brightnessMap: Record<DiZhi, PalaceBrightness>
}

/**
 * 骨架映射库 P01-P12
 *
 * 格式：每个骨架定义12地支的旺弱等级
 * 旺弱等级：极旺 / 旺 / 平 / 陷 / 极弱 / 空
 *
 * '空陷' = 空宫（无主星），按陷处理
 */
export const SKELETON_MAP: SkeletonEntry[] = [
  {
    id: 'P01',
    description: '紫微在子',
    brightnessMap: {
      '子': '旺', '丑': '陷', '寅': '平', '卯': '陷',
      '辰': '旺', '巳': '陷', '午': '旺', '未': '陷',
      '申': '平', '酉': '平', '戌': '旺', '亥': '平',
    },
  },
  {
    id: 'P02',
    description: '紫破在丑',
    brightnessMap: {
      '子': '旺', '丑': '旺', '寅': '陷', '卯': '平',
      '辰': '陷', '巳': '陷', '午': '旺', '未': '平',
      '申': '旺', '酉': '旺', '戌': '陷', '亥': '陷',
    },
  },
  {
    id: 'P03',
    description: '紫府在寅',
    brightnessMap: {
      '子': '旺', '丑': '平', '寅': '极旺', '卯': '陷',
      '辰': '旺', '巳': '陷', '午': '旺', '未': '旺',
      '申': '旺', '酉': '平', '戌': '旺', '亥': '陷',
    },
  },
  {
    id: 'P04',
    description: '紫贪在卯',
    brightnessMap: {
      '子': '陷', '丑': '旺', '寅': '平', '卯': '旺',
      '辰': '陷', '巳': '平', '午': '旺', '未': '旺',
      '申': '陷', '酉': '陷', '戌': '平', '亥': '陷',
    },
  },
  {
    id: 'P05',
    description: '紫相在辰',
    brightnessMap: {
      '子': '旺', '丑': '平', '寅': '旺', '卯': '旺',
      '辰': '平', '巳': '陷', '午': '旺', '未': '陷',
      '申': '旺', '酉': '陷', '戌': '平', '亥': '陷',
    },
  },
  {
    id: 'P06',
    description: '紫杀在巳',
    brightnessMap: {
      '子': '旺', '丑': '旺', '寅': '旺', '卯': '平',
      '辰': '旺', '巳': '旺', '午': '陷', '未': '陷',
      '申': '陷', '酉': '陷', '戌': '陷', '亥': '平',
    },
  },
  {
    id: 'P07',
    description: '紫微在午',
    brightnessMap: {
      '子': '旺', '丑': '陷', '寅': '旺', '卯': '旺',
      '辰': '平', '巳': '平', '午': '旺', '未': '陷',
      '申': '平', '酉': '陷', '戌': '旺', '亥': '旺',
    },
  },
  {
    id: 'P08',
    description: '紫破在未',
    brightnessMap: {
      '子': '旺', '丑': '平', '寅': '旺', '卯': '旺',
      '辰': '旺', '巳': '陷', '午': '旺', '未': '旺',
      '申': '陷', '酉': '旺', '戌': '旺', '亥': '旺',
    },
  },
  {
    id: 'P09',
    description: '紫府在申',
    brightnessMap: {
      '子': '旺', '丑': '平', '寅': '旺', '卯': '平',
      '辰': '旺', '巳': '旺', '午': '旺', '未': '平',
      '申': '极旺', '酉': '旺', '戌': '旺', '亥': '旺',
    },
  },
  {
    id: 'P10',
    description: '紫贪在酉',
    brightnessMap: {
      '子': '旺', '丑': '陷', '寅': '陷', '卯': '陷',
      '辰': '平', '巳': '旺', '午': '旺', '未': '旺',
      '申': '平', '酉': '旺', '戌': '陷', '亥': '旺',
    },
  },
  {
    id: 'P11',
    description: '紫相在戌',
    brightnessMap: {
      '子': '旺', '丑': '陷', '寅': '旺', '卯': '陷',
      '辰': '平', '巳': '陷', '午': '旺', '未': '平',
      '申': '旺', '酉': '极弱', '戌': '平', '亥': '陷',
    },
  },
  {
    id: 'P12',
    description: '紫杀在亥',
    brightnessMap: {
      '子': '陷', '丑': '陷', '寅': '陷', '卯': '平',
      '辰': '陷', '巳': '旺', '午': '陷', '未': '旺',
      '申': '平', '酉': '平', '戌': '旺', '亥': '旺',
    },
  },
]

/** 骨架索引 */
const skeletonIndex = new Map<string, SkeletonEntry>()
for (const entry of SKELETON_MAP) {
  skeletonIndex.set(entry.id, entry)
}

/**
 * 获取骨架条目
 */
export function getSkeleton(skeletonId: string): SkeletonEntry | null {
  return skeletonIndex.get(skeletonId) ?? null
}

/**
 * 根据骨架和地支获取旺弱等级
 */
export function getSkeletonBrightness(skeletonId: string, diZhi: DiZhi): PalaceBrightness {
  const skeleton = skeletonIndex.get(skeletonId)
  if (!skeleton) return '平'
  return skeleton.brightnessMap[diZhi]
}
