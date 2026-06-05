/**
 * 主格式化器 — 将 Stage3Output 转换为规范定义的 MatterAnalysisSpec
 *
 * 编排流程：
 * 1. 顶层信息（matterType, mode, targetYear, currentYear, compositeScore, scoreLabel）
 * 2. 四化汇总拆分（shengNian + taiSui）
 * 3. 三层12宫完整数据提取
 * 4. 组装 yuanJu（ming + primary[] + secondary[] + sihuaSummary）
 * 5. 组装 daXian（ageRange + ming + primary[] + sihua + triggersOnYuanJuPrimary）
 * 6. 组装 liuNian（year + ming + primary[] + sihua + luCun + triggersOnDaXianPrimary + overlap）
 *
 * 所有数据来源均为现有接口，不重复计算。
 */

import type {
  Stage1Output, Stage3Output, PalaceName, MatterType,
} from '../types'
import { PALACE_NAME_TO_INDEX } from '../types'
import type { AnalysisMode, MatterAnalysisSpec, SihuaItemSpec } from './types'
import { splitSihuaSummary } from './sihua-summary-splitter'
import { locateLuCunPalaceFromContext } from './lucun-locator'
import { detectOverlap } from './overlap-detector'
import { groupTriggers, extractPalaceLevelsFromScores } from './trigger-grouping-engine'
import {
  extractNatalLayer, extractDaXianLayer, extractLiuNianLayer,
  fillThreeQuadrants,
} from './layer-extractor'
import type { LayerFullData } from './layer-extractor'

// ═══════════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════════

export interface FormatMatterAnalysisInput {
  stage1: Stage1Output
  stage3: Stage3Output
  matterType: MatterType
  targetYear: number
  chartData: Record<string, unknown>
  mode?: AnalysisMode
}

/**
 * 将现有 Stage3Output 转换为规范格式的 MatterAnalysisSpec
 *
 * @param input 所有必需的输入数据
 * @returns 完整的规范格式输出
 */
export function formatMatterAnalysis(
  input: FormatMatterAnalysisInput,
): MatterAnalysisSpec {
  const { stage1, stage3, matterType, targetYear, chartData } = input
  const mode: AnalysisMode = input.mode ?? '未发生'

  // ── 步骤 1：提取三层完整数据 ──
  const natalLayer = extractNatalLayer(stage1, stage3.threeLayerTable)

  // 找到当前大限
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 1990
  const currentDaXian = findCurrentDaXian(stage3, targetYear, birthYear, chartData)

  const daXianLayer = currentDaXian
    ? extractDaXianLayer(currentDaXian, stage3.threeLayerTable, stage1.scoringCtx)
    : createEmptyLayer()

  const liuNianLayer = extractLiuNianLayer(
    targetYear,
    stage3.threeLayerTable,
    stage1.scoringCtx,
    stage3.liuNianPalaceScores,
    daXianLayer.mingOriginalIndex,
  )

  // ── 步骤 2：确定事项宫位列表 ──
  const primaryPalace = stage3.primaryAnalysis.palace
  const secondaryPalaces = stage3.secondaryPalaceSnapshots?.map(s => s.palace) ?? []
  const primaryPalaces = [primaryPalace, ...secondaryPalaces]

  // ── 步骤 3：四化汇总 ──
  const sihuaSummary = splitSihuaSummary(stage1.mergedSihua)

  // ── 步骤 4：组装 yuanJu ──
  const yuanJu = buildYuanJu(
    natalLayer, primaryPalaces, secondaryPalaces, sihuaSummary,
  )

  // ── 步骤 5：组装 daXian ──
  const daXian = buildDaXian(
    currentDaXian, daXianLayer, primaryPalaces, stage3,
  )

  // ── 步骤 6：组装 liuNian ──
  const liuNian = buildLiuNian(
    targetYear, liuNianLayer, primaryPalaces, stage3, natalLayer,
    daXianLayer.mingOriginalIndex,
  )

  // ── 步骤 7：顶层组装 ──
  return {
    matterType,
    mode,
    targetYear,
    currentYear: new Date().getFullYear(),
    compositeScore: mode === '未发生' ? stage3.compositeScore : null,
    scoreLabel: mode === '未发生' ? stage3.scoreLabel : null,
    yuanJu,
    daXian,
    liuNian,
  }
}

// ═══════════════════════════════════════════════════════════════════
// yuanJu 组装
// ═══════════════════════════════════════════════════════════════════

