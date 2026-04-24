# 紫微斗数解盘引擎 - TypeScript 实现方案

## 架构概览

```
src/lib/ziwei/
├── kb/                          # 知识库（Markdown规则文档）
│   ├── SKILL_宫位原生能级评估_V3.0.md
│   ├── SKILL_命主性格定性_V1.4.md
│   ├── SKILL_互动关系_V1.5.md
│   └── SKILL_事项与限运分析_V1.0.md
├── types/                       # 类型定义
│   ├── chart.ts                 # 命盘数据类型
│   ├── star.ts                  # 星曜类型
│   ├── palace.ts                # 宫位类型
│   └── analysis.ts              # 分析结果类型
├── data/                        # 静态数据
│   ├── skeletonMapping.ts       # 骨架映射库（P01-P12）
│   ├── starData.ts              # 星曜基本数据
│   ├── fiveTiger.ts             # 五虎遁表
│   └── patterns.ts              # 格局库
├── core/                        # 核心引擎
│   ├── ChartEngine.ts           # 命盘引擎（封装iztro）
│   ├── PalaceAssessor.ts        # 宫位能级评估器
│   ├── PersonalityAnalyzer.ts   # 性格分析器
│   ├── InteractionAnalyzer.ts   # 互动关系分析器
│   └── AffairAnalyzer.ts        # 事项分析器
├── utils/                       # 工具函数
│   ├── spatial.ts               # 空间关系计算（对宫/三合/夹宫）
│   ├── decennial.ts             # 大限流年计算
│   ├── four化.ts                # 四化计算
│   └── scorer.ts                # 评分计算
└── index.ts                     # 统一导出
```

## 类型定义

### chart.ts - 命盘数据类型

```typescript
/**
 * 性别
 */
export enum Gender {
  Male = 'male',
  Female = 'female',
}

/**
 * 天干
 */
export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';

/**
 * 地支
 */
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';

/**
 * 宫位名称
 */
export type PalaceName =
  | '命宫' | '父母' | '福德' | '田宅' | '官禄' | '仆役'
  | '迁移' | '疾厄' | '财帛' | '子女' | '夫妻' | '兄弟';

/**
 * 星曜名称
 */
export type StarName =
  | '紫微' | '天机' | '太阳' | '武曲' | '天同' | '廉贞'
  | '天府' | '太阴' | '贪狼' | '巨门' | '天相' | '天梁' | '七杀' | '破军'
  | '左辅' | '右弼' | '文昌' | '文曲' | '天魁' | '天钺'
  | '火星' | '铃星' | '地空' | '地劫' | '擎羊' | '陀罗'
  | '禄存' | '化禄' | '化权' | '化科' | '化忌';

/**
 * 星曜吉煞分类
 */
export enum StarType {
  Major = 'major',      // 主星
  Minor = 'minor',      // 辅星
  Lucky = 'lucky',      // 吉星
  Unlucky = 'unlucky',  // 煞星
  Hua = 'hua',          // 四化
}

/**
 * 宫位旺弱状态
 */
export enum PalaceStrength {
  ExtremelyStrong = '极旺',   // > 8.0
  Strong = '旺',              // 7.0 - 8.0
  Medium = '平',              // 5.0 - 6.9
  Weak = '陷',                // 3.0 - 4.9
  ExtremelyWeak = '极弱',     // < 3.0
  Empty = '空',               // 无主星
}

/**
 * 宫位数据
 */
export interface Palace {
  name: PalaceName;
  branch: Branch;
  stem?: Stem;
  stars: Star[];              // 本宫星曜
  oppositeStars: Star[];      // 对宫投射星曜
  triadStars: Star[][];       // 三合宫投射星曜 [左合, 右合]
  flankStars: Star[];         // 夹宫星曜
  strength: PalaceStrength;
  baseScore: number;          // 骨架基础分
  finalScore: number;         // 最终评分
  ceiling: number;            // 天花板
  isConstrained: boolean;     // 是否受天花板约束
}

/**
 * 星曜数据
 */
export interface Star {
  name: StarName;
  type: StarType;
  brightness: number;         // 亮度 1-5（或 0 表示无亮度标注）
  palace: PalaceName;         // 所在宫位
  isHua?: boolean;            // 是否为四化星
}

/**
 * 命盘数据
 */
export interface Chart {
  gender: Gender;
  year: { stem: Stem; branch: Branch };
  month: number;
  day: number;
  hour: number;
  palaces: Record<Branch, Palace>;
  mingPalace: Branch;         // 命宫地支
  shenPalace?: Branch;        // 身宫地支
  taiSuiPalace: Branch;       // 太岁宫地支
  skeletonIndex: number;      // 骨架序号 P01-P12
}

/**
 * 大限数据
 */
export interface Decennial {
  index: number;              // 第几大限
  ageRange: [number, number]; // 年龄区间
  palace: PalaceName;         // 大限命宫
  stem: Stem;                 // 大限宫干
  hua: Hua;                   // 大限四化
}

/**
 * 流年数据
 */
export interface Annual {
  year: number;
  branch: Branch;
  stem: Stem;
  palace: PalaceName;         // 流年命宫
  hua: Hua;                   // 流年四化
}

/**
 * 四化数据
 */
export interface Hua {
  lu: StarName | null;        // 化禄
  quan: StarName | null;      // 化权
  ke: StarName | null;        // 化科
  ji: StarName | null;        // 化忌
}
```

