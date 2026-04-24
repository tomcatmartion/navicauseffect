/**
 * 互动关系分析器
 * 以太岁入卦技法为核心，通过三维合参分析命主与特定对象的互动心态与关系模式
 */

import type {
  Chart,
  InteractionAnalysis,
  RelationType,
  HuaInteraction,
  PalaceName,
  Branch,
  Stem,
  Decennial,
  Annual,
  StarName,
} from '../types';
import { getHuaByStem } from '../data/fiveTiger';
import { getStarType } from '../data/starData';
import { getOppositeBranch, getTriadBranches, getFlankBranches } from '../utils/spatial';
import { PalaceAssessor } from './PalaceAssessor';
import { PersonalityAnalyzer } from './PersonalityAnalyzer';
import { ChartEngine } from './ChartEngine';

/**
 * 互动关系分析器类
 */
export class InteractionAnalyzer {
  /**
   * 分析互动关系
   */
  static analyze(params: {
    selfChart: Chart;
    targetYear: { stem: Stem; branch: Branch };
    targetName?: string;
    relationType?: RelationType;
    currentDecennial?: Decennial;
    currentAnnual?: Annual;
  }): InteractionAnalysis {
    const {
      selfChart,
      targetYear,
      targetName = '对方',
      relationType = '其他',
      currentDecennial,
      currentAnnual,
    } = params;

    // 建立虚拟命盘（太岁入卦）
    const virtualChart = ChartEngine.createVirtualChart(selfChart, targetYear);

    // 获取命主性格底色
    const personality = PersonalityAnalyzer.analyze(selfChart);

    // 三维合参
    const threeDimensions = this.threeDimensionsAnalysis({
      selfChart,
      virtualChart,
      targetYear,
      currentDecennial,
      currentAnnual,
    });

    // 四化互动
    const huaInteractions = this.analyzeHuaInteractions(
      selfChart,
      virtualChart,
      targetYear
    );

    // 引动星曜互动
    const starInteractions = this.analyzeStarInteractions(
      selfChart,
      virtualChart
    );

    // 综合判断
    const conclusion = this.makeConclusion(
      threeDimensions,
      huaInteractions,
      personality
    );

    // 建议
    const advice = this.generateAdvice(
      threeDimensions,
      huaInteractions,
      conclusion
    );

    // 风险预警
    const warnings = this.generateWarnings(
      threeDimensions,
      huaInteractions
    );

    // 总体画像
    const overview = this.generateOverview(
      threeDimensions,
      conclusion,
      relationType
    );

    return {
      overview,
      participants: {
        self: {
          name: '命主',
          year: selfChart.lunar.year,
        },
        other: {
          name: targetName,
          year: targetYear,
        },
      },
      relationType,
      threeDimensions,
      huaInteractions,
      starInteractions,
      conclusion,
      advice,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 三维合参分析
   */
  private static threeDimensionsAnalysis(params: {
    selfChart: Chart;
    virtualChart: Chart;
    targetYear: { stem: Stem; branch: Branch };
    currentDecennial?: Decennial;
    currentAnnual?: Annual;
  }) {
    const { selfChart, virtualChart, targetYear, currentDecennial, currentAnnual } = params;

    // 空间维度（对方四化）
    const spatial = this.analyzeSpatialDimension(virtualChart, selfChart);

    // 个人维度（命主底色）
    const personal = this.analyzePersonalDimension(selfChart, virtualChart);

    // 时间维度（大限流年）
    const temporal = this.analyzeTemporalDimension(
      selfChart,
      virtualChart,
      currentDecennial,
      currentAnnual
    );

    return {
      spatial: {
        description: this.summarizeSpatial(spatial),
        early: spatial.early,
        deep: spatial.deep,
      },
      personal: {
        description: this.summarizePersonal(personal),
        capacity: personal.capacity,
        response: personal.response,
      },
      temporal: {
        description: this.summarizeTemporal(temporal),
        current: temporal.current,
        trend: temporal.trend,
      },
    };
  }

  /**
   * 空间维度分析（对方四化）
   */
  private static analyzeSpatialDimension(virtualChart: Chart, selfChart: Chart) {
    const targetHua = getHuaByStem(virtualChart.palaces[virtualChart.mingPalace].stem!);

    // 早期/表层（生年四化）
    const earlyParts: string[] = [];
    if (targetHua.lu) earlyParts.push(`${targetHua.lu}化禄：进入关系顺畅`);
    if (targetHua.quan) earlyParts.push(`${targetHua.quan}化权：带有主导意识`);
    if (targetHua.ke) earlyParts.push(`${targetHua.ke}化科：注重形象`);
    if (targetHua.ji) earlyParts.push(`${targetHua.ji}化忌：进入关系有执念`);

    // 深层/晚期（遁干四化）
    const deepParts: string[] = [];
    // 这里需要更复杂的逻辑来获取遁干四化
    // 简化处理
    if (deepParts.length === 0) {
      deepParts.push('深层影响需结合大限流年分析');
    }

    return {
      early: earlyParts.join('；') || '无明显早期特征',
      deep: deepParts.join('；') || '无明显深层特征',
    };
  }

  /**
   * 个人维度分析（命主底色）
   */
  private static analyzePersonalDimension(selfChart: Chart, virtualChart: Chart) {
    const mingPalace = selfChart.palaces[selfChart.mingPalace];
    const mingAssessment = PalaceAssessor.assessOne(selfChart, selfChart.mingPalace);

    // 承载力
    let capacity = '一般';
    if (mingAssessment.finalScore >= 6.0) {
      capacity = '强，能承载对方强势能量';
    } else if (mingAssessment.finalScore < 4.0) {
      capacity = '弱，易受对方影响';
    }

    // 回应方式
    const response: string[] = [];
    if (mingPalace.strength === '旺' || mingPalace.strength === '极旺') {
      response.push('积极回应，主导互动');
    } else if (mingPalace.strength === '陷' || mingPalace.strength === '极弱') {
      response.push('被动接受，易受影响');
    } else {
      response.push('平和回应，适度互动');
    }

    return { capacity, response: response.join('；') };
  }

  /**
   * 时间维度分析（大限流年）
   */
  private static analyzeTemporalDimension(
    selfChart: Chart,
    virtualChart: Chart,
    currentDecennial?: Decennial,
    currentAnnual?: Annual
  ) {
    const current: string[] = [];
    const trend: string[] = [];

    if (currentDecennial) {
      const decennialHua = currentDecennial.hua;
      if (decennialHua.lu) current.push('大限化禄：关系顺畅期');
      if (decennialHua.ji) current.push('大限化忌：关系紧张期');
    }

    if (currentAnnual) {
      const annualHua = currentAnnual.hua;
      if (annualHua.lu) trend.push('流年化禄：今年关系有机会推进');
      if (annualHua.ji) trend.push('流年化忌：今年关系需谨慎处理');
    }

    return {
      current: current.join('；') || '平稳期',
      trend: trend.join('；') || '维持现状',
    };
  }

  /**
   * 四化互动分析
   */
  private static analyzeHuaInteractions(
    selfChart: Chart,
    virtualChart: Chart,
    targetYear: { stem: Stem; branch: Branch }
  ): HuaInteraction[] {
    const interactions: HuaInteraction[] = [];

    // 获取对方四化
    const targetHua = getHuaByStem(targetYear.stem);

    // 检查四化星落入命主哪些宫位
    const huaTypes: Array<keyof typeof targetHua> = ['lu', 'quan', 'ke', 'ji'];

    for (const huaType of huaTypes) {
      const starName = targetHua[huaType];
      if (!starName) continue;

      // 查找该星在命主命盘中的位置
      for (const branch of Object.keys(selfChart.palaces) as Branch[]) {
        const palace = selfChart.palaces[branch];
        if (palace.stars.some(s => s.name === starName)) {
          const effect = this.getHuaEffect(huaType, palace.strength);
          const interpretation = this.getHuaInterpretation(
            huaType,
            starName,
            palace.name,
            palace.strength
          );

          interactions.push({
            star: starName as StarName,
            huaType,
            source: 'other',
            targetPalace: palace.name,
            interpretation,
            effect,
          });
        }
      }
    }

    return interactions;
  }

  /**
   * 获取四化效果
   */
  private static getHuaEffect(
    huaType: string,
    strength: string
  ): 'positive' | 'negative' | 'mixed' {
    if (huaType === 'lu' || huaType === 'ke') {
      return 'positive';
    }
    if (huaType === 'ji') {
      // 化忌在旺宫是专注，在陷宫是执念成灾
      if (strength === '旺' || strength === '极旺') {
        return 'mixed';
      }
      return 'negative';
    }
    return 'mixed';
  }

  /**
   * 获取四化解读
   */
  private static getHuaInterpretation(
    huaType: string,
    starName: string,
    palaceName: string,
    strength: string
  ): string {
    const huaName = { lu: '化禄', quan: '化权', ke: '化科', ji: '化忌' }[huaType];

    if (huaType === 'lu') {
      return `${starName}${huaName}入${palaceName}，对方给此宫注入顺畅能量，激发命主在该层面的喜悦特质`;
    }
    if (huaType === 'quan') {
      return `${starName}${huaName}入${palaceName}，对方授权命主在该层面强势主导`;
    }
    if (huaType === 'ke') {
      return `${starName}${huaName}入${palaceName}，对方激发命主在该层面的理性与名声意识`;
    }
    if (huaType === 'ji') {
      if (strength === '旺' || strength === '极旺') {
        return `${starName}${huaName}入${palaceName}，虽化忌但宫位旺，表现为专注执着`;
      }
      return `${starName}${huaName}入${palaceName}，对方在此宫激发命主的执念与阻滞`;
    }

    return '';
  }

  /**
   * 引动星曜互动分析
   */
  private static analyzeStarInteractions(
    selfChart: Chart,
    virtualChart: Chart
  ) {
    const interactions: {
      star: StarName;
      position: PalaceName;
      interpretation: string;
    }[] = [];

    // 分析禄存、擎羊、陀罗、天魁、天钺等引动星
    const keyStars = ['禄存', '擎羊', '陀罗', '天魁', '天钺', '红鸾', '天喜'];

    for (const starName of keyStars) {
      // 在虚拟命盘中查找该星
      for (const branch of Object.keys(virtualChart.palaces) as Branch[]) {
        const palace = virtualChart.palaces[branch];
        if (palace.stars.some(s => s.name === starName)) {
          const interpretation = this.getKeyStarInterpretation(
            starName,
            palace.name,
            palace.strength
          );
          interactions.push({
            star: starName as StarName,
            position: palace.name,
            interpretation,
          });
        }
      }
    }

    return interactions;
  }

  /**
   * 获取引动星解读
   */
  private static getKeyStarInterpretation(
    starName: string,
    palaceName: string,
    strength: string
  ): string {
    const interpretations: Record<string, string> = {
      '禄存': '对方带入稳定资源，进入关系有底气',
      '擎羊': strength === '旺'
        ? '对方行事果决有魄力，在关系中带来冲劲'
        : '对方在关系中有冲动莽撞倾向，须防明灾',
      '陀罗': strength === '旺'
        ? '对方在关系中坚韧磨砺，百折不挠'
        : '对方在关系中固执内耗，纠缠拖延',
      '天魁': '对方有贵气，能给予命主支持和认同',
      '天钺': '对方有贵气，能在困难时给予命主帮助',
      '红鸾': '对方对这段关系有真实感情投入',
      '天喜': '对方对这段关系有喜悦期待',
    };

    return interpretations[starName] || '';
  }

  /**
   * 综合判断
   */
  private static makeConclusion(
    threeDimensions: any,
    huaInteractions: HuaInteraction[],
    personality: any
  ) {
    // 计算匹配度
    let compatibility = 50; // 基础分

    // 根据四化互动调整
    const positiveHua = huaInteractions.filter(h => h.effect === 'positive').length;
    const negativeHua = huaInteractions.filter(h => h.effect === 'negative').length;
    compatibility += positiveHua * 10 - negativeHua * 10;

    // 限制范围
    compatibility = Math.max(0, Math.min(100, compatibility));

    // 化学反应描述
    const chemistry = this.generateChemistry(threeDimensions, huaInteractions);

    // 发展潜力
    const potential = this.generatePotential(threeDimensions, personality);

    // 潜在风险
    const risk = this.generateRisk(threeDimensions, huaInteractions);

    return {
      compatibility,
      chemistry,
      potential,
      risk,
    };
  }

  /**
   * 生成化学反应描述
   */
  private static generateChemistry(
    threeDimensions: any,
    huaInteractions: HuaInteraction[]
  ): string {
    const parts: string[] = [];

    if (threeDimensions.spatial.early.includes('化禄')) {
      parts.push('对方化禄入命，相处顺畅');
    }
    if (threeDimensions.personal.capacity.includes('强')) {
      parts.push('命主承载力强，能接纳对方');
    }

    return parts.length > 0 ? parts.join('；') : '平淡相处，无强烈化学反应';
  }

  /**
   * 生成发展潜力
   */
  private static generatePotential(threeDimensions: any, personality: any): string {
    if (threeDimensions.temporal.current.includes('顺畅期')) {
      return '当前时机有利，关系可积极推进';
    } else if (threeDimensions.temporal.current.includes('紧张期')) {
      return '当前时机不利，宜保守观望';
    }
    return '平稳发展，需双方共同努力';
  }

  /**
   * 生成风险描述
   */
  private static generateRisk(
    threeDimensions: any,
    huaInteractions: HuaInteraction[]
  ): string {
    const negativeHua = huaInteractions.filter(h => h.effect === 'negative');
    if (negativeHua.length > 0) {
      return `存在${negativeHua.length}个潜在冲突点，需谨慎处理`;
    }
    return '无明显风险';
  }

  /**
   * 生成建议
   */
  private static generateAdvice(
    threeDimensions: any,
    huaInteractions: HuaInteraction[],
    conclusion: any
  ): string[] {
    const advice: string[] = [];

    // 根据匹配度给出建议
    if (conclusion.compatibility >= 70) {
      advice.push('双方匹配度高，可以深入发展');
    } else if (conclusion.compatibility >= 50) {
      advice.push('匹配度中等，需要相互包容');
    } else {
      advice.push('匹配度偏低，建议谨慎考虑');
    }

    // 根据四化互动给出建议
    const hasJi = huaInteractions.some(h => h.huaType === 'ji');
    if (hasJi) {
      advice.push('存在执念阻滞，需要耐心沟通化解');
    }

    return advice;
  }

  /**
   * 生成风险预警
   */
  private static generateWarnings(
    threeDimensions: any,
    huaInteractions: HuaInteraction[]
  ): string[] {
    const warnings: string[] = [];

    // 检查是否有忌煞交冲
    const jiInMing = huaInteractions.some(
      h => h.huaType === 'ji' && h.targetPalace === '命宫'
    );
    if (jiInMing) {
      warnings.push('对方化忌冲命宫，执念直接冲击命主整体状态，需特别注意');
    }

    return warnings;
  }

  /**
   * 生成总体画像
   */
  private static generateOverview(
    threeDimensions: any,
    conclusion: any,
    relationType: RelationType
  ): string {
    const parts: string[] = [];

    parts.push(`匹配度${conclusion.compatibility}%`);

    if (conclusion.chemistry) {
      parts.push(conclusion.chemistry);
    }

    return parts.join('，');
  }

  /**
   * 总结空间维度
   */
  private static summarizeSpatial(spatial: any): string {
    return `早期：${spatial.early.join('；')} | 深层：${spatial.deep.join('；')}`;
  }

  /**
   * 总结个人维度
   */
  private static summarizePersonal(personal: any): string {
    return `承载力：${personal.capacity} | 回应：${personal.response}`;
  }

  /**
   * 总结时间维度
   */
  private static summarizeTemporal(temporal: any): string {
    return `当前：${temporal.current} | 趋势：${temporal.trend}`;
  }
}
