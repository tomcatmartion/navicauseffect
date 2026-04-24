/**
 * 紫微斗数分析结果类型定义
 */

import type { PalaceName, PalaceStrength, StarName, HuaType, Stem, Branch } from './chart';

/**
 * 星曜评分详情
 */
export interface StarScore {
  star: StarName;
  score: number;
  source: 'self' | 'opposite' | 'triad' | 'flank';
  isControlled?: boolean;    // 是否被制
}

/**
 * 宫位能级评估结果
 */
export interface PalaceAssessment {
  palace: PalaceName;
  branch: Branch;
  strength: PalaceStrength;
  baseScore: number;         // 骨架基础分
  finalScore: number;        // 最终评分
  ceiling: number;           // 天花板
  isConstrained: boolean;    // 是否受天花板约束

  // 星曜详情
  majorStars: StarScore[];   // 主星评分
  luckyStars: StarScore[];   // 吉星评分
  unluckyStars: StarScore[]; // 煞星评分

  // 成格格局
  patterns: PatternMatch[];

  // 综合解读
  interpretation: {
    level: string;           // 能级描述
    traits: string[];        // 特质描述
    advantages: string[];    // 优势
    disadvantages: string[]; // 劣势
    advice: string;          // 建议
  };
}

/**
 * 格局匹配结果
 */
export interface PatternMatch {
  name: string;              // 格局名称
  category: PatternCategory; // 格局分类
  source: 'natal' | 'decennial' | 'annual'; // 来源
  description: string;       // 描述
  effect: 'positive' | 'negative' | 'mixed';
}

/**
 * 格局分类
 */
export type PatternCategory =
  | '大吉' | '中吉' | '小吉'
  | '小凶' | '中凶' | '大凶';

/**
 * 性格分析结果
 */
export interface PersonalityProfile {
  overview: string;           // 总体性格画像

  // 三宫合参
  mingShenTai: {
    ming: PalaceAssessment;   // 命宫
    shen?: PalaceAssessment;  // 身宫
    taiSui: PalaceAssessment; // 太岁宫
  };

  // 性格特质分层
  traits: {
    surface: string[];        // 表层特质（命宫）
    middle: string[];         // 中层特质（身宫）
    core: string[];           // 核心特质（太岁宫）
  };

  // 四维合参（命宫）
  fourDimensions: {
    palace: PalaceName;
    self: string;             // 本宫
    opposite: string;         // 对宫
    triad: string;            // 三合
    flank: string;            // 夹宫
    synthesis: string;        // 综合解读
  };

  // 命宫全息底色
  mingHolographic: {
    hua: {
      lu?: string;            // 化禄影响
      quan?: string;          // 化权影响
      ke?: string;            // 化科影响
      ji?: string;            // 化忌影响
    };
    luckyStars: string[];     // 吉星影响
    unluckyStars: string[];   // 煞星影响
  };

  // 行为模式
  behaviorPatterns: {
    proactive: string[];      // 主动行为
    reactive: string[];       // 被动反应
    stress: string[];         // 压力下行为
  };

  // 优势与劣势
  strengths: string[];
  weaknesses: string[];

  // 发展建议
  advice: {
    overall: string;
    career?: string;
    relationship?: string;
    health?: string;
  };
}

/**
 * 关系类型
 */
export type RelationType =
  | '夫妻' | '情侣'
  | '父母' | '子女'
  | '合作伙伴'
  | '同事' | '上司' | '下属'
  | '朋友' | '其他';

/**
 * 四化互动记录
 */
export interface HuaInteraction {
  star: StarName;
  huaType: HuaType;
  source: 'self' | 'other';  // 来源
  targetPalace: PalaceName;
  interpretation: string;
  effect: 'positive' | 'negative' | 'mixed';
}

/**
 * 互动关系分析结果
 */
export interface InteractionAnalysis {
  overview: string;           // 关系总体画像

  // 参与者信息
  participants: {
    self: {
      name: string;
      year: { stem: Stem; branch: Branch };
    };
    other: {
      name: string;
      year: { stem: Stem; branch: Branch };
    };
  };

  // 关系类型
  relationType: RelationType;

  // 三维合参
  threeDimensions: {
    spatial: {
      description: string;
      early: string;          // 早期/表层
      deep: string;           // 深层/晚期
    };
    personal: {
      description: string;
      capacity: string;       // 承载力
      response: string;       // 回应方式
    };
    temporal: {
      description: string;
      current: string;        // 当前状态
      trend: string;          // 趋势
    };
  };

  // 四化互动
  huaInteractions: HuaInteraction[];

  // 引动星曜互动
  starInteractions: {
    star: StarName;
    position: PalaceName;
    interpretation: string;
  }[];

  // 综合判断
  conclusion: {
    compatibility: number;    // 匹配度 0-100
    chemistry: string;        // 化学反应描述
    potential: string;        // 发展潜力
    risk: string;            // 潜在风险
  };

  // 建议
  advice: string[];
  warnings?: string[];
}

/**
 * 事项类型
 */
export type AffairType =
  | '求学' | '求爱' | '求财' | '求职'
  | '求健康' | '求名' | '其他';

/**
 * 事项分析结果
 */
export interface AffairAnalysis {
  affair: string;             // 分析事项
  affairType: AffairType;     // 事项类型

  overview: string;           // 总体判断

  // 原局底盘
  natal: {
    patterns: PatternMatch[]; // 原局格局
    protection: PatternMatch[]; // 护佑机制
    foundation: string;       // 基础能量描述
    score: number;            // 基础评分 0-100
  };

  // 宫位聚焦
  palaceFocus: {
    primary: PalaceName;      // 主看宫位
    primaryAssessment: PalaceAssessment;
    secondary: PalaceName[];  // 兼看宫位
    secondaryAssessments: Record<PalaceName, PalaceAssessment>;
    synthesis: string;        // 综合分析
  };

  // 行运分析
  decennial: {
    index: number;
    ageRange: [number, number];
    palace: PalaceName;
    stem: Stem;
    activation: string;       // 激活方向
    trends: string[];         // 趋势判断
    score: number;            // 大限评分 0-100
  };

  // 流年引动
  annual: {
    year: number;
    palace: PalaceName;
    stem: Stem;
    trigger: string;          // 引动触发点
    outlook: string;          // 年度展望
    score: number;            // 流年评分 0-100
  };

  // 时间窗口
  timing: {
    favorable: string[];      // 有利时机
    caution: string[];        // 谨慎时机
    action: string;           // 建议行动时机
  };

  // 综合结论
  conclusion: {
    overall: string;          // 总体结论
    probability: string;      // 成功概率
    obstacles: string[];      // 潜在障碍
    opportunities: string[];  // 机会点
  };

  // 调整建议
  advice: {
    strategy: string[];       // 策略建议
    timing: string[];         // 时机建议
    action: string[];         // 行动建议
  };
}

/**
 * 完整解盘报告
 */
export interface FullChartReport {
  chart: {
    id: string;
    gender: string;
    birth: {
      lunar: string;
      solar: string;
    };
  };

  // 基础评估
  assessments: {
    palaces: Record<string, PalaceAssessment>;
  };

  // 性格分析
  personality?: PersonalityProfile;

  // 互动关系（可选）
  interactions?: Record<string, InteractionAnalysis>;

  // 事项分析（可选）
  affairs?: Record<string, AffairAnalysis>;

  // 生成时间
  generatedAt: string;
}