function buildYuanJu(
  natalLayer: LayerFullData,
  primaryPalaces: PalaceName[],
  secondaryPalaces: PalaceName[],
  sihuaSummary: ReturnType<typeof splitSihuaSummary>,
) {
  // 命宫（索引 0）
  const mingPalace = natalLayer.palaces[0]
  const mingBase = mingPalace?.base ?? createEmptyBase('命宫')
  const mingTriQuads = fillThreeQuadrants(0, natalLayer)

  // 事项宫位（primary）
  const primaryItems = primaryPalaces.map(name => {
    const idx = getPalaceIndexSafe(name)
    const palace = natalLayer.palaces[idx]
    return {
      ...palace?.base ?? createEmptyBase(name),
      threeQuadrants: fillThreeQuadrants(idx, natalLayer),
    }
  })

  // 辅助宫位（secondary）— 不含三方四正
  const secondaryItems = secondaryPalaces.map(name => {
    const idx = getPalaceIndexSafe(name)
    return natalLayer.palaces[idx]?.base ?? createEmptyBase(name)
  })

  return {
    ming: { ...mingBase, threeQuadrants: mingTriQuads },
    primary: primaryItems,
    secondary: secondaryItems,
    sihuaSummary,
  }
}

// ═══════════════════════════════════════════════════════════════════
// daXian 组装
// ═══════════════════════════════════════════════════════════════════

function buildDaXian(
  currentDaXian: DaXianPalaceMapping | undefined,
  daXianLayer: LayerFullData,
  primaryPalaces: PalaceName[],
  stage3: Stage3Output,
) {
  if (!currentDaXian) {
    return createEmptyDaXian(primaryPalaces)
  }

  // 大限命宫
  const daXianMingIdx = 0 // 大限层命宫始终为第0个
  const mingBase = daXianLayer.palaces[daXianMingIdx]?.base ?? createEmptyBase('命宫')
  const mingTriQuads = fillThreeQuadrants(daXianMingIdx, daXianLayer)

  // 大限四化列表
  const sihuaList = buildSihuaList(currentDaXian.mutagen, currentDaXian.daXianGan, stage3)

  // 事项宫位
  const primaryItems = primaryPalaces.map(name => {
    const idx = getPalaceIndexSafe(name)
    const palace = daXianLayer.palaces[idx]
    const originalPalace = palace?.base.originalPalace ?? null
    return {
      ...(palace?.base ?? createEmptyBase(name)),
      originalPalace,
      correspondingYuanJuPrimary: name,
      threeQuadrants: fillThreeQuadrants(idx, daXianLayer),
    }
  })

  // 引动分组：大限 → 原局
  const triggers = stage3.sihuaTriggers ?? []
  const palaceLevels = extractPalaceLevelsFromScores(
    stage3.daXianPalaceScores ?? [],
  )
  const triggersOnYuanJu = groupTriggers(
    triggers, primaryPalaces, palaceLevels, 'yuanJu',
  )

  return {
    ageRange: `${currentDaXian.ageRange[0]}-${currentDaXian.ageRange[1]}`,
    ming: { ...mingBase, threeQuadrants: mingTriQuads },
    primary: primaryItems,
    sihua: { list: sihuaList },
    triggersOnYuanJuPrimary: triggersOnYuanJu,
  }
}

// ═══════════════════════════════════════════════════════════════════
// liuNian 组装
// ═══════════════════════════════════════════════════════════════════

