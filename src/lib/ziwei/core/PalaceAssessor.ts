/**
 * 宫位能级评估器
 * 实现六步评分流程，评估12宫原生旺弱能级
 */

import {
  PalaceStrength,
  type Chart,
  type Palace,
  type PalaceAssessment,
  type StarName,
  type Branch,
  type PatternMatch,
  PALACE_ORDER,
  BRANCH_ORDER,
  SpatialRelation,
} from '../types';
import {
  getOppositeBranch,
  getTriadBranches,
  getFlankBranches,
  getDecayFactor,
} from '../utils/spatial';
import { getStarScore, isLuckyStar, isUnluckyStar } from '../types';
import { getCeiling, getPalaceStrength } from '../data/skeletonMapping';
import { checkPalacePatterns, getPatternEffect, type Pattern } from '../data/patterns';
import {
  getBaseScoreByStrength,
  getCeilingByStrength,
  calculateLuckyBonus,
  calculateUnluckyPenalty,
  calculateLucunBonus,
  applyCeiling,
  getStrengthByScore,
  getScoreGrade,
  isControlSha,
  isAggressive,
} from '../utils/scorer';

/**
 * 宫位能级评估器类
 */
export class PalaceAssessor {
  /**
   * 评估所有宫位能级
   */
  static assessAll(chart: Chart): Record<Branch, PalaceAssessment> {
    const assessments: Record<Branch, PalaceAssessment> = {} as Record<Branch, PalaceAssessment>;

    for (const branch of BRANCH_ORDER) {
      assessments[branch] = this.assessOne(chart, branch);
    }

    return assessments;
  }

  /**
   * 评估单个宫位能级
   */
  static assessOne(chart: Chart, palaceBranch: Branch): PalaceAssessment {
    const palace = chart.palaces[palaceBranch];

    // 执行六步评分流程
    const calculation = this.calculateScore(chart, palace);

    // 获取成格格局
    const patterns = this.checkPatterns(chart, palace);

    // 生成解读
    const interpretation = this.generateInterpretation(
      palace,
      calculation,
      patterns
    );

    return {
      palace: palace.name,
      branch: palaceBranch,
      strength: calculation.strength,
      baseScore: calculation.baseScore,
      finalScore: calculation.finalScore,
      ceiling: calculation.ceiling,
      isConstrained: calculation.isConstrained,
      majorStars: calculation.starScores
        .filter(s => this.isMajorStar(s.star))
        .map(s => ({
          star: s.star,
          score: s.finalScore,
          source: s.source,
        })),
      luckyStars: calculation.starScores
        .filter(s => isLuckyStar(s.star))
        .map(s => ({
          star: s.star,
          score: s.finalScore,
          source: s.source,
        })),
      unluckyStars: calculation.starScores
        .filter(s => isUnluckyStar(s.star))
        .map(s => ({
          star: s.star,
          score: s.finalScore,
          source: s.source,
        })),
      patterns,
      interpretation,
    };
  }

