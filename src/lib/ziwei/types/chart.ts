/**
 * 紫微斗数命盘数据类型定义
 */

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
 * 宫位顺序（按地支顺序）
 */
export const PALACE_ORDER: PalaceName[] = [
  '命宫', '父母', '福德', '田宅', '官禄', '仆役',
  '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
];

/**
 * 地支对应的顺序索引
 */
export const BRANCH_INDEX: Record<Branch, number> = {
  子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5,
  午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11,
};

/**
 * 地支顺序
 */
export const BRANCH_ORDER: Branch[] = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
];

/**
 * 宫位索引
 */
export const PALACE_INDEX: Record<PalaceName, number> = {
  命宫: 0, 父母: 1, 福德: 2, 田宅: 3, 官禄: 4, 仆役: 5,
  迁移: 6, 疾厄: 7, 财帛: 8, 子女: 9, 夫妻: 10, 兄弟: 11,
};

/**
 * 四化类型
 */
export type HuaType = 'lu' | 'quan' | 'ke' | 'ji';

/**
 * 四化名称
 */
export const HUA_NAMES: Record<HuaType, string> = {
  lu: '化禄',
  quan: '化权',
  ke: '化科',
  ji: '化忌',
};

/**
 * 四化数据
 */
export interface Hua {
  lu: string | null;    // 化禄星名
  quan: string | null;  // 化权星名
  ke: string | null;    // 化科星名
  ji: string | null;    // 化忌星名
}

/**
 * 十四主星名称
 */
export type MajorStarName =
  | '紫微' | '天机' | '太阳' | '武曲' | '天同' | '廉贞'
  | '天府' | '太阴' | '贪狼' | '巨门' | '天相' | '天梁' | '七杀' | '破军';

/**
 * 六吉星名称
 */
export type LuckyStarName = '左辅' | '右弼' | '文昌' | '文曲' | '天魁' | '天钺';

/**
 * 六煞星名称
 */
export type UnluckyStarName = '火星' | '铃星' | '地空' | '地劫' | '擎羊' | '陀罗';

/**
 * 其他星曜名称
 */
export type OtherStarName = '禄存' | '化禄' | '化权' | '化科' | '化忌'
  | '红鸾' | '天喜' | '天马' | '华盖' | '天刑'
  | '力士' | '青龙' | '将军' | '奏书' | '蜚廉' | '喜神';

/**
 * 所有星曜名称
 */
export type StarName = MajorStarName | LuckyStarName | UnluckyStarName | OtherStarName;

/**
 * 星曜类型分类
 */
export enum StarType {
  Major = 'major',        // 十四主星
  Lucky = 'lucky',        // 六吉星
  Unlucky = 'unlucky',    // 六煞星
  Hua = 'hua',            // 四化星
  Other = 'other',        // 其他星曜
}

/**
 * 星曜数据
 */
export interface Star {
  name: StarName;
  type: StarType;
  brightness: number;     // 亮度等级（庙旺得利陷，1-5）
  palace: PalaceName;     // 所在宫位
}

/**
 * 宫位旺弱状态
 */
export enum PalaceStrength {
  ExtremelyStrong = '极旺',  // > 8.0
  Strong = '旺',             // 7.0 - 8.0
  Medium = '平',             // 5.0 - 6.9
  Weak = '陷',               // 3.0 - 4.9
  ExtremelyWeak = '极弱',    // < 3.0
  Empty = '空',              // 无主星
}

/**
 * 宫位旺弱对应的数值范围
 */
export const STRENGTH_RANGE: Record<PalaceStrength, { min: number; max: number; base: number }> = {
  [PalaceStrength.ExtremelyStrong]: { min: 8.0, max: 10, base: 8.5 },
  [PalaceStrength.Strong]: { min: 7.0, max: 7.9, base: 7.0 },
  [PalaceStrength.Medium]: { min: 5.0, max: 6.9, base: 5.0 },
  [PalaceStrength.Weak]: { min: 3.0, max: 4.9, base: 3.0 },
  [PalaceStrength.ExtremelyWeak]: { min: 0, max: 2.9, base: 1.5 },
  [PalaceStrength.Empty]: { min: 0, max: 2.0, base: 2.0 },
};

