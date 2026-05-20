/**
 * P1: 评分原因 → 性格维度映射
 *
 * 将 palaceScores 的 bonusDetails / penaltyDetails / subdueLevel
 * 映射为性格维度描述，解释"为什么这个分数"对应"什么性格"。
 */

import type { PalaceScore, BonusDetails, PenaltyDetails, SubdueLevel } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

/** 评分原因性格映射结果 */
export interface ScoreReasonPersonality {
  /** 评分维度 */
  dimension: string
  /** 具体评分项 */
  item: string
  /** 得分 */
  score: number
  /** 性格解读 */
  personalityInterpretation: string
  /** 影响层级 */
  impactLevel: '强' | '中' | '弱'
}

/** 宫位评分性格画像 */
export interface PalaceScorePersonalityProfile {
  /** 宫位名称 */
  palace: string
  /** 最终得分 */
  finalScore: number
  /** 加分原因性格映射 */
  bonusReasons: ScoreReasonPersonality[]
  /** 减分原因性格映射 */
  penaltyReasons: ScoreReasonPersonality[]
  /** 制煞能力性格映射 */
  subduePersonality: string
  /** 综合性格结论 */
  synthesis: string
}

// ═══════════════════════════════════════════════════════════════════
// BonusDetails → 性格映射表
// ═══════════════════════════════════════════════════════════════════

const BONUS_PERSONALITY_MAP: Record<keyof BonusDetails, (score: number) => ScoreReasonPersonality> = {
  '2.1_三方四正吉星': (score) => ({
    dimension: '人际与助力',
    item: '三方四正吉星加持',
    score,
    personalityInterpretation: score > 1.5
      ? '善于借力，人缘极佳，贵人运强，在团队中容易获得支持'
      : score > 0.8
        ? '人缘不错，能得到一定程度的助力'
        : '人际助力一般，更多需要靠自己',
    impactLevel: score > 1.5 ? '强' : score > 0.8 ? '中' : '弱',
  }),
  '2.2_命主生年化禄': (score) => ({
    dimension: '圆融与亲和力',
    item: '命主生年化禄',
    score,
    personalityInterpretation: score > 1.0
      ? '天生圆融随和，亲和力强，对人有天然的吸引力，处事通达'
      : '有一定的圆融特质，但不如强旺者明显',
    impactLevel: score > 1.0 ? '强' : '中',
  }),
  '2.3_命主遁干化禄': (score) => ({
    dimension: '隐性圆融',
    item: '命主遁干化禄',
    score,
    personalityInterpretation: score > 0.5
      ? '内在有圆融通达的一面，在熟悉环境中更能展现亲和力'
      : '隐性圆融特质较弱',
    impactLevel: score > 0.5 ? '中' : '弱',
  }),
  '2.4_父亲生年化禄': (score) => ({
    dimension: '家庭影响·外在圆融',
    item: '父亲生年化禄',
    score,
    personalityInterpretation: score > 0.5
      ? '受父亲影响，外在表现较为圆融，重视人际关系'
      : '父亲影响下的圆融特质不明显',
    impactLevel: score > 0.5 ? '中' : '弱',
  }),
  '2.5_父亲遁干化禄': (score) => ({
    dimension: '家庭影响·隐性圆融',
    item: '父亲遁干化禄',
    score,
    personalityInterpretation: '父亲方面的隐性影响，对性格塑造作用较间接',
    impactLevel: score > 0.3 ? '中' : '弱',
  }),
  '2.6_母亲生年化禄': (score) => ({
    dimension: '家庭影响·内在圆融',
    item: '母亲生年化禄',
    score,
    personalityInterpretation: score > 0.5
      ? '受母亲影响，内在情感丰富，对亲密关系较为圆融'
      : '母亲影响下的圆融特质不明显',
    impactLevel: score > 0.5 ? '中' : '弱',
  }),
  '2.7_母亲遁干化禄': (score) => ({
    dimension: '家庭影响·隐性内在',
    item: '母亲遁干化禄',
    score,
    personalityInterpretation: '母亲方面的隐性影响，对内在情感塑造较间接',
    impactLevel: score > 0.3 ? '中' : '弱',
  }),
  '2.8_吉格倍率': (score) => ({
    dimension: '格局底色',
    item: '吉格倍率',
    score,
    personalityInterpretation: score > 1.3
      ? '格局优良，天生具备正面性格底色，行事顺遂'
      : score > 1.1
        ? '格局尚可，有一定正面助力'
        : '格局影响中性',
    impactLevel: score > 1.3 ? '强' : score > 1.1 ? '中' : '弱',
  }),
}

