/**
 * 事项分析器
 * 以命宫为轴，结合原局底盘格局识别与完整行运分析，对具体事项进行系统性解读
 */

import type {
  Chart,
  AffairAnalysis,
  AffairType,
  PalaceName,
  PalaceAssessment,
  PatternMatch,
  Decennial,
  Annual,
  Stem,
} from '../types';
import { checkAllPatterns, getPatternEffect } from '../data/patterns';
import { PalaceAssessor } from './PalaceAssessor';
import { PersonalityAnalyzer } from './PersonalityAnalyzer';
import { ChartEngine } from './ChartEngine';
import {
  getOppositeBranch,
  getTriadBranches,
  getFlankBranches,
} from '../utils/spatial';
import { calculateDecennials, calculateAnnual } from '../utils/decennial';

/**
 * 事项宫位映射
 */
const AFFAIR_PALACE_MAPPING: Record<AffairType, { primary: PalaceName; secondary: PalaceName[] }> = {
  '求学': { primary: '官禄', secondary: ['迁移', '田宅'] },
  '求爱': { primary: '夫妻', secondary: ['福德'] },
  '求财': { primary: '财帛', secondary: ['田宅', '迁移', '福德'] },
  '求职': { primary: '官禄', secondary: ['迁移', '仆役'] },
  '求健康': { primary: '疾厄', secondary: ['命宫'] },
  '求名': { primary: '官禄', secondary: ['迁移'] },
  '其他': { primary: '命宫', secondary: [] },
};

/**
 * 问诊清单
 */
const DIAGNOSTIC_QUESTIONS: Record<AffairType, string[]> = {
  '求学': [
    '是否涉及异地或留学？',
    '是否以大量记诵/考试为主？',
  ],
  '求爱': [
    '是自由恋爱还是相亲/条件交换型？',
    '是寻找对象还是已有对象讨论走向？',
  ],
  '求财': [
    '是否有劳力付出？',
    '是否有实体门店或固定营业场地？',
    '是否涉及合伙？',
    '是否涉及异地/跨境/外贸业务？',
    '是纯投资（理财/股票/博弈）吗？',
  ],
  '求职': [
    '是初次求职还是跳槽换工作？',
    '目标职位是否有学历/资格证门槛？',
    '是否需要管理下属？',
    '是否涉及异地就职？',
  ],
  '求健康': [
    '是整体体质评估还是针对具体症状/疾病？',
    '是否有已知遗传病史方向？',
  ],
  '求名': [
    '是因技艺成名还是因人缘成名？',
    '是否涉及网络传播/直播/演艺？',
  ],
  '其他': [],
};

/**
 * 事项分析器类
 */
export class AffairAnalyzer {
  /**
   * 分析事项
   */
  static analyze(params: {
    chart: Chart;
    affair: string;
    affairType?: AffairType;
    currentAge?: number;
    targetYear?: number;
    questions?: Record<string, string>;
  }): AffairAnalysis {
    const {
      chart,
      affair,
      affairType = this.detectAffairType(affair),
      currentAge,
      targetYear = new Date().getFullYear(),
      questions = {},
    } = params;

    // 评估所有宫位
    const assessments = PalaceAssessor.assessAll(chart);

    // 获取宫位聚焦
    const palaceFocus = this.getPalaceFocus(affairType, chart, assessments);

    // 原局底盘分析
    const natal = this.analyzeNatal(chart, palaceFocus, assessments);

    // 行运分析
    const decennial = this.analyzeDecennial(
      chart,
      currentAge,
      palaceFocus,
      assessments
    );

    // 流年引动
    const annual = this.analyzeAnnual(
      chart,
      targetYear,
      palaceFocus,
      assessments
    );

    // 时间窗口
    const timing = this.analyzeTiming(chart, currentAge, targetYear);

    // 综合结论
    const conclusion = this.makeConclusion(
      natal,
      decennial,
      annual,
      palaceFocus
    );

    // 调整建议
    const advice = this.generateAdvice(
      natal,
      decennial,
      annual,
      conclusion
    );

    // 总体判断
    const overview = this.generateOverview(affair, conclusion);

    return {
      affair,
      affairType,
      overview,
      natal,
      palaceFocus,
      decennial,
      annual,
      timing,
      conclusion,
      advice,
    };
  }

