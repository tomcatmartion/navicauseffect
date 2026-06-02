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
import { PALACE_NAMES, PALACE_NAME_TO_INDEX } from '@/core/types'
import {
  generateFourDimensionTags,
  generateHolographicBase,
  judgeThreePalaceTone,
  analyzeThreePalaceCrossTension,
} from '@/core/personality-analyzer/four-dimension'
import {
  extractPatternPersonalityInfluences,
  aggregatePatternTraits,
} from '@/core/personality-analyzer/pattern-to-personality'
import {
  mapPalaceScoreToPersonality,
  mapAllPalaceScoresToPersonality,
  extractKeyPersonalityDimensions,
} from '@/core/personality-analyzer/score-reason-to-personality'
import { buildPalaceInput } from './helpers/palace-input-builder'
import { injectStage2Knowledge } from './helpers/knowledge-injector'
import { buildPersonalityTriadProfile } from '@/core/personality-analyzer/triad-builder'

/**
 * 执行阶段二：性格定性
 */
export function executeStage2(input: Stage2Input): Stage2Output {
  const { stage1, question } = input
  const { scoringCtx, palaceScores } = stage1
  const ctx = scoringCtx

  // 1. 确定三宫索引
  const mingIdx = PALACE_NAME_TO_INDEX['命宫'] // 动态查找，避免硬编码
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

  // ═══════════════════════════════════════════════════════════════════
  // P0: 格局人格特质注入
  // ═══════════════════════════════════════════════════════════════════
  const patternInfluences = extractPatternPersonalityInfluences(stage1.allPatterns)
  const aggregatedTraits = aggregatePatternTraits(patternInfluences)

  // ═══════════════════════════════════════════════════════════════════
  // P1: 评分原因 → 性格维度映射
  // ═══════════════════════════════════════════════════════════════════
  const mingPalaceScore = palaceScores[mingIdx]
  const mingProfile = mingPalaceScore ? mapPalaceScoreToPersonality(mingPalaceScore) : null
  const allProfiles = mapAllPalaceScoresToPersonality(palaceScores)
  const keyDimensions = extractKeyPersonalityDimensions(allProfiles)

  // ═══════════════════════════════════════════════════════════════════
  // P2: 三宫交叉张力分析
  // ═══════════════════════════════════════════════════════════════════
  const personalityTriad = buildPersonalityTriadProfile({
    ctx,
    palaceScores,
    mingIdx,
    shenIdx,
    taiSuiIdx: taiSuiIdx >= 0 ? taiSuiIdx : 0,
  })

  const knowledgeSnippetsWithTriad = [
    ...knowledgeSnippets,
    {
      source: '性格三宫' as const,
      key: '性格三宫基准',
      content: [
        `命宫：${personalityTriad.mingLayer.description}`,
        `身宫：${personalityTriad.shenLayer.description}`,
        `太岁宫：${personalityTriad.taiSuiLayer.description}`,
        personalityTriad.synthesis,
      ].join('\n'),
    },
  ]

  const threePalaceCross = analyzeThreePalaceCrossTension({
    mingScore: palaceScores[mingIdx]?.finalScore ?? 5,
    mingStars: ctx.palaces[mingIdx].majorStars.map(ms => ({ star: String(ms.star), brightness: ms.brightness })),
    mingSihua: ctx.palaces[mingIdx].stars.filter(s => s.sihua).map(s => ({ star: s.name, type: s.sihua! })),
    shenScore: palaceScores[shenIdx]?.finalScore ?? 5,
    shenStars: ctx.palaces[shenIdx].majorStars.map(ms => ({ star: String(ms.star), brightness: ms.brightness })),
    shenSihua: ctx.palaces[shenIdx].stars.filter(s => s.sihua).map(s => ({ star: s.name, type: s.sihua! })),
    taiSuiScore: taiSuiIdx >= 0 ? palaceScores[taiSuiIdx]?.finalScore ?? 5 : 5,
    taiSuiStars: taiSuiIdx >= 0 ? ctx.palaces[taiSuiIdx].majorStars.map(ms => ({ star: String(ms.star), brightness: ms.brightness })) : [],
    taiSuiSihua: taiSuiIdx >= 0 ? ctx.palaces[taiSuiIdx].stars.filter(s => s.sihua).map(s => ({ star: s.name, type: s.sihua! })) : [],
  })

  return {
    mingGongTags,
    shenGongTags,
    taiSuiTags,
    overallTone,
    mingGongHolographic,
    knowledgeSnippets: knowledgeSnippetsWithTriad,
    personalityTriad,
    shenGongIndex: shenIdx,
    taiSuiIndex: taiSuiIdx >= 0 ? taiSuiIdx : 0,
    patternPersonality: {
      influences: patternInfluences.map(inf => ({
        patternName: inf.patternName,
        level: inf.level,
        traits: inf.traits.map(t => ({ keyword: t.keyword, dimension: t.dimension, intensity: t.intensity })),
        personalityBase: inf.personalityBase,
        behavioralTendency: inf.behavioralTendency,
        interpersonalStyle: inf.interpersonalStyle,
        stressResponse: inf.stressResponse,
      })),
      aggregated: aggregatedTraits,
    },
    scoreReasonPersonality: mingProfile ? {
      mingProfile: {
        palace: mingProfile.palace,
        finalScore: mingProfile.finalScore,
        bonusReasons: mingProfile.bonusReasons.map(r => ({
          dimension: r.dimension,
          item: r.item,
          personalityInterpretation: r.personalityInterpretation,
          impactLevel: r.impactLevel,
        })),
        penaltyReasons: mingProfile.penaltyReasons.map(r => ({
          dimension: r.dimension,
          item: r.item,
          personalityInterpretation: r.personalityInterpretation,
          impactLevel: r.impactLevel,
        })),
        subduePersonality: mingProfile.subduePersonality,
        synthesis: mingProfile.synthesis,
      },
      keyDimensions,
    } : undefined,
    threePalaceCross,
  }
}

/** 从上下文获取身宫索引 */
function findShenGongFromCtx(ctx: Stage2Input['stage1']['scoringCtx']): number {
  // 使用 chart-converter 中通过 iztro isBodyPalace 标记计算的索引
  return ctx.shenGongIndex ?? 6
}
