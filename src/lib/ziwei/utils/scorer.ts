/**
 * 评分计算工具
 * 实现六步评分流程的各步骤计算
 */

import { PalaceStrength, type StarName, type SpatialRelation } from '../types';
import { STRENGTH_RANGE, getStarScore, isLuckyStar, isUnluckyStar } from '../types';
import { getBaseScore, getCeiling } from '../data/skeletonMapping';
import { getDecayFactor } from './spatial';

/**
 * 吉煞星评分记录
 */
export interface StarScoreRecord {
  star: StarName;
  baseScore: number;
  source: 'self' | 'opposite' | 'triad' | 'flank';
  decayFactor: number;
  finalScore: number;
}

/**
 * 宫位评分计算结果
 */
export interface PalaceScoreCalculation {
  baseScore: number;
  ceiling: number;
  luckyBonus: number;
  unluckyPenalty: number;
  lucunBonus: number;
  subtotal: number;
  finalScore: number;
  isConstrained: boolean;
  starScores: StarScoreRecord[];
}

/**
 * 第一步：获取骨架基础分
 */
export function getBaseScoreByStrength(strength: PalaceStrength): number {
  return STRENGTH_RANGE[strength].base;
}

/**
 * 第一步：获取天花板
 */
export function getCeilingByStrength(strength: PalaceStrength): number {
  return STRENGTH_RANGE[strength].max;
}

/**
 * 第二步：计算吉星加分
 */
export function calculateLuckyBonus(
  stars: { star: StarName; relation: SpatialRelation; sourceStrength: number }[],
  targetStrength: number
): {
  total: number;
  details: StarScoreRecord[];
} {
  const details: StarScoreRecord[] = [];
  let total = 0;

  for (const { star, relation, sourceStrength } of stars) {
    if (!isLuckyStar(star)) continue;

    const baseScore = getStarScore(star);
    if (baseScore <= 0) continue;

    const decayFactor = getDecayFactor(relation, sourceStrength, targetStrength);
    const finalScore = baseScore * decayFactor;

    details.push({
      star,
      baseScore,
      source: relation,
      decayFactor,
      finalScore,
    });

    total += finalScore;
  }

  return { total, details };
}

/**
 * 第三步：计算煞星减分
 */
export function calculateUnluckyPenalty(
  stars: { star: StarName; relation: SpatialRelation; sourceStrength: number }[],
  targetStrength: number
): {
  total: number;
  details: StarScoreRecord[];
} {
  const details: StarScoreRecord[] = [];
  let total = 0;

  for (const { star, relation, sourceStrength } of stars) {
    if (!isUnluckyStar(star)) continue;

    const baseScore = getStarScore(star);
    if (baseScore >= 0) continue;

    const decayFactor = getDecayFactor(relation, sourceStrength, targetStrength);
    const finalScore = baseScore * decayFactor;

    details.push({
      star,
      baseScore,
      source: relation,
      decayFactor,
      finalScore,
    });

    total += finalScore;
  }

  return { total, details };
}

/**
 * 第四步：计算禄存专项
 * 旺宫+0.3，平宫0，陷宫或空宫-0.3
 */
export function calculateLucunBonus(
  hasLucun: boolean,
  strength: PalaceStrength
): number {
  if (!hasLucun) return 0;

  switch (strength) {
    case PalaceStrength.ExtremelyStrong:
    case PalaceStrength.Strong:
      return 0.3;
    case PalaceStrength.Medium:
      return 0;
    case PalaceStrength.Weak:
    case PalaceStrength.ExtremelyWeak:
    case PalaceStrength.Empty:
      return -0.3;
    default:
      return 0;
  }
}

/**
 * 第五步：应用天花板约束
 * Final_Score = min(计算得分, 天花板)
 */
export function applyCeiling(score: number, ceiling: number): {
  finalScore: number;
  isConstrained: boolean;
} {
  const finalScore = Math.min(score, ceiling);
  return {
    finalScore,
    isConstrained: score > ceiling,
  };
}

/**
 * 完整六步评分流程
 */
