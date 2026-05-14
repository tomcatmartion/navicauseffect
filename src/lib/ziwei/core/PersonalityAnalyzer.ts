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
   * 从宫位提取特质（主星+辅星+四化+旺弱）
   */
  private static extractPalaceTraits(palace: any): string[] {
    const traits: string[] = [];

    // 根据所有星曜提取特质
    for (const star of palace.stars) {
      const starTraits = this.getStarTraits(star.name);
      if (starTraits.length > 0) {
        traits.push(...starTraits);
      }

      // 四化对性格的修饰
      if (star.huaType === 'lu') {
        traits.push(`${star.name}化禄：圆融顺畅`);
      } else if (star.huaType === 'quan') {
        traits.push(`${star.name}化权：强势主导`);
      } else if (star.huaType === 'ke') {
        traits.push(`${star.name}化科：理性清晰`);
      } else if (star.huaType === 'ji') {
        traits.push(`${star.name}化忌：执着纠结`);
      }
    }

    // 根据旺弱提取特质
    const strength = palace.strength;
    if (strength === PalaceStrength.Strong || strength === PalaceStrength.ExtremelyStrong) {
      traits.push('积极主动', '自信坚定');
    } else if (strength === PalaceStrength.Weak || strength === PalaceStrength.ExtremelyWeak) {
      traits.push('谨慎保守', '易受影响');
    } else if (strength === PalaceStrength.Empty) {
      traits.push('多变适应', '借力行事');
    }

    return traits;
  }

  /**
   * 获取星曜特质（含主星和辅星）
   */
  private static getStarTraits(starName: string): string[] {
    const traitsMap: Record<string, string[]> = {
      // 十四主星
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
      // 六吉星
      '左辅': ['善于辅佐', '人缘佳', '乐于助人'],
      '右弼': ['善于协调', '包容力强', '柔顺配合'],
      '文昌': ['文思敏捷', '重学识', '条理分明'],
      '文曲': ['才艺出众', '口才伶俐', '灵感丰富'],
      '天魁': ['贵人运强', '遇难呈祥', '品味不凡'],
      '天钺': ['贵人相助', '机缘巧合', '温文尔雅'],
      // 六煞星（性格面）
      '擎羊': ['刚烈果断', '争强好胜', '刑伤冲动'],
      '陀罗': ['固执拖延', '纠缠不放', '暗耗精力'],
      '火星': ['急躁冲动', '爆发力强', '暴起暴落'],
      '铃星': ['阴柔暗忍', '持续施压', '暗火燃烧'],
      '地空': ['精神追求', '想法超脱', '空想不实'],
      '地劫': ['破坏重建', '波动大', '得失无常'],
      // 禄存
      '禄存': ['珍惜资源', '稳重保守', '善于积累'],
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

    // 主星（含四化标记）
    const majorStars = palace.stars
      .filter((s: any) => s.type === 'major')
      .map((s: any) => {
        const huaLabel = s.huaType === 'lu' ? '禄' : s.huaType === 'quan' ? '权' : s.huaType === 'ke' ? '科' : s.huaType === 'ji' ? '忌' : '';
        return huaLabel ? `${s.name}${huaLabel}` : s.name;
      });
    if (majorStars.length > 0) {
      parts.push(`主星：${majorStars.join('、')}`);
    }

    // 评分
    parts.push(`评分：${assessment.finalScore.toFixed(1)}`);

    // 制煞/逞凶 — 在 advantages 中搜索"制煞"
    const hasControlSha = assessment.interpretation.advantages.some(a => a.includes('制煞'));
    const hasAggressive = assessment.interpretation.disadvantages.some(d => d.includes('逞凶'));
    if (hasControlSha) {
      parts.push('制煞有力');
    }
    if (hasAggressive) {
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
   * 命宫全息底色分析（使用生年四化）
   */
  private static mingHolographicAnalysis(chart: Chart) {
    const mingPalace = getMingPalace(chart);

    // 使用生年四化（chart.birthHua），而非宫干飞化
    const birthHua = chart.birthHua;

    // 检查命宫各星曜的四化状态
    const huaLuStar = mingPalace.stars.find(s => s.huaType === 'lu');
    const huaQuanStar = mingPalace.stars.find(s => s.huaType === 'quan');
    const huaKeStar = mingPalace.stars.find(s => s.huaType === 'ke');
    const huaJiStar = mingPalace.stars.find(s => s.huaType === 'ji');

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
        lu: huaLuStar ? `${huaLuStar.name}化禄：顺畅圆融` : undefined,
        quan: huaQuanStar ? `${huaQuanStar.name}化权：强势主导` : undefined,
        ke: huaKeStar ? `${huaKeStar.name}化科：理性清晰` : undefined,
        ji: huaJiStar ? `${huaJiStar.name}化忌：执念阻滞` : undefined,
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

    // 压力下行为 — 在 disadvantages 中搜索"逞凶"
    if (mingAssessment.interpretation.disadvantages.some(d => d.includes('逞凶'))) {
      stress.push('压力下易冲动', '情绪化反应', '需要疏导');
    } else if (mingAssessment.finalScore >= 6.0) {
      stress.push('压力下更冷静', '能理性应对', '抗压性强');
    } else {
      stress.push('压力下易退缩', '需要支持', '保守应对');
    }

    return { proactive, reactive, stress };
  }

  /**
   * 优势与劣势分析（基于三宫合参，不只是复制宫位评估）
   */
  private static analyzeStrengthsWeaknesses(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const shenPalace = getShenPalace(chart);
    const taiSuiPalace = getTaiSuiPalace(chart);

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // 从三宫主星收集优势/劣势
    const keyPalaces = [
      { name: '命宫', palace: mingPalace, assessment: assessments[mingPalace.branch] },
      { name: '身宫', palace: shenPalace, assessment: shenPalace ? assessments[shenPalace.branch] : undefined },
      { name: '太岁宫', palace: taiSuiPalace, assessment: assessments[taiSuiPalace.branch] },
    ];

    for (const { name, palace, assessment } of keyPalaces) {
      if (!palace || !assessment) continue;

      // 四化带来的优势
      for (const star of palace.stars) {
        if (star.huaType === 'lu') {
          strengths.push(`${name}${star.name}化禄，行事顺畅`);
        } else if (star.huaType === 'quan') {
          strengths.push(`${name}${star.name}化权，掌控力强`);
        } else if (star.huaType === 'ke') {
          strengths.push(`${name}${star.name}化科，声名助力`);
        } else if (star.huaType === 'ji') {
          weaknesses.push(`${name}${star.name}化忌，执着纠结`);
        }
      }

      // 旺弱带来的特质
      if (assessment.finalScore >= 7.0) {
        strengths.push(`${name}旺强，根基稳固`);
      } else if (assessment.finalScore < 4.0) {
        weaknesses.push(`${name}偏弱，需外力辅助`);
      }

      // 制煞/逞凶
      const hasControlSha = assessment.interpretation.advantages.some(a => a.includes('制煞'));
      const hasAggressive = assessment.interpretation.disadvantages.some(d => d.includes('逞凶'));
      if (hasControlSha) {
        strengths.push(`${name}制煞有力，能化解煞星负面影响`);
      }
      if (hasAggressive) {
        weaknesses.push(`${name}逞凶，煞星负面影响放大`);
      }
    }

    // 去重
    return {
      strengths: [...new Set(strengths)],
      weaknesses: [...new Set(weaknesses)],
    };
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
   * 生成发展建议（基于命宫主星和四化组合）
   */
  private static generateAdvice(
    chart: Chart,
    assessments: Record<Branch, PalaceAssessment>
  ) {
    const mingPalace = getMingPalace(chart);
    const mingAssessment = assessments[mingPalace.branch];
    const majorStars = mingPalace.stars.filter(s => s.type === 'major').map(s => s.name);
    const hasHuaJi = mingPalace.stars.some(s => s.huaType === 'ji');
    const hasHuaLu = mingPalace.stars.some(s => s.huaType === 'lu');

    // 总体建议继承自宫位评估
    const overall = mingAssessment.interpretation.advice;

    // 根据主星组合给出事业建议
    let career = '';
    if (majorStars.includes('紫微') || majorStars.includes('天府')) {
      career = '具有领导天赋，适合管理岗位或自主创业';
    } else if (majorStars.includes('天机') || majorStars.includes('太阴')) {
      career = '思维细腻，适合策划、研究、技术咨询类工作';
    } else if (majorStars.includes('太阳') || majorStars.includes('天梁')) {
      career = '热忱正直，适合教育、公益、公共服务领域';
    } else if (majorStars.includes('武曲') || majorStars.includes('七杀')) {
      career = '行动力强，适合金融、开拓型或竞争性工作';
    } else if (majorStars.includes('贪狼') || majorStars.includes('廉贞')) {
      career = '多才多艺，适合创意、销售、人际密集型工作';
    } else if (majorStars.includes('天同') || majorStars.includes('天相')) {
      career = '协调力佳，适合行政、人事、服务支持类工作';
    } else if (majorStars.includes('巨门') || majorStars.includes('破军')) {
      career = '口才或突破力强，适合法律、传媒或创新型工作';
    } else {
      career = mingAssessment.finalScore >= 6.0
        ? '命宫旺强，可承担主导型工作'
        : '命宫偏弱，宜选择稳定环境逐步发展';
    }

    // 感情建议
    let relationship = '';
    if (hasHuaJi) {
      const jiStar = mingPalace.stars.find(s => s.huaType === 'ji');
      relationship = `${jiStar?.name ?? '某星'}化忌影响情感表达，宜学会放下执念，多沟通`;
    } else if (majorStars.includes('贪狼') || majorStars.includes('廉贞')) {
      relationship = '桃花缘旺，感情丰富，需注意专一与边界';
    } else if (majorStars.includes('七杀') || majorStars.includes('破军')) {
      relationship = '个性强势，感情中宜多包容和退让';
    } else {
      relationship = hasHuaLu
        ? '化禄入命，人缘好，感情发展顺畅'
        : '感情发展顺其自然，注意相互理解';
    }

    // 健康建议
    let health = '';
    if (mingAssessment.finalScore < 4.0) {
      health = '命宫偏弱，抵抗力较差，注意规律作息和定期体检';
    } else if (hasHuaJi) {
      health = '化忌入命，需注意情绪健康，避免压力积攒';
    } else {
      health = '精力充沛，注意劳逸结合';
    }

    return { overall, career, relationship, health };
  }
}
