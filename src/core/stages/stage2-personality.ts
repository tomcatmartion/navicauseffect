/**
 * Stage 2: 性格定性 + 事项问诊
 *
 * P2 阶段：三宫四维合参 → 命宫全息底色 → 知识注入
 *
 * 数据流：
 * Stage1Output + question
 *   → 提取命宫/身宫/太岁宫评分
 *   → generateFourDimensionTags × 3
 *   → judgeThreePalaceTone → overallTone
 *   → generateHolographicBase
 *   → injectStage2Knowledge
 *   → Stage2Output
 *
 * 模块调用：M4(性格计算) + M6(知识注入)
 * LLM 不参与本阶段任何逻辑判断。
 */

import type { Stage2Input, Stage2Output, PalaceName } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import {
  generateFourDimensionTags,
  generateHolographicBase,
  judgeThreePalaceTone,
} from '@/core/personality-analyzer/four-dimension'
import { buildPalaceInput } from './helpers/palace-input-builder'
import { injectStage2Knowledge } from './helpers/knowledge-injector'

/**
 * 执行阶段二：性格定性
 */
export function executeStage2(input: Stage2Input): Stage2Output {
  const { stage1, question } = input
  const { scoringCtx, palaceScores } = stage1
  const ctx = scoringCtx

  // 1. 确定三宫索引
  const mingIdx = 0 // 命宫始终在索引 0
  const shenIdx = findShenGongFromCtx(ctx)
  // 太岁宫 = 生年地支对应的宫位（独立于命宫位置）
  // SKILL_宫位原生能级评估："命主生年地支 = 太岁宫"
  const taiSuiIdxCandidate = ctx.palaces.findIndex(p => p.diZhi === ctx.taiSuiZhi)
  const taiSuiIdx = taiSuiIdxCandidate >= 0 ? taiSuiIdxCandidate : 0

  // 2. 命宫四维合参
  const mingGongTags = generateFourDimensionTags(
    buildPalaceInput(ctx, palaceScores, mingIdx, '命宫'),
  )

  // 3. 身宫四维合参
  const shenGongName = (PALACE_NAMES[shenIdx] ?? '迁移') as PalaceName
  const shenGongTags = generateFourDimensionTags(
    buildPalaceInput(ctx, palaceScores, shenIdx, shenGongName),
  )

  // 4. 太岁宫四维合参
  const taiSuiName = taiSuiIdx >= 0
    ? (PALACE_NAMES[taiSuiIdx] ?? '父母') as PalaceName
    : '父母' as PalaceName
  const taiSuiTags = taiSuiIdx >= 0
    ? generateFourDimensionTags(buildPalaceInput(ctx, palaceScores, taiSuiIdx, taiSuiName))
    : {
        palace: '父母' as PalaceName,
        diZhi: ctx.taiSuiZhi,
        selfTags: [],
        oppositeTags: [],
        trineTags: [],
        flankingTags: [],
        summary: '暂无数据',
      }

  // 5. 三宫基调判定
  const overallTone = judgeThreePalaceTone(
    palaceScores[mingIdx]?.finalScore ?? 5,
    palaceScores[shenIdx]?.finalScore ?? 5,
    taiSuiIdx >= 0 ? palaceScores[taiSuiIdx]?.finalScore ?? 5 : 5,
  )

  // 6. 命宫全息底色
  const mingGongHolographic = generateHolographicBase(
    buildPalaceInput(ctx, palaceScores, mingIdx, '命宫'),
  )

  // 7. 知识注入（M6）
  const focusPalaces = [
    { name: '命宫' as PalaceName, stars: ctx.palaces[mingIdx].majorStars.map(ms => ({ star: ms.star, brightness: ms.brightness })) },
    { name: shenGongName, stars: ctx.palaces[shenIdx].majorStars.map(ms => ({ star: ms.star, brightness: ms.brightness })) },
  ]
  if (taiSuiIdx >= 0) {
    focusPalaces.push({
      name: taiSuiName,
      stars: ctx.palaces[taiSuiIdx].majorStars.map(ms => ({ star: ms.star, brightness: ms.brightness })),
    })
  }
  const knowledgeSnippets = injectStage2Knowledge(focusPalaces)

  return {
    mingGongTags,
    shenGongTags,
    taiSuiTags,
    overallTone,
    mingGongHolographic,
    knowledgeSnippets,
  }
}

/** 从上下文获取身宫索引 */
function findShenGongFromCtx(ctx: Stage2Input['stage1']['scoringCtx']): number {
  // 使用 chart-converter 中通过 iztro isBodyPalace 标记计算的索引
  return ctx.shenGongIndex ?? 6
}
