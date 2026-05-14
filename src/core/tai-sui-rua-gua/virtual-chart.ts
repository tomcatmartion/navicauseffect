/**
 * M3: 太岁入卦 — 虚拟命盘构建
 *
 * 职责：以对方生年地支为虚拟命宫，构建虚拟十二宫，
 *       计算入卦星曜落位（四化+禄存羊陀+魁钺+鸾喜）
 *
 * 核心修正（vs 旧版）：
 * 1. 四化落宫直接从命主命盘查找（不再用占位值 '子'）
 * 2. buildVirtualChart 接收命主 palaces 数据，直接查找四化星位置
 *
 * 数据来源：data/tai_sui_rua_gua_tables.json（支持热加载）
 */

import type { DiZhi, TianGan, SihuaMap } from '../types'
import { PALACE_NAMES, type PalaceName } from '../types'
import { calculateOriginalSihua } from '../sihua-calculator'
import type { PalaceForScoring } from '../energy-evaluator/scoring-flow'
import { getTaiSuiTables } from '../knowledge-dict/loader'

// ═══════════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════════

/** 入卦星曜落位 */
export interface IncomingStar {
  /** 星曜名 */
  star: string
  /** 落入命主的哪个地支宫 */
  targetDiZhi: DiZhi
  /** 星曜类型 */
  type: '生年四化' | '太岁宫宫干四化' | '禄存' | '擎羊' | '陀罗' | '天魁' | '天钺' | '红鸾' | '天喜'
  /** 四化类型（仅四化类有） */
  sihuaType?: '化禄' | '化权' | '化科' | '化忌'
}