  /**
   * 六步评分流程
   */
  private static calculateScore(chart: Chart, palace: Palace) {
    const strength = palace.strength;
    const baseScore = getBaseScoreByStrength(strength);
    const ceiling = getCeilingByStrength(strength);
    const targetScore = baseScore;

    // 收集所有星曜
    const starData = this.collectAllStars(chart, palace);

    // 第二步：吉星加分
    const luckyResult = calculateLuckyBonus(
      starData.allStars,
      targetScore
    );

    // 第三步：煞星减分
    const unluckyResult = calculateUnluckyPenalty(
      starData.allStars,
      targetScore
    );

    // 第四步：禄存专项
    const hasLucun = starData.selfStars.includes('禄存');
    const lucunBonus = calculateLucunBonus(hasLucun, strength);

    // 第4.5步：四化评分因子
    const huaBonus = this.calculateHuaBonus(palace);

    // 第五步：计算小计
    const subtotal = baseScore + luckyResult.total + unluckyResult.total + lucunBonus + huaBonus;

    // 第六步：应用天花板约束（化禄可突破天花板0.5）
    const canExceed = palace.stars.some(s => s.huaType === 'lu');
    const effectiveCeiling = canExceed ? ceiling + 0.5 : ceiling;
    const { finalScore, isConstrained } = applyCeiling(subtotal, effectiveCeiling);

    // 判断是否制煞/逞凶
    const hasUnlucky = starData.allStars.some(s => isUnluckyStar(s.star));
    const isControlled = isControlSha(strength, hasUnlucky);
    const isAggressiveResult = isAggressive(strength, hasUnlucky);

    return {
      strength,
      baseScore,
      ceiling: effectiveCeiling,
      finalScore,
      isConstrained,
      isControlled,
      isAggressive: isAggressiveResult,
      luckyBonus: luckyResult.total,
      unluckyPenalty: unluckyResult.total,
      lucunBonus,
      huaBonus,
      starScores: [...luckyResult.details, ...unluckyResult.details],
    };
  }

  /**
   * 四化评分因子
   * 化禄+0.8，化权+0.5，化科+0.3，化忌-0.8
   */
  private static calculateHuaBonus(palace: Palace): number {
    let bonus = 0;
    for (const star of palace.stars) {
      switch (star.huaType) {
        case 'lu': bonus += 0.8; break;
        case 'quan': bonus += 0.5; break;
        case 'ke': bonus += 0.3; break;
        case 'ji': bonus -= 0.8; break;
      }
    }
    return bonus;
  }

  /**
   * 收集所有星曜及其空间关系
   */
  private static collectAllStars(chart: Chart, palace: Palace) {
    const branch = palace.branch;
    const selfStars = palace.stars.map(s => s.name);

    // 对宫星曜
    const oppositeBranch = getOppositeBranch(branch);
    const oppositePalace = chart.palaces[oppositeBranch];
    const oppositeStars = oppositePalace.stars.map(s => s.name);

    // 三合宫星曜
    const [triad1Branch, triad2Branch] = getTriadBranches(branch);
    const triad1Palace = chart.palaces[triad1Branch];
    const triad2Palace = chart.palaces[triad2Branch];
    const triadStars = [
      triad1Palace.stars.map(s => s.name),
      triad2Palace.stars.map(s => s.name),
    ];

    // 夹宫星曜
    const [flank1Branch, flank2Branch] = getFlankBranches(branch);
    const flank1Palace = chart.palaces[flank1Branch];
    const flank2Palace = chart.palaces[flank2Branch];
    const flankStars = [
      ...flank1Palace.stars.map(s => s.name),
      ...flank2Palace.stars.map(s => s.name),
    ];

    // 构建星曜空间关系数据
    const allStars = [
      ...selfStars.map(star => ({
        star,
        relation: 'self' as SpatialRelation,
        sourceStrength: palace.baseScore,
      })),
      ...oppositeStars.map(star => ({
        star,
        relation: 'opposite' as SpatialRelation,
        sourceStrength: oppositePalace.baseScore,
      })),
      ...triadStars[0].map(star => ({
        star,
        relation: 'triad' as SpatialRelation,
        sourceStrength: triad1Palace.baseScore,
      })),
      ...triadStars[1].map(star => ({
        star,
        relation: 'triad' as SpatialRelation,
        sourceStrength: triad2Palace.baseScore,
      })),
      ...flank1Palace.stars.map(s => ({
        star: s.name,
        relation: 'flank' as SpatialRelation,
        sourceStrength: flank1Palace.baseScore,
      })),
      ...flank2Palace.stars.map(s => ({
        star: s.name,
        relation: 'flank' as SpatialRelation,
        sourceStrength: flank2Palace.baseScore,
      })),
    ];

    return {
      selfStars,
      oppositeStars,
      triadStars,
      flankStars,
      allStars,
    };
  }

