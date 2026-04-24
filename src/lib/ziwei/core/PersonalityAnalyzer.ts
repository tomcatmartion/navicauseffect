/**
 * 性格分析器
 * 以命宫/身宫/太岁宫三宫为核心，结合本对合临四维合参，定性命主完整性格图谱
 */

import type {
  Chart,
  PersonalityProfile,
  PalaceAssessment,
  PalaceName,
  Branch,
} from '../types';
import { PalaceStrength } from '../types';
import {
  getOppositeBranch,
  getTriadBranches,
  getFlankBranches,
  getPalaceNameByBranch,
} from '../utils/spatial';
import { getHuaByStem } from '../data/fiveTiger';
import { isLuckyStar, isUnluckyStar } from '../types';
import { PalaceAssessor } from './PalaceAssessor';
import { getMingPalace, getShenPalace, getTaiSuiPalace } from './ChartEngine';

/**
 * 性格分析器类
 */
export class PersonalityAnalyzer {
  /**
   * 分析完整性格图谱
   */
  static analyze(chart: Chart): PersonalityProfile {
    // 先评估所有宫位能级
    const assessments = PalaceAssessor.assessAll(chart);

    // 三宫合参
    const mingShenTai = this.analyzeMingShenTai(chart, assessments);

    // 性格特质分层
    const traits = this.analyzeTraits(chart, assessments);

    // 四维合参（命宫）
    const fourDimensions = this.fourDimensionsAnalysis(chart, assessments);

    // 命宫全息底色
    const mingHolographic = this.mingHolographicAnalysis(chart);

    // 行为模式
    const behaviorPatterns = this.analyzeBehaviorPatterns(chart, assessments);

    // 优势与劣势
    const { strengths, weaknesses } = this.analyzeStrengthsWeaknesses(
      chart,
      assessments
    );

    // 总体画像
    const overview = this.generateOverview(
      mingShenTai,
      traits,
      behaviorPatterns
    );

    // 发展建议
    const advice = this.generateAdvice(chart, assessments);

    return {
      overview,
      mingShenTai,
      traits,
      fourDimensions,
      mingHolographic,
      behaviorPatterns,
      strengths,
      weaknesses,
      advice,
    };
  }

  /**
   * 三宫合参分析
   */
  private static analyzeMingShenTai(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const shenPalace = getShenPalace(chart);
    const taiSuiPalace = getTaiSuiPalace(chart);

    return {
      ming: assessments[mingPalace.branch],
      shen: shenPalace ? assessments[shenPalace.branch] : undefined,
      taiSui: assessments[taiSuiPalace.branch],
    };
  }

  /**
   * 性格特质分层分析
   */
  private static analyzeTraits(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const shenPalace = getShenPalace(chart);
    const taiSuiPalace = getTaiSuiPalace(chart);

    return {
      // 表层特质（命宫）- 早年即凸显
      surface: this.extractPalaceTraits(mingPalace),
      // 中层特质（身宫）- 第三个大限后逐渐凸显
      middle: shenPalace ? this.extractPalaceTraits(shenPalace) : [],
      // 核心特质（太岁宫）- 关键利益时刻爆发
      core: this.extractPalaceTraits(taiSuiPalace),
    };
  }

  /**
   * 从宫位提取特质
   */
  private static extractPalaceTraits(palace: any): string[] {
    const traits: string[] = [];

    // 根据主星提取特质
    for (const star of palace.stars) {
      if (star.type === 'major') {
        traits.push(...this.getStarTraits(star.name));
      }
    }

    // 根据旺弱提取特质
    const strength = palace.strength;
    if (strength === PalaceStrength.Strong || strength === PalaceStrength.ExtremelyStrong) {
      traits.push('积极主动', '自信坚定');
    } else if (strength === PalaceStrength.Weak || strength === PalaceStrength.ExtremelyWeak) {
      traits.push('谨慎保守', '易受影响');
    }

    return traits;
  }