  /**
   * 检测事项类型（优先匹配长词组，避免单字误判）
   */
  private static detectAffairType(affair: string): AffairType {
    // 优先匹配长词组（2字以上），避免单字误判
    const phraseKeywords: [string, AffairType][] = [
      // 求学（优先级高，避免"出国"等被"出"匹配到求名）
      ['留学', '求学'], ['考试', '求学'], ['升学', '求学'],
      ['学业', '求学'], ['读书', '求学'], ['学习', '求学'],
      ['考研', '求学'], ['考公', '求学'], ['高考', '求学'],
      // 求爱
      ['感情', '求爱'], ['恋爱', '求爱'], ['结婚', '求爱'],
      ['对象', '求爱'], ['婚姻', '求爱'], ['姻缘', '求爱'],
      ['桃花', '求爱'], ['复合', '求爱'], ['分手', '求爱'],
      // 求财
      ['投资', '求财'], ['赚钱', '求财'], ['理财', '求财'],
      ['财运', '求财'], ['创业', '求财'], ['合伙', '求财'],
      ['股票', '求财'], ['基金', '求财'],
      // 求职
      ['工作', '求职'], ['跳槽', '求职'], ['求职', '求职'],
      ['升职', '求职'], ['面试', '求职'], ['事业', '求职'],
      ['转行', '求职'], ['就业', '求职'],
      // 求健康
      ['健康', '求健康'], ['身体', '求健康'], ['体质', '求健康'],
      ['疾病', '求健康'],
      // 求名
      ['名声', '求名'], ['名誉', '求名'], ['出名', '求名'],
      ['直播', '求名'], ['演艺', '求名'], ['网红', '求名'],
    ];

    // 先匹配词组
    for (const [keyword, type] of phraseKeywords) {
      if (affair.includes(keyword)) {
        return type;
      }
    }

    // 单字匹配（作为兜底，排除容易误判的单字）
    const singleCharMap: Record<string, AffairType> = {
      '学': '求学',
      '爱': '求爱',
      '财': '求财',
      '钱': '求财',
      '职': '求职',
      '病': '求健康',
      '名': '求名',
    };

    for (const [keyword, type] of Object.entries(singleCharMap)) {
      if (affair.includes(keyword)) {
        return type;
      }
    }

    return '其他';
  }

  /**
   * 获取事项宫位聚焦
   */
  private static getPalaceFocus(
    affairType: AffairType,
    chart: Chart,
    assessments: Record<string, PalaceAssessment>
  ) {
    const mapping = AFFAIR_PALACE_MAPPING[affairType];

    // 查找主看宫位
    let primaryPalace: PalaceName | undefined;
    let primaryAssessment: PalaceAssessment | undefined;

    for (const [branch, palace] of Object.entries(chart.palaces)) {
      if (palace.name === mapping.primary) {
        primaryPalace = palace.name;
        primaryAssessment = assessments[branch];
        break;
      }
    }

    // 查找兼看宫位
    const secondary: PalaceName[] = [];
    const secondaryAssessments: Record<string, PalaceAssessment> = {};

    for (const secName of mapping.secondary) {
      for (const [branch, palace] of Object.entries(chart.palaces)) {
        if (palace.name === secName) {
          secondary.push(palace.name);
          secondaryAssessments[palace.name] = assessments[branch];
          break;
        }
      }
    }

    // 综合分析
    const synthesis = this.synthesizePalaceFocus(
      primaryAssessment,
      secondaryAssessments
    );

    return {
      primary: mapping.primary,
      primaryAssessment: primaryAssessment!,
      secondary,
      secondaryAssessments,
      synthesis,
    };
  }