// ═══════════════════════════════════════════════════════════════════
// PenaltyDetails → 性格映射表
// ═══════════════════════════════════════════════════════════════════

const PENALTY_PERSONALITY_MAP: Record<keyof PenaltyDetails, (score: number) => ScoreReasonPersonality> = {
  '4.1_三方四正煞星': (score) => ({
    dimension: '抗压与挑战',
    item: '三方四正煞星影响',
    score,
    personalityInterpretation: Math.abs(score) > 1.5
      ? '性格中带有磨砺特质，抗压能力强但易有波折，行事需格外谨慎'
      : Math.abs(score) > 0.8
        ? '有一定挑战特质，遇到困难能咬牙坚持'
        : '煞星影响轻微，性格较为平顺',
    impactLevel: Math.abs(score) > 1.5 ? '强' : Math.abs(score) > 0.8 ? '中' : '弱',
  }),
  '4.2_命主生年化忌': (score) => ({
    dimension: '执念与纠结',
    item: '命主生年化忌',
    score,
    personalityInterpretation: Math.abs(score) > 1.0
      ? '执念深，自我要求高，容易纠结，对在意的事情难以放手'
      : '有一定执着倾向，但不如强旺者明显',
    impactLevel: Math.abs(score) > 1.0 ? '强' : '中',
  }),
  '4.3_命主遁干化忌': (score) => ({
    dimension: '隐性执念',
    item: '命主遁干化忌',
    score,
    personalityInterpretation: Math.abs(score) > 0.5
      ? '内在有隐性执念，在特定情境下会表现出纠结'
      : '隐性执念特质较弱',
    impactLevel: Math.abs(score) > 0.5 ? '中' : '弱',
  }),
  '4.4_父亲生年化忌': (score) => ({
    dimension: '家庭影响·外在压力',
    item: '父亲生年化忌',
    score,
    personalityInterpretation: Math.abs(score) > 0.5
      ? '受父亲影响，外在表现可能有压力感，对权威关系敏感'
      : '父亲影响下的压力特质不明显',
    impactLevel: Math.abs(score) > 0.5 ? '中' : '弱',
  }),
  '4.5_父亲遁干化忌': (score) => ({
    dimension: '家庭影响·隐性压力',
    item: '父亲遁干化忌',
    score,
    personalityInterpretation: '父亲方面的隐性影响，对性格塑造作用较间接',
    impactLevel: Math.abs(score) > 0.3 ? '中' : '弱',
  }),
  '4.6_母亲生年化忌': (score) => ({
    dimension: '家庭影响·内在压力',
    item: '母亲生年化忌',
    score,
    personalityInterpretation: Math.abs(score) > 0.5
      ? '受母亲影响，内在情感可能有压抑感，对亲密关系要求高'
      : '母亲影响下的压力特质不明显',
    impactLevel: Math.abs(score) > 0.5 ? '中' : '弱',
  }),
  '4.7_母亲遁干化忌': (score) => ({
    dimension: '家庭影响·隐性内在压力',
    item: '母亲遁干化忌',
    score,
    personalityInterpretation: '母亲方面的隐性影响，对内在情感塑造较间接',
    impactLevel: Math.abs(score) > 0.3 ? '中' : '弱',
  }),
  '4.8_凶格倍率': (score) => ({
    dimension: '格局挑战',
    item: '凶格倍率',
    score,
    personalityInterpretation: Math.abs(score) > 0.3
      ? '格局带有挑战性质，性格中需面对特定考验'
      : '格局挑战轻微',
    impactLevel: Math.abs(score) > 0.3 ? '中' : '弱',
  }),
}

// ═══════════════════════════════════════════════════════════════════
// 制煞能力 → 性格映射
// ═══════════════════════════════════════════════════════════════════

const SUBDUE_PERSONALITY_MAP: Record<SubdueLevel, string> = {
  '强制煞': '制煞能力强，面对逆境能主动化解，抗压能力突出，困难面前越战越勇',
  '中制煞': '制煞能力中等，能应对一般挑战，但面对重大压力需借助外力',
  '弱制煞': '制煞能力较弱，面对压力容易退缩，需要培养抗压能力',
  '无': '无制煞能力，面对挑战较为被动，建议避免高风险决策',
}

// ═══════════════════════════════════════════════════════════════════
// 核心函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 将单个宫位的评分原因映射为性格维度
 */