/**
 * 空间衰减系数
 */
export const SPATIAL_DECAY: Record<SpatialRelation, number> = {
  self: 1.0,      // 本宫
  opposite: 0.8,  // 对宫
  triad: 0.7,     // 三合宫
  flank: 0.5,     // 夹宫（基础值，实际需根据本宫与夹宫旺弱动态计算）
};

/**
 * 星曜投射数据
 */
export interface StarProjection {
  star: Star;
  sourcePalace: PalaceName;  // 来源宫位
  relation: SpatialRelation; // 空间关系
  decayFactor: number;       // 衰减系数
}

/**
 * 宫位数据
 */
export interface Palace {
  name: PalaceName;
  branch: Branch;
  stem?: Stem;
  stars: Star[];             // 本宫星曜
  projections: StarProjection[]; // 投射星曜（对宫/三合/夹宫）
  strength: PalaceStrength;
  baseScore: number;         // 骨架基础分
  currentScore: number;      // 当前评分（计算中）
  finalScore: number;        // 最终评分
  ceiling: number;           // 天花板
  isConstrained: boolean;    // 是否受天花板约束
  isControlled: boolean;     // 是否制煞
  isAggressive: boolean;     // 是否逞凶
}

/**
 * 命盘数据
 */
export interface Chart {
  id: string;                // 命盘唯一标识
  gender: Gender;
  birth: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute?: number;
  };
  lunar: {
    year: { stem: Stem; branch: Branch };
    month: number;
    day: number;
  };
  solar: {
    year: { stem: Stem; branch: Branch };
    month: number;
    day: number;
  };
  palaces: Record<Branch, Palace>; // 按地支索引的12宫
  mingPalace: Branch;        // 命宫地支
  shenPalace?: Branch;       // 身宫地支
  bodyPalace?: Branch;       // 身宫地支（别名）
  taiSuiPalace: Branch;      // 太岁宫地支
  skeletonIndex: number;     // 骨架序号 P01-P12
  birthHua: Hua;             // 生年四化
  decennialLimit: number;    // 大限起运年龄
}

/**
 * 大限数据
 */
export interface Decennial {
  index: number;             // 第几大限（从1开始）
  ageRange: [number, number]; // 年龄区间
  palace: PalaceName;        // 大限命宫
  branch: Branch;            // 大限命宫地支
  stem: Stem;                // 大限宫干
  hua: Hua;                  // 大限四化
}

/**
 * 流年数据
 */
export interface Annual {
  year: number;
  branch: Branch;
  stem: Stem;
  palace: PalaceName;        // 流年命宫
  hua: Hua;                  // 流年四化
}

/**
 * 小限数据（每十年一变，男顺女逆）
 */
export interface MinorLimit {
  age: number;
  palace: PalaceName;
  branch: Branch;
}

/**
 * 空间关系类型
 */
export type SpatialRelation = 'self' | 'opposite' | 'triad' | 'flank';

/**
 * 获取星曜分值
 */
export function getStarScore(starName: StarName): number {
  const luckyStars: StarName[] = ['化禄', '左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
  const unluckyStars: StarName[] = ['火星', '铃星', '地空', '地劫', '化忌', '擎羊', '陀罗'];

  if (luckyStars.includes(starName)) return 0.5;
  if (unluckyStars.includes(starName)) return -0.5;
  return 0;
}

/**
 * 判断是否为吉星
 */
export function isLuckyStar(starName: StarName): boolean {
  const luckyStars: StarName[] = ['化禄', '左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
  return luckyStars.includes(starName);
}

/**
 * 判断是否为煞星
 */
export function isUnluckyStar(starName: StarName): boolean {
  const unluckyStars: StarName[] = ['火星', '铃星', '地空', '地劫', '化忌', '擎羊', '陀罗'];
  return unluckyStars.includes(starName);
}
