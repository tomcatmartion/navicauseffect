/**
 * 紫微斗数引擎统一入口
 * 提供简洁的 API 接口
 */

import { ChartEngine } from './ChartEngine';
import { PalaceAssessor } from './PalaceAssessor';
import { PersonalityAnalyzer } from './PersonalityAnalyzer';
import { InteractionAnalyzer } from './InteractionAnalyzer';
import { AffairAnalyzer } from './AffairAnalyzer';
import { checkAllPatterns } from '../data/patterns';
import type {
  Chart,
  Gender,
  PalaceAssessment,
  PersonalityProfile,
  InteractionAnalysis,
  AffairAnalysis,
  AffairType,
  RelationType,
  Branch,
  Stem,
  PatternMatch,
} from '../types';

/**
 * 紫微斗数引擎类
 * 提供统一的解盘 API
 */
export class ZiweiEngine {
  /**
   * 创建命盘
   */
  static createChart(params: {
    gender: Gender;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute?: number;
    solar?: boolean;
  }): Chart {
    return ChartEngine.create(params);
  }

  /**
   * 评估单个宫位能级
   */
  static assessPalace(chart: Chart, palaceBranch: Branch): PalaceAssessment {
    return PalaceAssessor.assessOne(chart, palaceBranch);
  }

  /**
   * 评估所有宫位能级
   */
  static assessAllPalaces(chart: Chart): Record<Branch, PalaceAssessment> {
    return PalaceAssessor.assessAll(chart);
  }

  /**
   * 分析性格
   */
  static analyzePersonality(chart: Chart): PersonalityProfile {
    return PersonalityAnalyzer.analyze(chart);
  }

  /**
   * 分析互动关系
   */
  static analyzeInteraction(params: {
    selfChart: Chart;
    targetYear: { stem: Stem; branch: Branch };
    targetName?: string;
    relationType?: RelationType;
    currentAge?: number;
    currentAnnualYear?: number;
  }): InteractionAnalysis {
    return InteractionAnalyzer.analyze(params);
  }

  /**
   * 分析事项
   */
  static analyzeAffair(params: {
    chart: Chart;
    affair: string;
    affairType?: AffairType;
    currentAge?: number;
    targetYear?: number;
  }): AffairAnalysis {
    return AffairAnalyzer.analyze(params);
  }

  /**
   * 完整解盘
   */
  static fullAnalysis(params: {
    chart: Chart;
    includePersonality?: boolean;
    currentAge?: number;
    targetYear?: number;
  }) {
    const { chart, includePersonality = true, currentAge, targetYear } = params;

    const result: any = {
      chart: {
        id: chart.id,
        gender: chart.gender,
        birth: chart.birth,
      },
      assessments: this.assessAllPalaces(chart),
    };

    if (includePersonality) {
      result.personality = this.analyzePersonality(chart);
    }

    return result;
  }

  /**
   * 检查格局
   */
  static checkPatterns(
    chart: Chart,
    type?: 'natal' | 'decennial' | 'annual'
  ): PatternMatch[] {
    return checkAllPatterns(chart, type);
  }
}

// 导出便捷函数
export const createChart = ZiweiEngine.createChart.bind(ZiweiEngine);
export const assessPalace = ZiweiEngine.assessPalace.bind(ZiweiEngine);
export const assessAllPalaces = ZiweiEngine.assessAllPalaces.bind(ZiweiEngine);
export const analyzePersonality = ZiweiEngine.analyzePersonality.bind(ZiweiEngine);
export const analyzeInteraction = ZiweiEngine.analyzeInteraction.bind(ZiweiEngine);
export const analyzeAffair = ZiweiEngine.analyzeAffair.bind(ZiweiEngine);