export function mapPalaceScoreToPersonality(palaceScore: PalaceScore): PalaceScorePersonalityProfile {
  const bonusReasons: ScoreReasonPersonality[] = []
  const penaltyReasons: ScoreReasonPersonality[] = []

  // 映射加分原因
  for (const [key, mapper] of Object.entries(BONUS_PERSONALITY_MAP)) {
    const score = palaceScore.bonusDetails[key as keyof BonusDetails] ?? 0
    if (score > 0) {
      bonusReasons.push(mapper(score))
    }
  }

  // 映射减分原因
  for (const [key, mapper] of Object.entries(PENALTY_PERSONALITY_MAP)) {
    const score = palaceScore.penaltyDetails[key as keyof PenaltyDetails] ?? 0
    if (score < 0) {
      penaltyReasons.push(mapper(score))
    }
  }

  // 制煞能力
  const subduePersonality = SUBDUE_PERSONALITY_MAP[palaceScore.subdueLevel]

  // 综合结论
  const synthesis = generateSynthesis(palaceScore, bonusReasons, penaltyReasons)

  return {
    palace: palaceScore.palace,
    finalScore: palaceScore.finalScore,
    bonusReasons,
    penaltyReasons,
    subduePersonality,
    synthesis,
  }
}

/**
 * 生成综合性格结论
 */
function generateSynthesis(
  palaceScore: PalaceScore,
  bonusReasons: ScoreReasonPersonality[],
  penaltyReasons: ScoreReasonPersonality[],
): string {
  const parts: string[] = []

  // 基于最终得分定性
  if (palaceScore.finalScore >= 7) {
    parts.push('宫位强旺')
  } else if (palaceScore.finalScore >= 5) {
    parts.push('宫位中等')
  } else if (palaceScore.finalScore >= 3) {
    parts.push('宫位虚浮')
  } else {
    parts.push('宫位凶危')
  }

  // 主要加分原因
  const strongBonuses = bonusReasons.filter(r => r.impactLevel === '强')
  if (strongBonuses.length > 0) {
    parts.push(`主要优势：${strongBonuses.map(r => r.personalityInterpretation).join('；')}`)
  }

  // 主要减分原因
  const strongPenalties = penaltyReasons.filter(r => r.impactLevel === '强')
  if (strongPenalties.length > 0) {
    parts.push(`主要挑战：${strongPenalties.map(r => r.personalityInterpretation).join('；')}`)
  }

  // 制煞能力
  parts.push(palaceScore.subdueLevel === '强制煞'
    ? '制煞能力强，逆境中能主动化解'
    : palaceScore.subdueLevel === '中制煞'
      ? '制煞能力中等，能应对一般挑战'
      : palaceScore.subdueLevel === '弱制煞'
        ? '制煞能力较弱，需注意压力管理'
        : '无制煞能力，避免高风险决策')

  return parts.join('。')
}

/**
 * 批量映射多个宫位的评分性格
 */
export function mapAllPalaceScoresToPersonality(
  palaceScores: PalaceScore[],
): PalaceScorePersonalityProfile[] {
  return palaceScores.map(mapPalaceScoreToPersonality)
}

/**
 * 提取关键性格维度（用于前端展示）
 */
export function extractKeyPersonalityDimensions(
  profiles: PalaceScorePersonalityProfile[],
): {
  strengths: string[]
  challenges: string[]
 抗压能力: string
 人际风格: string
} {
  const allBonuses = profiles.flatMap(p => p.bonusReasons)
  const allPenalties = profiles.flatMap(p => p.penaltyReasons)

  // 按影响强度排序
  const sortedBonuses = allBonuses
    .filter(b => b.impactLevel === '强')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const sortedPenalties = allPenalties
    .filter(p => p.impactLevel === '强')
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 3)

  // 制煞能力（取命宫）
  const mingProfile = profiles.find(p => p.palace === '命宫')
  const 抗压能力 = mingProfile?.subduePersonality ?? '制煞能力需具体分析'

  // 人际风格（从三方四正吉星加分推断）
  const interpersonalBonus = allBonuses.find(b => b.item === '三方四正吉星加持')
  const 人际风格 = interpersonalBonus
    ? interpersonalBonus.score > 1.5
      ? '人缘极佳，善于借力'
      : interpersonalBonus.score > 0.8
        ? '人缘不错，能得到助力'
        : '人际助力一般，更多靠自己'
    : '人际风格需结合具体星曜分析'

  return {
    strengths: sortedBonuses.map(b => b.personalityInterpretation),
    challenges: sortedPenalties.map(p => p.personalityInterpretation),
    抗压能力,
    人际风格,
  }
}