export function calculatePalaceScore(params: {
  strength: PalaceStrength;
  selfStars: StarName[];
  oppositeStars: StarName[];
  triadStars: StarName[][];
  flankStars: StarName[];
  oppositeStrength?: number;
  triadStrengths?: number[];
  flankStrengths?: number[];
  hasLucun?: boolean;
}): PalaceScoreCalculation {
  const {
    strength,
    selfStars = [],
    oppositeStars = [],
    triadStars = [[], []],
    flankStars = [],
    oppositeStrength = 5,
    triadStrengths = [5, 5],
    flankStrengths = [5, 5],
    hasLucun = false,
  } = params;

  // 第一步：骨架基础分
  const baseScore = getBaseScoreByStrength(strength);
  const ceiling = getCeilingByStrength(strength);
  const targetScore = STRENGTH_RANGE[strength].base;

  // 收集所有星曜及其空间关系
  const allStars = [
    ...selfStars.map(star => ({ star, relation: 'self' as SpatialRelation, sourceStrength: targetScore })),
    ...oppositeStars.map(star => ({ star, relation: 'opposite' as SpatialRelation, sourceStrength: oppositeStrength })),
    ...triadStars[0].map(star => ({ star, relation: 'triad' as SpatialRelation, sourceStrength: triadStrengths[0] })),
    ...triadStars[1].map(star => ({ star, relation: 'triad' as SpatialRelation, sourceStrength: triadStrengths[1] })),
    ...flankStars.map(star => ({ star, relation: 'flank' as SpatialRelation, sourceStrength: flankStrengths[0] || 5 })),
  ];

  // 第二步：吉星加分
  const luckyResult = calculateLuckyBonus(allStars, targetScore);

  // 第三步：煞星减分
  const unluckyResult = calculateUnluckyPenalty(allStars, targetScore);

  // 第四步：禄存专项
  const lucunBonus = calculateLucunBonus(hasLucun, strength);

  // 第五步：计算小计
  const subtotal = baseScore + luckyResult.total + unluckyResult.total + lucunBonus;

  // 第六步：应用天花板约束
  const { finalScore, isConstrained } = applyCeiling(subtotal, ceiling);

  return {
    baseScore,
    ceiling,
    luckyBonus: luckyResult.total,
    unluckyPenalty: unluckyResult.total,
    lucunBonus,
    subtotal,
    finalScore,
    isConstrained,
    starScores: [...luckyResult.details, ...unluckyResult.details],
  };
}

/**
 * 根据最终评分判断旺弱状态
 */
export function getStrengthByScore(score: number): PalaceStrength {
  if (score >= 8.0) return PalaceStrength.ExtremelyStrong;
  if (score >= 7.0) return PalaceStrength.Strong;
  if (score >= 5.0) return PalaceStrength.Medium;
  if (score >= 3.0) return PalaceStrength.Weak;
  if (score >= 2.0) return PalaceStrength.ExtremelyWeak;
  return PalaceStrength.Empty;
}

/**
 * 计算评分等级描述
 */
export function getScoreGrade(score: number): {
  grade: string;
  description: string;
  color: string;
} {
  if (score >= 8.5) {
    return {
      grade: 'S+',
      description: '满级出生，自带顶级防御',
      color: 'purple',
    };
  }
  if (score >= 7.5) {
    return {
      grade: 'S',
      description: '极强旺，具备制煞资格',
      color: 'purple',
    };
  }
  if (score >= 6.5) {
    return {
      grade: 'A+',
      description: '强旺，正能量充沛',
      color: 'green',
    };
  }
  if (score >= 5.5) {
    return {
      grade: 'A',
      description: '稳健，中道而行',
      color: 'green',
    };
  }
  if (score >= 4.5) {
    return {
      grade: 'B',
      description: '中等，有起有伏',
      color: 'yellow',
    };
  }
  if (score >= 3.5) {
    return {
      grade: 'C',
      description: '偏弱，需防小人',
      color: 'orange',
    };
  }
  if (score >= 2.5) {
    return {
      grade: 'D',
      description: '虚弱，防御不足',
      color: 'red',
    };
  }
  return {
    grade: 'E',
    description: '极弱，完全依赖外部',
    color: 'red',
  };
}

/**
 * 判断是否制煞
 */
export function isControlSha(strength: PalaceStrength, hasUnluckyStars: boolean): boolean {
  if (!hasUnluckyStars) return false;
  return strength === PalaceStrength.Strong || strength === PalaceStrength.ExtremelyStrong;
}

/**
 * 判断是否逞凶
 */
export function isAggressive(strength: PalaceStrength, hasUnluckyStars: boolean): boolean {
  if (!hasUnluckyStars) return false;
  return strength === PalaceStrength.Weak ||
         strength === PalaceStrength.ExtremelyWeak ||
         strength === PalaceStrength.Empty;
}