### analysis.ts - 分析结果类型

```typescript
/**
 * 宫位能级评估结果
 */
export interface PalaceAssessment {
  palace: PalaceName;
  strength: PalaceStrength;
  baseScore: number;
  finalScore: number;
  ceiling: number;
  luckyStars: { name: StarName; score: number; source: string }[];
  unluckyStars: { name: StarName; score: number; source: string }[];
  patterns: string[];         // 成格格局
  constraints: string[];      // 限制因素
  interpretation: string;     // 综合解读
}

/**
 * 性格分析结果
 */
export interface PersonalityProfile {
  overview: string;           // 总体性格
  traits: {
    surface: string[];        // 表层特质（命宫）
    middle: string[];         // 中层特质（身宫）
    core: string[];           // 核心特质（太岁宫）
  };
  mingShenTai: {
    ming: PalaceAssessment;
    shen?: PalaceAssessment;
    taiSui: PalaceAssessment;
  };
  fourDimensions: {
    palace: PalaceName;
    self: string;             // 本宫
    opposite: string;         // 对宫
    triad: string;            // 三合
    flank: string;            // 夹宫
    synthesis: string;        // 综合解读
  }[];
  behaviorPatterns: string[]; // 行为模式
  strengths: string[];        // 优势
  weaknesses: string[];       // 劣势
}

/**
 * 互动关系分析结果
 */
export interface InteractionAnalysis {
  overview: string;           // 关系总体画像
  participants: {
    self: {
      name: string;
      year: { stem: Stem; branch: Branch };
      profile: PersonalityProfile;
    };
    other: {
      name: string;
      year: { stem: Stem; branch: Branch };
      virtualChart: Chart;    // 太岁入卦虚拟命盘
    };
  };
  threeDimensions: {
    spatial: string;          // 空间维度（对方四化）
    personal: string;         // 个人维度（命主底色）
    temporal: string;         // 时间维度（大限流年）
  };
  fourHuaInteractions: {
    star: StarName;
    huaType: 'lu' | 'quan' | 'ke' | 'ji';
    targetPalace: PalaceName;
    interpretation: string;
  }[];
  timing: {
    current: string;          // 当前状态
    trends: string[];         // 趋势判断
  };
  advice: string[];           // 调整建议
  warnings?: string[];        // 风险预警
}

/**
 * 事项分析结果
 */
export interface AffairAnalysis {
  affair: string;             // 分析事项
  overview: string;           // 总体判断
  natal: {
    patterns: string[];       // 原局格局
    protection: string[];     // 护佑机制
    foundation: string;       // 基础能量
  };
  decennial: {
    period: string;           // 当前大限时段
    activation: string;       // 激活方向
    trends: string[];         // 趋势
  };
  annual: {
    year: number;
    trigger: string;          // 引动触发点
    outlook: string;          // 年度展望
  };
  palaceFocus: {
    primary: PalaceName;      // 主看宫位
    secondary: PalaceName[];  // 兼看宫位
    analysis: string;         // 综合分析
  };
  conclusion: string;         // 定性结论
  advice: string[];           // 调整建议
}
```