  /**
   * 检查成格格局（仅返回宫位级格局）
   */
  private static checkPatterns(chart: Chart, palace: Palace): PatternMatch[] {
    const allPatterns = checkPalacePatterns(chart, palace);

    // 只保留宫位级格局（scope === 'palace'）
    return allPatterns
      .filter(p => p.scope === 'palace')
      .map(p => ({
        name: p.name,
        category: p.category,
        source: p.type,
        description: p.description,
        effect: getPatternEffect(p.category),
      }));
  }

  /**
   * 生成解读
   */
  private static generateInterpretation(
    palace: Palace,
    calculation: { luckyBonus: number; unluckyPenalty: number; isControlled: boolean; isAggressive: boolean; isConstrained: boolean; huaBonus: number; finalScore: number; strength: PalaceStrength },
    patterns: PatternMatch[]
  ) {
    const grade = getScoreGrade(calculation.finalScore);

    // 生成特质描述
    const traits = this.generateTraits(palace, calculation);

    // 生成优势
    const advantages = this.generateAdvantages(palace, calculation, patterns);

    // 生成劣势
    const disadvantages = this.generateDisadvantages(palace, calculation, patterns);

    // 生成建议
    const advice = this.generateAdvice(palace, calculation, patterns);

    return {
      level: `${grade.grade}级 - ${grade.description}`,
      traits,
      advantages,
      disadvantages,
      advice,
    };
  }

  /**
   * 生成特质描述
   */
  private static generateTraits(palace: Palace, calculation: { finalScore: number; strength: PalaceStrength }): string[] {
    const traits: string[] = [];
    const strength = palace.strength;

    switch (strength) {
      case PalaceStrength.ExtremelyStrong:
        traits.push('满级出生，自带顶级防御');
        traits.push('吉星真吉，煞星也被制化呈正面');
        break;
      case PalaceStrength.Strong:
        traits.push('旺宫强健，具备制煞资格');
        traits.push('正能量充沛，容易跨越上限');
        break;
      case PalaceStrength.Medium:
        traits.push('平宫稳健，中道而行');
        traits.push('吉不完整，煞不极端');
        break;
      case PalaceStrength.Weak:
        traits.push('陷宫防御虚弱，遇吉可爆发');
        traits.push('煞星逞凶，须防小人');
        break;
      case PalaceStrength.ExtremelyWeak:
        traits.push('极弱宫位，起步极艰');
        traits.push('遇顶级吉化可达平宫水平');
        break;
      case PalaceStrength.Empty:
        traits.push('空宫无主，完全依赖外部投射');
        traits.push('吉象减半，凶象更凶');
        break;
    }

    return traits;
  }

  /**
   * 生成优势
   */
  private static generateAdvantages(
    palace: Palace,
    calculation: { luckyBonus: number; unluckyPenalty: number; isControlled: boolean; isAggressive: boolean; isConstrained: boolean; huaBonus: number; finalScore: number },
    patterns: PatternMatch[]
  ): string[] {
    const advantages: string[] = [];

    // 从格局中获取优势
    const luckyPatterns = patterns.filter(p =>
      p.effect === 'positive'
    );
    for (const pattern of luckyPatterns) {
      advantages.push(pattern.description);
    }

    // 从吉星中获取优势
    if (calculation.luckyBonus > 0) {
      advantages.push(`吉星助力强劲，加分${calculation.luckyBonus.toFixed(1)}`);
    }

    // 从制煞中获取优势
    if (calculation.isControlled) {
      advantages.push('旺宫制煞，煞星呈正面发挥');
    }

    // 从四化中获取优势
    const huaLuStar = palace.stars.find(s => s.huaType === 'lu');
    if (huaLuStar) {
      advantages.push(`${huaLuStar.name}化禄，能量顺畅`);
    }
    const huaQuanStar = palace.stars.find(s => s.huaType === 'quan');
    if (huaQuanStar) {
      advantages.push(`${huaQuanStar.name}化权，掌控力强`);
    }
    const huaKeStar = palace.stars.find(s => s.huaType === 'ke');
    if (huaKeStar) {
      advantages.push(`${huaKeStar.name}化科，声名助力`);
    }

    return advantages;
  }