/** 虚拟命盘 */
export interface VirtualChart {
  /** 入卦者生年天干 */
  gan: TianGan
  /** 入卦者生年地支 */
  zhi: DiZhi
  /** 虚拟命宫（= 入卦者生年地支） */
  virtualMingGong: DiZhi
  /** 虚拟十二宫排列（地支 → 宫名） */
  virtualPalaces: Record<DiZhi, PalaceName>
  /** 所有入卦星曜落位 */
  incomingStars: IncomingStar[]
  /** 入卦者原局四化 */
  sihua: {
    shengNian: SihuaMap
    dunGan: SihuaMap
  }
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

/** 十二地支顺序 */
const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/**
 * 构建虚拟十二宫
 * 以入卦者生年地支为虚拟命宫，按固定顺序排列
 */
function buildVirtualPalaces(virtualMingZhi: DiZhi): Record<DiZhi, PalaceName> {
  const result: Record<string, PalaceName> = {}
  const startIdx = DI_ZHI_ORDER.indexOf(virtualMingZhi)
  for (let i = 0; i < 12; i++) {
    const zhi = DI_ZHI_ORDER[(startIdx + i) % 12]
    result[zhi] = PALACE_NAMES[i]
  }
  return result as Record<DiZhi, PalaceName>
}

/**
 * 在命主命盘中查找星曜所在的地支
 *
 * 修正：直接遍历命主12宫查找星曜位置，不再返回占位值
 */
function findStarInNatalPalaces(starName: string, natalPalaces: PalaceForScoring[]): DiZhi {
  for (const palace of natalPalaces) {
    if (palace.stars.some(s => s.name === starName)) {
      return palace.diZhi
    }
  }
  return '子' // 未找到时的默认值（理论上不应出现）
}

/**
 * 降级查找：无命盘数据时的占位查找
 * 仅在不提供 natalPalaces 时使用
 */
function findStarPalaceFallback(_starName: string): DiZhi {
  return '子'
}

// ═══════════════════════════════════════════════════════════════════
// 虚拟命盘构建
// ═══════════════════════════════════════════════════════════════════

/**
 * 构建完整虚拟命盘
 *
 * 修正：接收命主命盘数据，四化落宫直接从命盘查找
 *
 * @param partnerGan 入卦者生年天干
 * @param partnerZhi 入卦者生年地支
 * @param natalPalaces 命主命盘的12宫数据（用于四化星落位查找）
 * @returns 虚拟命盘
 */
export function buildVirtualChart(
  partnerGan: TianGan,
  partnerZhi: DiZhi,
  natalPalaces?: PalaceForScoring[],
): VirtualChart {
  const incomingStars: IncomingStar[] = []
  const tables = getTaiSuiTables()

  // 1. 读取入卦者原局四化
  const sihua = calculateOriginalSihua(partnerGan, partnerZhi)

  // 2. 生年四化落位
  const shengNian = sihua.shengNian
  incomingStars.push(
    { star: shengNian.禄, targetDiZhi: natalPalaces ? findStarInNatalPalaces(shengNian.禄, natalPalaces) : findStarPalaceFallback(shengNian.禄), type: '生年四化', sihuaType: '化禄' },
    { star: shengNian.权, targetDiZhi: natalPalaces ? findStarInNatalPalaces(shengNian.权, natalPalaces) : findStarPalaceFallback(shengNian.权), type: '生年四化', sihuaType: '化权' },
    { star: shengNian.科, targetDiZhi: natalPalaces ? findStarInNatalPalaces(shengNian.科, natalPalaces) : findStarPalaceFallback(shengNian.科), type: '生年四化', sihuaType: '化科' },
    { star: shengNian.忌, targetDiZhi: natalPalaces ? findStarInNatalPalaces(shengNian.忌, natalPalaces) : findStarPalaceFallback(shengNian.忌), type: '生年四化', sihuaType: '化忌' },
  )

  // 3. 太岁宫宫干四化落位（太岁入卦：太岁宫宫干之四化；宫干由五虎遁定）
  const dunGan = sihua.dunGan
  incomingStars.push(
    { star: dunGan.禄, targetDiZhi: natalPalaces ? findStarInNatalPalaces(dunGan.禄, natalPalaces) : findStarPalaceFallback(dunGan.禄), type: '太岁宫宫干四化', sihuaType: '化禄' },
    { star: dunGan.权, targetDiZhi: natalPalaces ? findStarInNatalPalaces(dunGan.权, natalPalaces) : findStarPalaceFallback(dunGan.权), type: '太岁宫宫干四化', sihuaType: '化权' },
    { star: dunGan.科, targetDiZhi: natalPalaces ? findStarInNatalPalaces(dunGan.科, natalPalaces) : findStarPalaceFallback(dunGan.科), type: '太岁宫宫干四化', sihuaType: '化科' },
    { star: dunGan.忌, targetDiZhi: natalPalaces ? findStarInNatalPalaces(dunGan.忌, natalPalaces) : findStarPalaceFallback(dunGan.忌), type: '太岁宫宫干四化', sihuaType: '化忌' },
  )

  // 4. 禄存 + 擎羊 + 陀罗（从 JSON 查表）
  const luCunData = tables.luCunYangTuo[partnerGan]
  if (luCunData) {
    const luCunZhi = luCunData.luCun as DiZhi
    const luCunIdx = DI_ZHI_ORDER.indexOf(luCunZhi)
    incomingStars.push(
      { star: '禄存', targetDiZhi: luCunZhi, type: '禄存' },
      { star: '擎羊', targetDiZhi: DI_ZHI_ORDER[(luCunIdx + 1) % 12], type: '擎羊' },
      { star: '陀罗', targetDiZhi: DI_ZHI_ORDER[(luCunIdx - 1 + 12) % 12], type: '陀罗' },
    )
  }

  // 5. 天魁 + 天钺（从 JSON 查表）
  const kuiYueData = tables.tianKuiYue[partnerGan]
  if (kuiYueData) {
    incomingStars.push(
      { star: '天魁', targetDiZhi: kuiYueData.tianKui as DiZhi, type: '天魁' },
      { star: '天钺', targetDiZhi: kuiYueData.tianYue as DiZhi, type: '天钺' },
    )
  }

  // 6. 红鸾 + 天喜（从 JSON 查表）
  const luanXiData = tables.hongLuanTianXi[partnerZhi]
  if (luanXiData) {
    incomingStars.push(
      { star: '红鸾', targetDiZhi: luanXiData.hongLuan as DiZhi, type: '红鸾' },
      { star: '天喜', targetDiZhi: luanXiData.tianXi as DiZhi, type: '天喜' },
    )
  }

  return {
    gan: partnerGan,
    zhi: partnerZhi,
    virtualMingGong: partnerZhi,
    virtualPalaces: buildVirtualPalaces(partnerZhi),
    incomingStars,
    sihua: { shengNian, dunGan },
  }
}

/**
 * 按目标地支分组入卦星曜
 *
 * @param chart 虚拟命盘
 * @returns 地支 → 入卦星曜列表
 */
export function groupIncomingByTarget(chart: VirtualChart): Record<DiZhi, IncomingStar[]> {
  const result: Record<string, IncomingStar[]> = {}
  for (const zhi of DI_ZHI_ORDER) {
    result[zhi] = []
  }
  for (const star of chart.incomingStars) {
    result[star.targetDiZhi].push(star)
  }
  return result as Record<DiZhi, IncomingStar[]>
}