## 核心类设计

### ChartEngine.ts - 命盘引擎

```typescript
import { iztro } from 'iztro';
import type { Chart, Palace, Star, Decennial, Annual } from '../types/chart';

export class ChartEngine {
  /**
   * 创建命盘
   */
  static create(params: {
    gender: Gender;
    year: number;
    month: number;
    day: number;
    hour: number;
    solar?: boolean;          // 默认阳历
  }): Chart;

  /**
   * 获取大限
   */
  static getDecennials(chart: Chart): Decennial[];

  /**
   * 获取流年
   */
  static getAnnual(chart: Chart, year: number): Annual;

  /**
   * 太岁入卦：创建虚拟命盘
   */
  static createVirtualChart(
    baseChart: Chart,
    targetYear: { stem: Stem; branch: Branch }
  ): Chart;
}
```

### PalaceAssessor.ts - 宫位能级评估器

```typescript
import type { Chart, PalaceAssessment } from '../types/chart';

export class PalaceAssessor {
  /**
   * 评估所有宫位能级
   */
  static assessAll(chart: Chart): Record<Branch, PalaceAssessment>;

  /**
   * 评估单个宫位能级
   */
  static assessOne(chart: Chart, palaceBranch: Branch): PalaceAssessment;

  /**
   * 计算骨架基础分
   */
  private static calculateBaseScore(chart: Chart, palace: Palace): number;

  /**
   * 计算吉星加分
   */
  private static calculateLuckyBonus(palace: Palace): number;

  /**
   * 计算煞星减分
   */
  private static calculateUnluckyPenalty(palace: Palace): number;

  /**
   * 处理禄存专项
   */
  private static calculateLuCun(palace: Palace): number;

  /**
   * 应用天花板约束
   */
  private static applyCeiling(score: number, ceiling: number): number;
}
```

### PersonalityAnalyzer.ts - 性格分析器

```typescript
import type { Chart, PersonalityProfile } from '../types/chart';

export class PersonalityAnalyzer {
  /**
   * 分析完整性格图谱
   */
  static analyze(chart: Chart): PersonalityProfile;

  /**
   * 三宫合参分析
   */
  private static analyzeMingShenTai(chart: Chart): {
    ming: PalaceAssessment;
    shen?: PalaceAssessment;
    taiSui: PalaceAssessment;
  };

  /**
   * 四维合参分析
   */
  private static fourDimensionsAnalysis(
    chart: Chart,
    palaceBranch: Branch
  ): {
    palace: PalaceName;
    self: string;
    opposite: string;
    triad: string;
    flank: string;
    synthesis: string;
  };

  /**
   * 命宫全息底色分析
   */
  private static mingHolographic(chart: Chart): {
    traits: string[];
    behaviorPatterns: string[];
    strengths: string[];
    weaknesses: string[];
  };
}
```

### InteractionAnalyzer.ts - 互动关系分析器

```typescript
import type { Chart, InteractionAnalysis } from '../types/chart';

export class InteractionAnalyzer {
  /**
   * 分析互动关系
   */
  static analyze(params: {
    selfChart: Chart;
    targetYear: { stem: Stem; branch: Branch };
    currentDecennial?: Decennial;
    currentAnnual?: Annual;
    affairType?: '夫妻' | '父母' | '子女' | '合作伙伴' | '同事' | '其他';
  }): InteractionAnalysis;

  /**
   * 建立虚拟命盘（太岁入卦）
   */
  private static createVirtualChart(
    baseChart: Chart,
    targetYear: { stem: Stem; branch: Branch }
  ): Chart;

  /**
   * 四化互动分析
   */
  private static analyzeHuaInteraction(
    selfChart: Chart,
    virtualChart: Chart
  ): Array<{
    star: StarName;
    huaType: 'lu' | 'quan' | 'ke' | 'ji';
    targetPalace: PalaceName;
    interpretation: string;
  }>;

  /**
   * 三维合参分析
   */
  private static threeDimensionsAnalysis(params: {
    selfChart: Chart;
    virtualChart: Chart;
    currentDecennial?: Decennial;
    currentAnnual?: Annual;
  }): {
    spatial: string;
    personal: string;
    temporal: string;
  };
}
```

### AffairAnalyzer.ts - 事项分析器