  /**
   * 获取星曜特质
   */
  private static getStarTraits(starName: string): string[] {
    const traitsMap: Record<string, string[]> = {
      '紫微': ['领导欲强', '权威感', '自尊心重', '喜欢掌控'],
      '天机': ['善思虑', '反应快', '变通性强', '喜策划'],
      '太阳': ['热情开朗', '慷慨大方', '注重名声', '发散性强'],
      '武曲': ['决断力强', '行动力佳', '直爽刚毅', '财运意识'],
      '天同': ['协调性好', '重感情', '享受生活', '温和包容'],
      '廉贞': ['精密细致', '是非分明', '感情丰富', '完美主义'],
      '天府': ['稳重踏实', '管理能力', '财库观念', '保守稳健'],
      '太阴': ['细腻敏感', '财富意识', '情感丰富', '内敛含蓄'],
      '贪狼': ['欲望强烈', '机谋灵活', '社交能力', '桃花缘分'],
      '巨门': ['怀疑心重', '分析能力强', '口才佳', '是非分明'],
      '天相': ['辅佐能力', '契约精神', '正义感', '协调能力'],
      '天梁': ['庇荫他人', '医药缘分', '督导能力', '老成持重'],
      '七杀': ['权谋决断', '奋斗精神', '肃杀之气', '开创能力'],
      '破军': ['突破创新', '消耗力强', '冲锋陷阵', '改革精神'],
    };

    return traitsMap[starName] || [];
  }

  /**
   * 四维合参分析
   */
  private static fourDimensionsAnalysis(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const branch = mingPalace.branch;

    // 获取空间关系宫位
    const oppositeBranch = getOppositeBranch(branch);
    const [triad1Branch, triad2Branch] = getTriadBranches(branch);
    const [flank1Branch, flank2Branch] = getFlankBranches(branch);

    // 本宫
    const self = this.analyzePalaceDimension(mingPalace, assessments[branch]);

    // 对宫
    const opposite = this.analyzePalaceDimension(
      chart.palaces[oppositeBranch],
      assessments[oppositeBranch]
    );

    // 三合
    const triad = this.analyzeTriadDimension(
      chart.palaces[triad1Branch],
      chart.palaces[triad2Branch],
      assessments[triad1Branch],
      assessments[triad2Branch]
    );

    // 夹宫
    const flank = this.analyzeFlankDimension(
      chart.palaces[flank1Branch],
      chart.palaces[flank2Branch],
      assessments[flank1Branch],
      assessments[flank2Branch]
    );

    // 综合解读
    const synthesis = this.synthesizeFourDimensions(
      self,
      opposite,
      triad,
      flank
    );

    return {
      palace: mingPalace.name,
      self,
      opposite,
      triad,
      flank,
      synthesis,
    };
  }

  /**
   * 分析单宫维度
   */
  private static analyzePalaceDimension(
    palace: any,
    assessment: PalaceAssessment
  ): string {
    const parts: string[] = [];

    // 旺弱状态
    parts.push(`[${assessment.strength}]`);

    // 主星
    const majorStars = palace.stars
      .filter((s: any) => s.type === 'major')
      .map((s: any) => s.name);
    if (majorStars.length > 0) {
      parts.push(`主星：${majorStars.join('、')}`);
    }

    // 评分
    parts.push(`评分：${assessment.finalScore.toFixed(1)}`);

    // 制煞/逞凶
    if (assessment.interpretation.disadvantages.includes('制煞')) {
      parts.push('制煞有力');
    }
    if (assessment.interpretation.disadvantages.includes('逞凶')) {
      parts.push('逞凶负面');
    }

    return parts.join(' | ');
  }

  /**
   * 分析三合维度
   */
  private static analyzeTriadDimension(
    triad1: any,
    triad2: any,
    assessment1: PalaceAssessment,
    assessment2: PalaceAssessment
  ): string {
    const avgScore = (assessment1.finalScore + assessment2.finalScore) / 2;

    if (avgScore >= 6.0) {
      return `三合吉旺，强力后援（${avgScore.toFixed(1)}分）`;
    } else if (avgScore >= 4.0) {
      return `三合平平，支撑一般（${avgScore.toFixed(1)}分）`;
    } else {
      return `三合偏弱，侧翼受压（${avgScore.toFixed(1)}分）`;
    }
  }

  /**
   * 分析夹宫维度
   */
  private static analyzeFlankDimension(
    flank1: any,
    flank2: any,
    assessment1: PalaceAssessment,
    assessment2: PalaceAssessment
  ): string {
    const diff = Math.abs(assessment1.finalScore - assessment2.finalScore);
    const avgScore = (assessment1.finalScore + assessment2.finalScore) / 2;

    if (diff <= 1.0) {
      return `夹宫均衡，稳定有助力（${avgScore.toFixed(1)}分）`;
    } else {
      const stronger = assessment1.finalScore > assessment2.finalScore ? '左' : '右';
      return `夹宫不对称，${stronger}侧较强（落差${diff.toFixed(1)}）`;
    }
  }