  /**
   * 综合宫位聚焦分析
   */
  private static synthesizePalaceFocus(
    primaryAssessment: PalaceAssessment | undefined,
    secondaryAssessments: Record<string, PalaceAssessment>
  ): string {
    const parts: string[] = [];

    if (primaryAssessment) {
      parts.push(`主宫${primaryAssessment.palace}评分${primaryAssessment.finalScore.toFixed(1)}`);
    }

    const secondaryScores = Object.values(secondaryAssessments).map(
      a => a.finalScore
    );
    if (secondaryScores.length > 0) {
      const avgSecondary = secondaryScores.reduce((a, b) => a + b, 0) / secondaryScores.length;
      parts.push(`兼看宫平均${avgSecondary.toFixed(1)}`);
    }

    return parts.join('，');
  }

  /**
   * 原局底盘分析
   */
  private static analyzeNatal(
    chart: Chart,
    palaceFocus: any,
    assessments: Record<string, PalaceAssessment>
  ) {
    // 识别格局
    const patterns = checkAllPatterns(chart, 'natal');

    // 护佑机制
    const protection = patterns.filter(p =>
      p.name === '双禄夹' ||
      p.name === '府相朝元' ||
      p.name === '紫府朝垣'
    );

    // 基础能量
    const foundation = this.assessFoundation(chart, palaceFocus, assessments);

    // 基础评分
    const score = this.calculateNatalScore(
      palaceFocus.primaryAssessment,
      palaceFocus.secondaryAssessments
    );

    return {
      patterns: patterns.map(p => ({
        name: p.name,
        category: p.category,
        source: 'natal' as const,
        description: p.description,
        effect: getPatternEffect(p.category),
      })),
      protection: protection.map(p => ({
        name: p.name,
        category: p.category,
        source: 'natal' as const,
        description: p.description,
        effect: getPatternEffect(p.category),
      })),
      foundation,
      score,
    };
  }

  /**
   * 评估基础能量
   */
  private static assessFoundation(
    chart: Chart,
    palaceFocus: any,
    assessments: Record<string, PalaceAssessment>
  ): string {
    const primaryScore = palaceFocus.primaryAssessment?.finalScore || 5;
    const secondaryScores = (Object.values(palaceFocus.secondaryAssessments) as PalaceAssessment[]).map(
      (a: PalaceAssessment) => a.finalScore
    );
    const avgSecondary = secondaryScores.length > 0
      ? secondaryScores.reduce((a, b) => a + b, 0) / secondaryScores.length
      : 5;

    const overall = (primaryScore + avgSecondary) / 2;

    if (overall >= 7.0) {
      return '基础能量强旺，先天条件优越';
    } else if (overall >= 5.0) {
      return '基础能量平稳，中规中矩';
    } else {
      return '基础能量偏弱，需要后天努力';
    }
  }

  /**
   * 计算原局评分（0-100）
   */
  private static calculateNatalScore(
    primaryAssessment: PalaceAssessment,
    secondaryAssessments: Record<string, PalaceAssessment>
  ): number {
    const primaryScore = primaryAssessment.finalScore;

    const secondaryScores = Object.values(secondaryAssessments).map(
      a => a.finalScore
    );
    const avgSecondary = secondaryScores.length > 0
      ? secondaryScores.reduce((a, b) => a + b, 0) / secondaryScores.length
      : 5;

    // 主宫权重60%，兼看宫权重40%（统一 0-10 评分后乘10）
    return Math.round((primaryScore * 0.6 + avgSecondary * 0.4) * 10);
  }