function buildLiuNian(
  targetYear: number,
  liuNianLayer: LayerFullData,
  primaryPalaces: PalaceName[],
  stage3: Stage3Output,
  natalLayer: LayerFullData,
  daXianMingOriginalIndex: number,
) {
  // 流年命宫
  const mingBase = liuNianLayer.palaces[0]?.base ?? createEmptyBase('命宫')
  const mingTriQuads = fillThreeQuadrants(0, liuNianLayer)

  // 流年四化列表
  const liuNianSihuaEntries = stage3.threeLayerTable.yearly.palaces[0]?.sihua ?? []
  const sihuaList: SihuaItemSpec[] = liuNianSihuaEntries.map(e => ({
    type: sihuaTypeShort(e.type),
    star: e.star,
    palace: findSihuaPalace(e.star, liuNianLayer),
  }))

  // 禄存位置
  const luCunPalace = liuNianLayer.scoringCtx
    ? locateLuCunPalaceFromContext(liuNianLayer.scoringCtx)
    : '未定位'

  // 事项宫位
  const primaryItems = primaryPalaces.map(name => {
    const idx = getPalaceIndexSafe(name)
    const palace = liuNianLayer.palaces[idx]
    return {
      ...(palace?.base ?? createEmptyBase(name)),
      correspondingDaXianPrimary: name,
      correspondingYuanJuPrimary: name,
      threeQuadrants: fillThreeQuadrants(idx, liuNianLayer, daXianMingOriginalIndex),
    }
  })

  // 引动分组：流年 → 大限
  const triggers = stage3.sihuaTriggers ?? []
  const palaceLevels = extractPalaceLevelsFromScores(
    stage3.liuNianPalaceScores ?? [],
  )
  const triggersOnDaXian = groupTriggers(
    triggers, primaryPalaces, palaceLevels, 'daXian',
  )

  // 重叠检测
  const overlap = detectOverlap(
    primaryPalaces,
    primaryPalaces, // 大限事项宫位与原局相同
    primaryPalaces,
  )

  return {
    year: targetYear,
    ming: { ...mingBase, threeQuadrants: mingTriQuads },
    primary: primaryItems,
    sihua: { list: sihuaList },
    luCun: { palace: luCunPalace },
    triggersOnDaXianPrimary: triggersOnDaXian,
    overlap,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

import type { DaXianPalaceMapping } from '../types'

/** 找到当前大限（优先使用 currentDaXianDetail 的权威信息） */
function findCurrentDaXian(
  stage3: Stage3Output,
  _targetYear: number,
  _birthYear: number,
  _chartData: Record<string, unknown>,
): DaXianPalaceMapping | undefined {
  // 优先从 currentDaXianDetail 获取（由 matter-limit-engine 通过 horoscope 权威数据构建）
  if (stage3.currentDaXianDetail) {
    const detail = stage3.currentDaXianDetail
    const mapping = stage3.allDaXianMappings.find(m => m.index === detail.index)
    if (mapping) {
      // 用 currentDaXianDetail 的权威信息覆盖，确保 palaceIndex 正确
      return {
        ...mapping,
        mingPalaceName: detail.mingPalaceName,
        daXianGan: detail.daXianGan,
        palaceIndex: PALACE_NAME_TO_INDEX[detail.mingPalaceName] ?? mapping.palaceIndex,
      }
    }
  }

  // 从 daXianTimeline 找当前大限
  const currentEntry = stage3.daXianTimeline?.find(d => d.isCurrent)
  if (currentEntry) {
    return stage3.allDaXianMappings.find(
      m => m.index === currentEntry.index,
    )
  }

  // 回退：第一个大限
  return stage3.allDaXianMappings[0]
}

/** 构建四化列表（从 mutagen 数组） */
function buildSihuaList(
  mutagen: string[],
  _gan: string,
  stage3: Stage3Output,
): SihuaItemSpec[] {
  const types: Array<'禄' | '权' | '科' | '忌'> = ['禄', '权', '科', '忌']
  const result: SihuaItemSpec[] = []

  for (let i = 0; i < mutagen.length && i < 4; i++) {
    const star = mutagen[i]
    if (!star) continue

    // 从 sihuaLandingReport 中找到该星的落宫
    const palace = findSihuaPalaceFromLandingReport(star, `化${types[i]}`, stage3)

    result.push({
      type: types[i],
      star,
      palace,
    })
  }

  return result
}

/** 从 sihuaLandingReport 中查找四化落宫 */
function findSihuaPalaceFromLandingReport(
  star: string,
  sihuaType: string,
  stage3: Stage3Output,
): PalaceName {
  for (const layer of stage3.sihuaLandingReport.layers) {
    for (const row of layer.rows) {
      if (row.star === star && row.sihuaType === sihuaType) {
        return row.palace ?? '命宫'
      }
    }
  }
  return '命宫'
}

/** 在层中查找四化星所在宫位 */
function findSihuaPalace(
  starName: string,
  layer: LayerFullData,
): PalaceName {
  for (const palace of layer.palaces) {
    if (palace.base.sihua?.includes(starName)) {
      return palace.base.palaceName
    }
  }
  return '命宫'
}

function sihuaTypeShort(fullType: string): '禄' | '权' | '科' | '忌' {
  const map: Record<string, '禄' | '权' | '科' | '忌'> = {
    '化禄': '禄', '化权': '权', '化科': '科', '化忌': '忌',
  }
  return map[fullType] ?? '禄'
}

function getPalaceIndexSafe(name: PalaceName): number {
  return PALACE_NAME_TO_INDEX[name] ?? 0
}

function createEmptyBase(name: PalaceName) {
  return {
    palaceName: name,
    earthlyBranch: '子' as const,
    heavenlyStem: '甲' as const,
    majorStars: '',
    minorStars: '',
    sihua: null as string | null,
    score: 0,
    level: '平' as const,
    originalPalace: null as PalaceName | null,
    daXianPalace: null as PalaceName | null,
  }
}

function createEmptyDaXian(primaryPalaces: PalaceName[]) {
  return {
    ageRange: '0-0',
    ming: { ...createEmptyBase('命宫'), threeQuadrants: createEmptyThreeQuadrants() },
    primary: primaryPalaces.map(name => ({
      ...createEmptyBase(name),
      correspondingYuanJuPrimary: name,
      threeQuadrants: createEmptyThreeQuadrants(),
    })),
    sihua: { list: [] },
    triggersOnYuanJuPrimary: primaryPalaces.map(name => ({
      primaryPalace: name,
      isTriggered: false,
      triggerItems: [],
      combinedAdvice: '',
    })),
  }
}

function createEmptyThreeQuadrants() {
  const empty = createEmptyBase('命宫')
  return {
    opposite: { ...empty },
    firstTrine: { ...empty },
    secondTrine: { ...empty },
  }
}

function createEmptyLayer(): LayerFullData {
  return {
    palaces: Array.from({ length: 12 }, (_, i) => ({
      base: createEmptyBase(['命宫', '父母', '福德', '田宅', '官禄', '仆役',
        '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'][i] as PalaceName),
      patterns: [],
      flankingPairs: [],
    })),
    mingOriginalIndex: 0,
    scoringCtx: null,
  }
}
