/**
 * 命盘引擎
 * 封装 iztro 库，提供命盘创建、解析、查询等功能
 */

import { astro } from 'iztro';
import type {
  Chart,
  Palace,
  Star,
  Decennial,
  Annual,
  Branch,
  Stem,
  PalaceName,
  Hua,
  HuaType,
} from '../types';
import {
  Gender,
  PalaceStrength,
  StarType,
  BRANCH_ORDER,
  BRANCH_INDEX,
  PALACE_ORDER,
  PALACE_INDEX,
} from '../types';
import { getPalaceBranches, getPalaceNameByBranch } from '../utils/spatial';
import { calculateDecennials, calculateAnnual } from '../utils/decennial';
import { getDunGan, getHuaByStem, getYearStemBranch } from '../data/fiveTiger';
import { getSkeletonIndexByMingPalace, getPalaceStrength, getBaseScore } from '../data/skeletonMapping';
import { getStarType } from '../data/starData';

// iztro Astrolabe 类型定义（简化版）
interface IztroAstrolabe {
  solarDate?: { year: number; month: number; day: number };
  lunarMonth?: number;
  lunarDay?: number;
  hour?: number;
  palaces?: Array<{
    earthlyBranch?: string;
    isBodyPalace?: boolean;
    majorStars?: Array<{ name: string; brightness?: number }>;
    minorStars?: Array<{ name: string; brightness?: number }>;
    adjectiveStars?: Array<{ name: string; brightness?: number }>;
  }>;
}

/**
 * 命盘引擎类
 */
export class ChartEngine {
  /**
   * 创建命盘
   * @param params 出生信息
   * @returns 完整命盘数据
   */
  static create(params: {
    gender: Gender;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute?: number;
    solar?: boolean; // 默认阳历
  }): Chart {
    const { gender, year, month, day, hour, minute = 0, solar = true } = params;

    // 使用 iztro 创建命盘
    const genderStr = gender === Gender.Male ? '男' : '女';
    // 格式化日期为 YYYY-MM-DD
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const astrolabe = solar
      ? astro.bySolar(dateStr, hour, genderStr)
      : astro.byLunar(dateStr, hour, genderStr);

    return this.fromIztro(astrolabe as any, gender);
  }

  /**
   * 从 iztro Astrolabe 转换为我们的 Chart 类型
   */
  private static fromIztro(astrolabe: IztroAstrolabe, gender: Gender): Chart {
    // 获取命宫地支
    const mingPalace = this.getMingPalaceBranch(astrolabe);

    // 获取出生年干支
    const lunarYear = astrolabe.solarDate?.year || new Date().getFullYear();
    const yearStemBranch = getYearStemBranch(lunarYear);

    // 确定骨架序号
    const majorStars = this.extractMajorStars(astrolabe);
    const skeletonIndex = getSkeletonIndexByMingPalace(mingPalace, majorStars);

    // 构建十二宫
    const palaces = this.buildPalaces(astrolabe, mingPalace, skeletonIndex, yearStemBranch.stem);

    // 获取生年四化
    const birthHua = getHuaByStem(yearStemBranch.stem);

    return {
      id: this.generateChartId(gender, lunarYear, astrolabe),
      gender,
      birth: {
        year: lunarYear,
        month: astrolabe.lunarMonth || 1,
        day: astrolabe.lunarDay || 1,
        hour: astrolabe.hour || 1,
        minute: 0,
      },
      lunar: {
        year: yearStemBranch,
        month: astrolabe.lunarMonth || 1,
        day: astrolabe.lunarDay || 1,
      },
      solar: {
        year: yearStemBranch,
        month: astrolabe.solarDate?.month || 1,
        day: astrolabe.solarDate?.day || 1,
      },
      palaces,
      mingPalace,
      shenPalace: this.getShenPalaceBranch(astrolabe),
      taiSuiPalace: yearStemBranch.branch,
      skeletonIndex,
      birthHua,
      decennialLimit: 0, // 需要额外计算
    };
  }