  /**
   * 行运分析
   */
  private static analyzeDecennial(
    chart: Chart,
    currentAge: number | undefined,
    palaceFocus: any,
    assessments: Record<string, PalaceAssessment>
  ) {
    const defaultDecennial: Decennial = {
      index: 0,
      ageRange: [0, 0] as [number, number],
      palace: '命宫' as PalaceName,
      branch: chart.mingPalace,
      stem: '甲' as Stem,
      hua: { lu: null, quan: null, ke: null, ji: null },
    };

    let decennial = defaultDecennial;

    if (currentAge) {
      const decs = ChartEngine.getCurrentDecennial(chart, currentAge);
      if (decs) {
        decennial = decs;
      }
    }

    // 激活方向
    const activation = this.assessDecennialActivation(decennial, palaceFocus);

    // 趋势判断
    const trends = this.assessDecennialTrends(decennial, palaceFocus);

    // 评分
    const score = this.calculateDecennialScore(decennial, palaceFocus);

    return {
      index: decennial.index,
      ageRange: decennial.ageRange,
      palace: decennial.palace,
      stem: decennial.stem,
      hua: decennial.hua,
      activation,
      trends,
      score,
    };
  }

  /**
   * 评估大限激活方向（结合宫位关系）
   */
  private static assessDecennialActivation(decennial: any, palaceFocus: any): string {
    const parts: string[] = [];

    // 大限四化对事项的影响
    if (decennial.hua.lu) {
      parts.push(`${decennial.hua.lu}化禄激活，这十年该事项方向顺畅`);
    }
    if (decennial.hua.ke) {
      parts.push(`${decennial.hua.ke}化科激活，有贵人助力`);
    }
    if (decennial.hua.ji) {
      parts.push(`${decennial.hua.ji}化忌激活，这十年该事项需谨慎`);
    }
    if (decennial.hua.quan) {
      parts.push(`${decennial.hua.quan}化权激活，掌控力增强`);
    }

    if (parts.length === 0) {
      return '平稳期，按部就班发展';
    }
    return parts.join('；');
  }

  /**
   * 评估大限趋势
   */
  private static assessDecennialTrends(decennial: any, palaceFocus: any): string[] {
    const trends: string[] = [];

    if (decennial.hua.lu) {
      trends.push(`${decennial.hua.lu}化禄：机遇期，把握机会`);
    }
    if (decennial.hua.quan) {
      trends.push(`${decennial.hua.quan}化权：强势期，主动进取`);
    }
    if (decennial.hua.ke) {
      trends.push(`${decennial.hua.ke}化科：名声期，注重形象`);
    }
    if (decennial.hua.ji) {
      trends.push(`${decennial.hua.ji}化忌：阻滞期，防范风险`);
    }

    // 大限宫位评分
    if (decennial.score >= 70) {
      trends.push('大限整体能量强旺，利于推进事项');
    } else if (decennial.score <= 40) {
      trends.push('大限整体能量偏弱，宜保守行事');
    }

    return trends;
  }