```typescript
import type { Chart, AffairAnalysis } from '../types/chart';

export class AffairAnalyzer {
  /**
   * 分析事项
   */
  static analyze(params: {
    chart: Chart;
    affair: string;
    affairType?: '求学' | '求爱' | '求财' | '求职' | '求健康' | '求名';
    currentDecennial?: Decennial;
    currentAnnual?: Annual;
  }): AffairAnalysis;

  /**
   * 事项宫位映射
   */
  private static getPalaceMapping(affairType: string): {
    primary: PalaceName;
    secondary: PalaceName[];
  };

  /**
   * 原局底盘分析
   */
  private static analyzeNatal(chart: Chart, affair: string): {
    patterns: string[];
    protection: string[];
    foundation: string;
  };

  /**
   * 行运分析
   */
  private static analyzeDecennial(
    chart: Chart,
    decennial: Decennial,
    affair: string
  ): {
    period: string;
    activation: string;
    trends: string[];
  };

  /**
   * 流年引动分析
   */
  private static analyzeAnnual(
    chart: Chart,
    annual: Annual,
    affair: string
  ): {
    year: number;
    trigger: string;
    outlook: string;
  };
}
```

## 数据文件结构

### skeletonMapping.ts - 骨架映射库

```typescript
export const SKELETON_MAPPING: Record<
  number, // P01-P12
  {
    name: string;              // 命宫名称
    branches: Record<Branch, PalaceStrength>; // 12宫旺弱
  }
> = {
  1: {
    name: '紫微在子',
    branches: {
      子: PalaceStrength.Strong,
      丑: PalaceStrength.Empty,
      寅: PalaceStrength.Medium,
      // ...
    },
  },
  // ... P02-P12
};
```

### fiveTiger.ts - 五虎遁表

```typescript
export const FIVE_TIGER: Record<Stem, Partial<Record<Branch, Stem>>> = {
  甲: { 寅: '丙', 卯: '丁', 辰: '戊', /* ... */ },
  乙: { 寅: '戊', 卯: '己', 辰: '庚', /* ... */ },
  // ...
};
```

### patterns.ts - 格局库

```typescript
export const PATTERNS: Array<{
  name: string;
  category: '大吉' | '中吉' | '小吉' | '小凶' | '中凶' | '大凶';
  condition: (chart: Chart, palace: Palace) => boolean;
  interpretation: string;
}> = [
  {
    name: '双禄夹',
    category: '大吉',
    condition: (chart, palace) => {
      // 检查目标宫位左右是否有禄星
    },
    interpretation: '护佑格局，凶限时能守住底线',
  },
  // ... 更多格局
];
```

## API 使用示例

```typescript
import { ChartEngine, PalaceAssessor, PersonalityAnalyzer } from '@/lib/ziwei';

// 1. 创建命盘
const chart = ChartEngine.create({
  gender: Gender.Female,
  year: 1982,
  month: 10,
  day: 15,
  hour: 8,
});

// 2. 评估宫位能级
const assessments = PalaceAssessor.assessAll(chart);
console.log(assessments['命宫']);

// 3. 分析性格
const personality = PersonalityAnalyzer.analyze(chart);
console.log(personality.overview);

// 4. 获取大限流年
const decennials = ChartEngine.getDecennials(chart);
const currentAnnual = ChartEngine.getAnnual(chart, 2026);

// 5. 互动关系分析
const interaction = InteractionAnalyzer.analyze({
  selfChart: chart,
  targetYear: { stem: '甲', branch: '子' },
  currentDecennial: decennials[4],
  currentAnnual: currentAnnual,
  affairType: '夫妻',
});

// 6. 事项分析
const affair = AffairAnalyzer.analyze({
  chart: chart,
  affair: '今年事业运势如何？',
  affairType: '求名',
  currentDecennial: decennials[4],
  currentAnnual: currentAnnual,
});
```

## 实现优先级

1. **Phase 1**: 类型定义 + 数据文件
2. **Phase 2**: ChartEngine 命盘引擎
3. **Phase 3**: PalaceAssessor 能级评估
4. **Phase 4**: PersonalityAnalyzer 性格分析
5. **Phase 5**: InteractionAnalyzer 互动关系
6. **Phase 6**: AffairAnalyzer 事项分析
