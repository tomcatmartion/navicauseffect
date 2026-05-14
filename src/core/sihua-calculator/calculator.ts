/**
 * M1: 四化计算器 — 计算逻辑
 *
 * **称谓（斗数习惯）**
 * - **太岁入卦**：入卦层所用为**太岁宫的宫干四化**（太岁宫=生年地支宫，取该宫宫干再论四化）。`MergedSihua.dunGan` / `SihuaEntry.source === '太岁宫宫干四化'` 对应此义。
 * - **遁干四化**：指由**五虎遁**得到的**天干**再论四化；锚定在「遁干之法」。太岁宫宫干即五虎遁在太岁宫地支上定出之干，故**与遁干所指之干常为同一干**；但**太岁入卦≠遁干四化**——前者以太岁宫立名，后者以五虎遁立名。
 *
 * 职责：
 * 1. 读取生年四化（天干四化索引表）
 * 2. 读取太岁宫宫干四化（五虎遁求太岁宫宫干 + 天干四化表；与 SKILL_宫位原生能级评估「查五虎遁表得遁干，再查遁干四化」一致）
 * 3. 合并两套四化，检测特殊叠加
 *
 * 来源：SKILL_原局四化读取规则 V1.0
 */

import type { TianGan, DiZhi, SihuaMap, MergedSihua, SihuaOverlap, SihuaEntry } from '../types'
import { getSihuaTable, getDunGan } from './tables'

/**
 * 获取生年四化
 *
 * @param birthGan 出生年天干
 * @returns 四化映射（禄权科忌各一颗星）
 *
 * @example
 * getShengNianSihua('壬')
 * // → { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' }
 */
export function getShengNianSihua(birthGan: TianGan): SihuaMap {
  return getSihuaTable()[birthGan]
}

/**
 * 获取太岁宫宫干四化（本命盘太岁宫之宫干，五虎遁定干 → 天干四化表）
 *
 * 步骤：
 * 1. 以生年干查五虎遁，得太岁宫地支所在行之宫干
 * 2. 以该宫干查天干四化表
 *
 * @param birthGan 生年天干
 * @param taiSuiZhi 太岁宫地支
 * @returns 四化映射
 *
 * @example
 * // 壬戌年生，太岁宫在戌 → 宫干庚 → 庚干四化
 * getDunGanSihua('壬', '戌')
 * // → { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' }
 */
export function getDunGanSihua(birthGan: TianGan, taiSuiZhi: DiZhi): SihuaMap {
  const dunGan = getDunGan(birthGan, taiSuiZhi)
  return getSihuaTable()[dunGan]
}

/**
 * 合并两套四化，检测特殊叠加
 *
 * 特殊叠加类型：
 * - 双忌叠压：同一颗星同时被生年忌 + 太岁宫宫干忌化
 * - 权忌交冲：同一颗星同时被权化 + 忌化（不论来源）
 * - 禄忌同星：同一颗星同时被禄化 + 忌化
 * - 双禄叠加：同一颗星被禄化两次
 *
 * @param shengNian 生年四化
 * @param dunGan 太岁宫宫干四化（禄权科忌映射）
 * @returns 合并结果（含特殊叠加检测）
 */
export function mergeWithOverlap(shengNian: SihuaMap, dunGan: SihuaMap): MergedSihua {
  const overlaps: SihuaOverlap[] = []

  // 收集所有四化条目
  const entries: SihuaEntry[] = [
    { type: '化禄', star: shengNian.禄, source: '生年' },
    { type: '化权', star: shengNian.权, source: '生年' },
    { type: '化科', star: shengNian.科, source: '生年' },
    { type: '化忌', star: shengNian.忌, source: '生年' },
    { type: '化禄', star: dunGan.禄, source: '太岁宫宫干四化' },
    { type: '化权', star: dunGan.权, source: '太岁宫宫干四化' },
    { type: '化科', star: dunGan.科, source: '太岁宫宫干四化' },
    { type: '化忌', star: dunGan.忌, source: '太岁宫宫干四化' },
  ]

  // 检测双忌叠压：生年忌 === 太岁宫宫干忌
  if (shengNian.忌 === dunGan.忌) {
    overlaps.push({ type: '双忌叠压', star: shengNian.忌 })
  }

  // 收集所有受化的星（去重）
  const allStars = new Set([
    shengNian.禄, shengNian.权, shengNian.科, shengNian.忌,
    dunGan.禄, dunGan.权, dunGan.科, dunGan.忌,
  ])

  for (const star of allStars) {
    // 该星收到的所有四化类型
    const types = new Set<string>()
    for (const entry of entries) {
      if (entry.star === star) {
        types.add(entry.type)
      }
    }

    // 权忌交冲：同一颗星同时被权化＋忌化（不论来自哪套）
    if (types.has('化权') && types.has('化忌')) {
      overlaps.push({ type: '权忌交冲', star })
    }

    // 禄忌同星
    if (types.has('化禄') && types.has('化忌')) {
      overlaps.push({ type: '禄忌同星', star })
    }

    // 双禄叠加
    if (star === shengNian.禄 && star === dunGan.禄) {
      overlaps.push({ type: '双禄叠加', star })
    }
  }

  return {
    shengNian,
    dunGan,
    entries,
    specialOverlaps: overlaps,
    palaceAnnotations: [], // 由 applyPalaceAnnotations() 填充
  }
}

/**
 * 完整计算原局四化（一步调用）
 *
 * @param birthGan 生年天干
 * @param taiSuiZhi 太岁宫地支
 * @returns 合并后的原局四化
 *
 * @example
 * // 壬戌年命主完整示例
 * const result = calculateOriginalSihua('壬', '戌')
 * // result.shengNian: { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' }
 * // result.dunGan: { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' }
 * // result.specialOverlaps: [{ type: '权忌交冲', star: '武曲' }]（武曲：生年忌+太岁宫宫干权）
 */
export function calculateOriginalSihua(birthGan: TianGan, taiSuiZhi: DiZhi): MergedSihua {
  const shengNian = getShengNianSihua(birthGan)
  const dunGan = getDunGanSihua(birthGan, taiSuiZhi)
  return mergeWithOverlap(shengNian, dunGan)
}