  /**
   * 计算大限评分
   */
  private static calculateDecennialScore(decennial: any, palaceFocus: any): number {
    let score = 50; // 基础分

    if (decennial.hua.lu) score += 15;
    if (decennial.hua.quan) score += 10;
    if (decennial.hua.ke) score += 10;
    if (decennial.hua.ji) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 流年引动分析
   */
  private static analyzeAnnual(
    chart: Chart,
    targetYear: number,
    palaceFocus: any,
    assessments: Record<string, PalaceAssessment>
  ) {
    const annual = ChartEngine.getAnnual(chart, targetYear);

    // 引动触发点
    const trigger = this.assessAnnualTrigger(annual, palaceFocus);

    // 年度展望
    const outlook = this.assessAnnualOutlook(annual, palaceFocus);

    // 评分
    const score = this.calculateAnnualScore(annual);

    return {
      year: annual.year,
      palace: annual.palace,
      stem: annual.stem,
      hua: annual.hua,
      trigger,
      outlook,
      score,
    };
  }

  /**
   * 评估流年触发点（结合四化与宫位关系）
   */
  private static assessAnnualTrigger(annual: any, palaceFocus: any): string {
    const parts: string[] = [];

    if (annual.hua.lu) {
      parts.push(`流年${annual.hua.lu}化禄，今年是推进该事项的良机`);
    }
    if (annual.hua.quan) {
      parts.push(`流年${annual.hua.quan}化权，今年在该事项上掌控力增强`);
    }
    if (annual.hua.ke) {
      parts.push(`流年${annual.hua.ke}化科，今年有贵人助力`);
    }
    if (annual.hua.ji) {
      parts.push(`流年${annual.hua.ji}化忌，今年在该事项上需谨慎`);
    }

    if (parts.length === 0) {
      return '平稳推进，无明显触发点';
    }
    return parts.join('；');
  }

  /**
   * 评估年度展望
   */
  private static assessAnnualOutlook(annual: any, palaceFocus: any): string {
    if (annual.hua.lu && !annual.hua.ji) {
      return '机遇年，可以积极行动';
    }
    if (annual.hua.ji && !annual.hua.lu) {
      return '谨慎年，宜保守观望';
    }
    if (annual.hua.lu && annual.hua.ji) {
      return '吉凶参半年，有机会也有挑战';
    }
    return '平稳年，按计划推进';
  }

  /**
   * 计算流年评分
   */
  private static calculateAnnualScore(annual: any): number {
    let score = 50;

    if (annual.hua.lu) score += 20;
    if (annual.hua.quan) score += 15;
    if (annual.hua.ke) score += 10;
    if (annual.hua.ji) score -= 25;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 时间窗口分析
   */
  private static analyzeTiming(
    chart: Chart,
    currentAge: number | undefined,
    targetYear: number
  ) {
    const favorable: string[] = [];
    const caution: string[] = [];
    const action: string[] = [];

    if (currentAge) {
      const decennial = ChartEngine.getCurrentDecennial(chart, currentAge);
      if (decennial) {
        if (decennial.hua.lu || decennial.hua.ke) {
          favorable.push(`当前大限吉化，适合推进事项`);
        }
        if (decennial.hua.ji) {
          caution.push(`当前大限化忌，需谨慎行事`);
        }
      }
    }

    const annual = ChartEngine.getAnnual(chart, targetYear);
    if (annual.hua.lu) {
      favorable.push(`今年化禄，把握机遇`);
      action.push('建议在今年内积极行动');
    }
    if (annual.hua.ji) {
      caution.push(`今年化忌，防范风险`);
      action.push('建议暂缓重大决策');
    }

    return {
      favorable,
      caution,
      action: action.join('；') || '平稳推进，适时调整',
    };
  }

  /**
   * 综合结论
   */
  private static makeConclusion(
    natal: any,
    decennial: any,
    annual: any,
    palaceFocus: any
  ) {
    // 总体结论
    const overall = this.generateOverallConclusion(natal, decennial, annual);

    // 成功概率
    const probability = this.assessProbability(natal, decennial, annual);

    // 潜在障碍
    const obstacles = this.identifyObstacles(natal, decennial, annual);

    // 机会点
    const opportunities = this.identifyOpportunities(natal, decennial, annual);

    return {
      overall,
      probability,
      obstacles,
      opportunities,
    };
  }

  /**
   * 生成总体结论
   */
  private static generateOverallConclusion(natal: any, decennial: any, annual: any): string {
    const parts: string[] = [];

    parts.push(`原局基础${natal.score}分`);

    if (decennial.score >= 60) {
      parts.push(`大限${decennial.score}分（${decennial.activation}）`);
    }

    if (annual.score >= 60) {
      parts.push(`流年${annual.score}分（${annual.trigger}）`);
    }

    return parts.join('，');
  }

  /**
   * 评估成功概率
   */
  private static assessProbability(natal: any, decennial: any, annual: any): string {
    const avgScore = (natal.score + decennial.score + annual.score) / 3;

    if (avgScore >= 75) {
      return '成功率较高，可积极进取';
    } else if (avgScore >= 60) {
      return '成功率中等，需要努力把握';
    } else if (avgScore >= 45) {
      return '成功率偏低，需要谨慎评估';
    } else {
      return '成功率较低，建议暂缓或调整方向';
    }
  }

  /**
   * 识别潜在障碍
   */
  private static identifyObstacles(natal: any, decennial: any, annual: any): string[] {
    const obstacles: string[] = [];

    if (natal.score < 50) {
      obstacles.push('原局基础偏弱，先天条件不足');
    }

    if (decennial.hua?.ji) {
      obstacles.push(`大限化忌${decennial.hua.ji}，这十年有阻滞`);
    }

    if (annual.hua?.ji) {
      obstacles.push(`流年化忌${annual.hua.ji}，今年需防范风险`);
    }

    return obstacles;
  }

  /**
   * 识别机会点
   */
  private static identifyOpportunities(natal: any, decennial: any, annual: any): string[] {
    const opportunities: string[] = [];

    if (natal.protection.length > 0) {
      opportunities.push(`原局有护佑格局：${natal.protection.map((p: any) => p.name).join('、')}`);
    }

    if (decennial.hua.lu || decennial.hua.ke) {
      opportunities.push('当前大限吉化，机遇期');
    }

    if (annual.hua.lu) {
      opportunities.push('今年流年化禄，是行动良机');
    }

    return opportunities;
  }

  /**
   * 生成调整建议（根据实际分析结果动态生成）
   */
  private static generateAdvice(natal: any, decennial: any, annual: any, conclusion: any) {
    const strategy: string[] = [];
    const timing: string[] = [];
    const action: string[] = [];

    // 策略建议
    strategy.push(natal.score >= 60 ? '原局基础好，可以积极进取' : '原局基础偏弱，稳扎稳打更稳妥');

    if (decennial.hua.ji) {
      strategy.push(`大限${decennial.hua.ji}化忌期间宜保守，等待时机`);
    } else if (decennial.hua.lu) {
      strategy.push(`大限${decennial.hua.lu}化禄，把握机遇期乘势而上`);
    }

    if (annual.hua.lu) {
      strategy.push(`今年${annual.hua.lu}化禄，是行动良机`);
    } else if (annual.hua.ji) {
      strategy.push(`今年${annual.hua.ji}化忌，谨慎行事`);
    }

    // 时机建议
    if (natal.protection.length > 0) {
      timing.push(`${natal.protection.map((p: any) => p.name).join('、')}护佑，凶限时能守住底线`);
    }

    if (decennial.hua.lu || decennial.hua.ke) {
      timing.push('当前大限有吉化，适合推进事项');
    } else {
      timing.push('当前大限平稳，按部就班');
    }

    if (annual.hua.lu) {
      timing.push('今年有化禄，是最佳行动时机');
    }

    // 行动建议
    if (conclusion.probability.includes('较高')) {
      action.push('条件有利，可以主动出击');
    } else if (conclusion.probability.includes('较低')) {
      action.push('建议暂缓或调整方向，避免硬冲');
    } else {
      action.push('把握机会的同时保持审慎');
    }

    if (conclusion.obstacles.length > 0) {
      action.push('重点关注潜在障碍，提前做好应对准备');
    }

    if (conclusion.opportunities.length > 0) {
      action.push('善用机会点，尤其是护佑格局和吉化期');
    }

    action.push('保持耐心，关注时机窗口');

    return { strategy, timing, action };
  }

  /**
   * 生成总体判断
   */
  private static generateOverview(affair: string, conclusion: any): string {
    return `关于「${affair}」的分析：${conclusion.overall}。${conclusion.probability}。`;
  }

  /**
   * 获取问诊清单
   */
  static getDiagnosticQuestions(affairType: AffairType): string[] {
    return DIAGNOSTIC_QUESTIONS[affairType] || [];
  }

  /**
   * 获取事项宫位映射
   */
  static getPalaceMapping(affairType: AffairType): {
    primary: PalaceName;
    secondary: PalaceName[];
  } {
    return AFFAIR_PALACE_MAPPING[affairType];
  }
}
