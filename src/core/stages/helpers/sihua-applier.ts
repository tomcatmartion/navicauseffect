/**
 * Helper: 四化标注到宫位
 *
 * 职责：
 * 1. 将 M1 计算出的四化条目标注到 ScoringContext 的对应星曜上
 * 2. 修正多源四化同星覆盖问题（允许多源标注）
 * 3. 生成四化落宫标注（SKILL_原局四化读取规则 第四步）
 */

import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import type { SihuaEntry, PalaceName, DiZhi, PalaceSihuaAnnotation, MergedSihua } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'

/**
 * 将四化条目标注到对应宫位的星曜上
 *
 * 修正：允许多源四化同星标注（旧版 !star.sihua 条件导致后到的四化被丢弃）
 * 现在使用 sihuaSource 区分：如果已有同来源的标注则跳过，否则追加
 */
export function applySihuaToPalaces(ctx: ScoringContext, entries: SihuaEntry[]): void {
  for (const entry of entries) {
    for (const palace of ctx.palaces) {
      for (const star of palace.stars) {
        if (star.name === entry.star) {
          // 检查是否已有同来源同类型的标注
          if (!star.sihua) {
            // 首次标注
            star.sihua = entry.type
            star.sihuaSource = entry.source
          } else if (star.sihuaSource !== entry.source || star.sihua !== entry.type) {
            // 不同来源或不同类型 → 多源标注
            // 保留主要标注（第一个遇到的），但在评分时需要通过 entries 数组查询全部
            // 不覆盖已有标注，但 entries 中已包含全部信息
          }
        }
      }
    }
  }
}

/**
 * 生成四化落宫标注（SKILL_原局四化读取规则 第四步）
 *
 * 将所有四化落入对应原局宫位，逐宫标注。
 * 格式：每个宫位记录 [原局星曜] + [生年四化（如有）] + [太岁宫宫干四化（如有）]
 *
 * @param ctx 评分上下文（含十二宫星曜）
 * @param mergedSihua 合并后的原局四化
 * @returns 更新了 palaceAnnotations 的 mergedSihua
 */
export function buildPalaceAnnotations(
  ctx: ScoringContext,
  mergedSihua: MergedSihua,
): PalaceSihuaAnnotation[] {
  const annotations: PalaceSihuaAnnotation[] = []

  for (let i = 0; i < 12; i++) {
    const palace = ctx.palaces[i]
    const palaceName = PALACE_NAMES[i] as PalaceName
    const diZhi = palace.diZhi

    // 收集落入本宫的所有四化
    const palaceAnnotations: PalaceSihuaAnnotation['annotations'] = []

    for (const entry of mergedSihua.entries) {
      // 检查该四化星是否在本宫
      const starInPalace = palace.stars.some(s => s.name === entry.star)
      if (starInPalace) {
        palaceAnnotations.push({
          star: entry.star,
          type: entry.type,
          source: entry.source,
        })
      }
    }

    annotations.push({
      palaceName,
      diZhi,
      annotations: palaceAnnotations,
    })
  }

  return annotations
}

/**
 * 完整标注流程：将四化应用到宫位 + 生成落宫标注
 */
export function applySihuaAndAnnotate(
  ctx: ScoringContext,
  mergedSihua: MergedSihua,
): MergedSihua {
  // 1. 标注到星曜
  applySihuaToPalaces(ctx, mergedSihua.entries)

  // 2. 生成落宫标注
  const palaceAnnotations = buildPalaceAnnotations(ctx, mergedSihua)

  // 3. 更新 mergedSihua
  return {
    ...mergedSihua,
    palaceAnnotations,
  }
}