  /**
   * 生成命盘唯一ID
   */
  private static generateChartId(gender: Gender, year: number, astrolabe: IztroAstrolabe): string {
    const dateStr = `${year}${astrolabe.lunarMonth}${astrolabe.lunarDay}${astrolabe.hour}`;
    return `ziwei_${gender}_${dateStr}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取命宫地支
   */
  private static getMingPalaceBranch(astrolabe: IztroAstrolabe): Branch {
    // 从 iztro 的命宫信息中提取
    const mingPalaceInfo = astrolabe.palaces?.[0];
    if (mingPalaceInfo?.earthlyBranch) {
      return mingPalaceInfo.earthlyBranch as Branch;
    }

    // 默认返回子
    return '子';
  }

  /**
   * 获取身宫地支
   */
  private static getShenPalaceBranch(astrolabe: IztroAstrolabe): Branch | undefined {
    // 从 iztro 中查找身宫
    for (const palace of astrolabe.palaces || []) {
      if (palace.isBodyPalace) {
        return palace.earthlyBranch as Branch;
      }
    }
    return undefined;
  }

  /**
   * 提取所有主星名称
   */
  private static extractMajorStars(astrolabe: IztroAstrolabe): string[] {
    const stars: string[] = [];

    for (const palace of astrolabe.palaces || []) {
      for (const star of palace.majorStars || []) {
        stars.push(star.name);
      }
    }

    return stars;
  }

  /**
   * 构建十二宫数据
   */
  private static buildPalaces(
    astrolabe: IztroAstrolabe,
    mingPalace: Branch,
    skeletonIndex: number,
    birthStem: Stem
  ): Record<Branch, Palace> {
    const palaces: Record<Branch, Palace> = {} as Record<Branch, Palace>;

    // 获取宫位地支顺序
    const branches = getPalaceBranches(mingPalace);

    // 遍历12宫
    for (let i = 0; i < 12; i++) {
      const branch = branches[i];
      const palaceName = PALACE_ORDER[i];

      // 从 iztro 获取对应宫位数据
      const iztroPalace = astrolabe.palaces?.[i];

      // 获取骨架旺弱
      const strength = getPalaceStrength(skeletonIndex, branch);

      // 获取基础分和天花板
      const baseScore = getBaseScore(strength);

      // 获取宫干
      const stem = getDunGan(birthStem, branch);

      // 转换星曜（含四化标记）
      const stars = this.convertStars(iztroPalace, palaceName, birthStem);

      palaces[branch] = {
        name: palaceName,
        branch,
        stem,
        stars,
        projections: [], // 后续计算
        strength,
        baseScore,
        currentScore: baseScore,
        finalScore: baseScore,
        ceiling: 0, // 后续计算
        isConstrained: false,
        isControlled: false,
        isAggressive: false,
      };
    }

    return palaces;
  }

  /**
   * 转换星曜数据（含四化标记）
   */
  private static convertStars(
    iztroPalace: any,
    palaceName: PalaceName,
    birthStem: Stem
  ): Star[] {
    const stars: Star[] = [];

    // 辅助函数：检查星曜是否有生年四化
    const getHuaType = (starName: string): HuaType | undefined => {
      const hua = getHuaByStem(birthStem);
      if (hua.lu === starName) return 'lu';
      if (hua.quan === starName) return 'quan';
      if (hua.ke === starName) return 'ke';
      if (hua.ji === starName) return 'ji';
      return undefined;
    };

    // 主星
    for (const star of iztroPalace?.majorStars || []) {
      stars.push({
        name: star.name as any,
        type: StarType.Major,
        brightness: star.brightness || 3,
        palace: palaceName,
        huaType: getHuaType(star.name),
      });
    }

    // 吉星
    for (const star of iztroPalace?.minorStars || []) {
      stars.push({
        name: star.name as any,
        type: getStarType(star.name),
        brightness: star.brightness || 3,
        palace: palaceName,
        huaType: getHuaType(star.name),
      });
    }

    // 煞星
    for (const star of iztroPalace?.adjectiveStars || []) {
      stars.push({
        name: star.name as any,
        type: getStarType(star.name),
        brightness: star.brightness || 3,
        palace: palaceName,
        huaType: getHuaType(star.name),
      });
    }

    return stars;
  }

  /**
   * 获取大限
   */
  static getDecennials(chart: Chart): Decennial[] {
    return calculateDecennials(
      chart.mingPalace,
      chart.gender,
      chart.birth.year
    );
  }

  /**
   * 获取当前大限
   */
  static getCurrentDecennial(chart: Chart, currentAge: number): Decennial | undefined {
    const decennials = this.getDecennials(chart);
    return decennials.find(d =>
      currentAge >= d.ageRange[0] && currentAge <= d.ageRange[1]
    );
  }

  /**
   * 获取流年
   */
  static getAnnual(chart: Chart, year: number): Annual {
    return calculateAnnual(chart.mingPalace, year);
  }

  /**
   * 创建虚拟命盘（太岁入卦）
   * 用于互动关系分析
   */
  static createVirtualChart(
    baseChart: Chart,
    targetYear: { stem: Stem; branch: Branch }
  ): Chart {
    // 以目标年支为虚拟命宫
    const virtualChart: Chart = {
      ...baseChart,
      id: `virtual_${targetYear.stem}${targetYear.branch}_${Date.now()}`,
      palaces: {} as Record<Branch, Palace>,
      mingPalace: targetYear.branch,
      taiSuiPalace: targetYear.branch,
    };

    // 构建虚拟十二宫
    const branches = getPalaceBranches(targetYear.branch);

    for (let i = 0; i < 12; i++) {
      const branch = branches[i];
      const palaceName = PALACE_ORDER[i];

      virtualChart.palaces[branch] = {
        name: palaceName,
        branch,
        stem: getDunGan(targetYear.stem, branch),
        stars: [], // 虚拟命盘的星曜来自入卦四化
        projections: [],
        strength: PalaceStrength.Medium,
        baseScore: 5.0,
        currentScore: 5.0,
        finalScore: 5.0,
        ceiling: 8.0,
        isConstrained: false,
        isControlled: false,
        isAggressive: false,
      };
    }

    return virtualChart;
  }

  /**
   * 获取宫位四化
   */
  static getPalaceHua(chart: Chart, palace: Palace): Hua {
    if (!palace.stem) {
      return { lu: null, quan: null, ke: null, ji: null };
    }
    return getHuaByStem(palace.stem);
  }

  /**
   * 查找星曜所在宫位
   */
  static findStarPalace(chart: Chart, starName: string): Palace | undefined {
    for (const branch of BRANCH_ORDER) {
      const palace = chart.palaces[branch];
      if (palace.stars.some(s => s.name === starName)) {
        return palace;
      }
    }
    return undefined;
  }

  /**
   * 获取命盘摘要信息
   */
  static getSummary(chart: Chart): {
    mingPalace: PalaceName;
    mingBranch: Branch;
    majorStars: string[];
    gender: string;
    yearStem: Stem;
    yearBranch: Branch;
  } {
    const mingPalace = chart.palaces[chart.mingPalace];
    const majorStars = mingPalace.stars
      .filter(s => s.type === 'major')
      .map(s => s.name);

    return {
      mingPalace: mingPalace.name,
      mingBranch: chart.mingPalace,
      majorStars,
      gender: chart.gender === Gender.Male ? '男' : '女',
      yearStem: chart.lunar.year.stem,
      yearBranch: chart.lunar.year.branch,
    };
  }
}

/**
 * 辅助函数：从命盘获取指定宫位
 */
export function getPalaceByName(chart: Chart, name: PalaceName): Palace | undefined {
  for (const branch of BRANCH_ORDER) {
    if (chart.palaces[branch].name === name) {
      return chart.palaces[branch];
    }
  }
  return undefined;
}

/**
 * 辅助函数：获取命宫
 */
export function getMingPalace(chart: Chart): Palace {
  return chart.palaces[chart.mingPalace];
}

/**
 * 辅助函数：获取身宫
 */
export function getShenPalace(chart: Chart): Palace | undefined {
  if (!chart.shenPalace) return undefined;
  return chart.palaces[chart.shenPalace];
}

/**
 * 辅助函数：获取太岁宫
 */
export function getTaiSuiPalace(chart: Chart): Palace {
  return chart.palaces[chart.taiSuiPalace];
}
