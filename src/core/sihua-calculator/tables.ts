/**
 * M1: 四化计算器 — 查表数据
 *
 * 包含天干四化索引表和五虎遁检索表。
 * 数据来源：data/tai_sui_rua_gua_tables.json（支持热加载）
 */

import type { TianGan, DiZhi, MajorStar, AuspiciousStar } from '../types'
import { getTaiSuiTables } from '../knowledge-dict/loader'

// ═══════════════════════════════════════════════════════════════════
// 天干四化索引表
// ═══════════════════════════════════════════════════════════════════

export interface SihuaMapping {
  禄: MajorStar | AuspiciousStar
  权: MajorStar | AuspiciousStar
  科: MajorStar | AuspiciousStar
  忌: MajorStar | AuspiciousStar
}

/**
 * 获取天干四化映射
 */
export function getSihuaTable(): Record<TianGan, SihuaMapping> {
  const tables = getTaiSuiTables()
  const result: Record<string, SihuaMapping> = {}
  for (const [gan, mapping] of Object.entries(tables.shengNianSihua)) {
    result[gan] = {
      禄: mapping.lu as MajorStar | AuspiciousStar,
      权: mapping.quan as MajorStar | AuspiciousStar,
      科: mapping.ke as MajorStar | AuspiciousStar,
      忌: mapping.ji as MajorStar | AuspiciousStar,
    }
  }
  return result as Record<TianGan, SihuaMapping>
}

// ═══════════════════════════════════════════════════════════════════
// 五虎遁检索表
// ═══════════════════════════════════════════════════════════════════

/**
 * 五虎遁分组：按生年干分为5组
 * - 甲/己年起丙
 * - 乙/庚年起戊
 * - 丙/辛年起庚
 * - 丁/壬年起壬
 * - 戊/癸年起甲
 */
export type WuHuDunGroup = '甲己' | '乙庚' | '丙辛' | '丁壬' | '戊癸'

/** 从天干获取五虎遁分组 */
export function getWuHuDunGroup(gan: TianGan): WuHuDunGroup {
  const groupMap: Record<TianGan, WuHuDunGroup> = {
    '甲': '甲己', '己': '甲己',
    '乙': '乙庚', '庚': '乙庚',
    '丙': '丙辛', '辛': '丙辛',
    '丁': '丁壬', '壬': '丁壬',
    '戊': '戊癸', '癸': '戊癸',
  }
  return groupMap[gan]
}

/**
 * 获取五虎遁检索表
 */
export function getWuHuDunTable(): Record<WuHuDunGroup, Record<DiZhi, TianGan>> {
  const tables = getTaiSuiTables()
  const result: Record<string, Record<string, string>> = {}

  for (const [gan, dunGanList] of Object.entries(tables.wuHuDunGan)) {
    const group = getWuHuDunGroup(gan as TianGan)
    if (!result[group]) {
      result[group] = {}
    }
    const diZhiOrder: DiZhi[] = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
    for (let i = 0; i < 12; i++) {
      const zhi = diZhiOrder[i]
      const ganZhi = dunGanList[i]
      if (ganZhi && ganZhi.length === 2) {
        result[group][zhi] = ganZhi[0]
      }
    }
  }

  return result as Record<WuHuDunGroup, Record<DiZhi, TianGan>>
}

/**
 * 从生年天干和太岁宫地支，查得太岁宫宫干（五虎遁）
 *
 * @param birthGan 生年天干
 * @param taiSuiZhi 太岁宫地支
 * @returns 太岁宫宫干（天干）
 */
export function getDunGan(birthGan: TianGan, taiSuiZhi: DiZhi): TianGan {
  const group = getWuHuDunGroup(birthGan)
  const table = getWuHuDunTable()
  return table[group][taiSuiZhi]
}