  /**
   * 生成劣势
   */
  private static generateDisadvantages(
    palace: Palace,
    calculation: { luckyBonus: number; unluckyPenalty: number; isControlled: boolean; isAggressive: boolean; isConstrained: boolean; huaBonus: number; finalScore: number },
    patterns: PatternMatch[]
  ): string[] {
    const disadvantages: string[] = [];

    // 从格局中获取劣势
    const unluckyPatterns = patterns.filter(p =>
      p.effect === 'negative'
    );
    for (const pattern of unluckyPatterns) {
      disadvantages.push(pattern.description);
    }

    // 从煞星中获取劣势
    if (calculation.unluckyPenalty < 0) {
      disadvantages.push(`煞星干扰，减分${Math.abs(calculation.unluckyPenalty).toFixed(1)}`);
    }

    // 从逞凶中获取劣势
    if (calculation.isAggressive) {
      disadvantages.push('陷宫逞凶，煞星负面影响放大');
    }

    // 从化忌中获取劣势
    const huaJiStar = palace.stars.find(s => s.huaType === 'ji');
    if (huaJiStar) {
      disadvantages.push(`${huaJiStar.name}化忌，能量阻滞`);
    }

    // 从天花板约束中获取劣势
    if (calculation.isConstrained) {
      disadvantages.push('受天花板约束，无法突破上限');
    }

    // 空宫特殊处理
    if (palace.strength === PalaceStrength.Empty) {
      disadvantages.push('空宫无主，依赖外部投射');
    }

    return disadvantages;
  }

  /**
   * 生成建议
   */
  private static generateAdvice(
    palace: Palace,
    calculation: { finalScore: number; isControlled: boolean; isAggressive: boolean },
    patterns: PatternMatch[]
  ): string {
    const advices: string[] = [];

    // 根据能级给出建议
    if (calculation.finalScore >= 7.0) {
      advices.push('此宫旺强，可积极进取，把握机遇');
    } else if (calculation.finalScore >= 5.0) {
      advices.push('此宫平稳，稳中求进，善用吉星');
    } else {
      advices.push('此宫偏弱，宜保守行事，防范风险');
    }

    // 根据格局给出建议
    const hasProtection = patterns.some(p =>
      p.name === '双禄夹' || p.name === '府相朝元'
    );
    if (hasProtection) {
      advices.push('有护佑格局保护，凶限时能守住底线');
    }

    return advices.join('；');
  }

  /**
   * 判断是否为主星
   */
  private static isMajorStar(starName: StarName): boolean {
    const majorStars = [
      '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
      '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
    ];
    return majorStars.includes(starName);
  }
}

/**
 * 辅助函数：获取宫位评分
 */
export function getPalaceScore(assessment: PalaceAssessment): number {
  return assessment.finalScore;
}

/**
 * 辅助函数：获取宫位等级
 */
export function getPalaceGrade(assessment: PalaceAssessment): string {
  if (assessment.finalScore >= 8.5) return 'S+';
  if (assessment.finalScore >= 7.5) return 'S';
  if (assessment.finalScore >= 6.5) return 'A+';
  if (assessment.finalScore >= 5.5) return 'A';
  if (assessment.finalScore >= 4.5) return 'B';
  if (assessment.finalScore >= 3.5) return 'C';
  if (assessment.finalScore >= 2.5) return 'D';
  return 'E';
}

/**
 * 辅助函数：比较两个宫位的强弱
 */
export function comparePalaceStrength(
  assessment1: PalaceAssessment,
  assessment2: PalaceAssessment
): 'stronger' | 'weaker' | 'equal' {
  const diff = assessment1.finalScore - assessment2.finalScore;
  if (diff > 0.5) return 'stronger';
  if (diff < -0.5) return 'weaker';
  return 'equal';
}