  /**
   * 综合四维解读
   */
  private static synthesizeFourDimensions(
    self: string,
    opposite: string,
    triad: string,
    flank: string
  ): string {
    return `本宫：${self}；对宫投射：${opposite}；三合支撑：${triad}；夹宫影响：${flank}`;
  }

  /**
   * 命宫全息底色分析
   */
  private static mingHolographicAnalysis(chart: Chart) {
    const mingPalace = getMingPalace(chart);
    const stem = mingPalace.stem;

    // 四化影响
    const hua = stem ? getHuaByStem(stem) : { lu: null, quan: null, ke: null, ji: null };

    // 吉星影响
    const luckyStars = mingPalace.stars
      .filter(s => isLuckyStar(s.name))
      .map(s => s.name);

    // 煞星影响
    const unluckyStars = mingPalace.stars
      .filter(s => isUnluckyStar(s.name))
      .map(s => s.name);

    return {
      hua: {
        lu: hua.lu ? `${hua.lu}化禄：顺畅圆融` : undefined,
        quan: hua.quan ? `${hua.quan}化权：强势主导` : undefined,
        ke: hua.ke ? `${hua.ke}化科：理性清晰` : undefined,
        ji: hua.ji ? `${hua.ji}化忌：执念阻滞` : undefined,
      },
      luckyStars,
      unluckyStars,
    };
  }

  /**
   * 行为模式分析
   */
  private static analyzeBehaviorPatterns(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const mingAssessment = assessments[mingPalace.branch];

    // 根据命宫状态分析行为模式
    const proactive: string[] = [];
    const reactive: string[] = [];
    const stress: string[] = [];

    // 主动行为
    if (mingAssessment.finalScore >= 6.0) {
      proactive.push('积极主动', '主导事务', '勇于担当');
    } else {
      proactive.push('谨慎行事', '观察为先', '被动响应');
    }

    // 被动反应
    if (mingPalace.strength === PalaceStrength.Weak) {
      reactive.push('易受环境影响', '需要外部推动');
    } else {
      reactive.push('抗压能力强', '能应对挑战');
    }

    // 压力下行为
    if (mingAssessment.interpretation.disadvantages.includes('逞凶')) {
      stress.push('压力下易冲动', '情绪化反应', '需要疏导');
    } else if (mingAssessment.finalScore >= 6.0) {
      stress.push('压力下更冷静', '能理性应对', '抗压性强');
    } else {
      stress.push('压力下易退缩', '需要支持', '保守应对');
    }

    return { proactive, reactive, stress };
  }

  /**
   * 优势与劣势分析
   */
  private static analyzeStrengthsWeaknesses(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const mingAssessment = assessments[mingPalace.branch];

    // 优势
    const strengths = [...mingAssessment.interpretation.advantages];

    // 劣势
    const weaknesses = [...mingAssessment.interpretation.disadvantages];

    return { strengths, weaknesses };
  }

  /**
   * 生成总体画像
   */
  private static generateOverview(
    mingShenTai: any,
    traits: any,
    behaviorPatterns: any
  ): string {
    const parts: string[] = [];

    // 命宫特质
    parts.push(`命宫${traits.surface.slice(0, 3).join('、')}`);

    // 身宫补充
    if (traits.middle.length > 0) {
      parts.push(`后半程${traits.middle.slice(0, 2).join('、')}`);
    }

    // 行为模式
    parts.push(...behaviorPatterns.proactive.slice(0, 2));

    return parts.join('；');
  }

  /**
   * 生成发展建议
   */
  private static generateAdvice(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const mingAssessment = assessments[mingPalace.branch];

    const advice = {
      overall: mingAssessment.interpretation.advice,
      career: '',
      relationship: '',
      health: '',
    };

    // 根据命宫状态给出建议
    if (mingAssessment.finalScore >= 6.0) {
      advice.career = '命宫旺强，适合主导型工作，可承担管理职责';
      advice.relationship = '自信心强，在感情中宜多倾听对方';
      advice.health = '精力充沛，注意劳逸结合';
    } else {
      advice.career = '命宫偏弱，宜选择稳定环境，逐步发展';
      advice.relationship = '性格内敛，适合循序渐进的感情发展';
      advice.health = '抵抗力较弱，注意保养身体';
    }

    return advice;
  }
}
