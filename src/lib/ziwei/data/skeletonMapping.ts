/**
 * 骨架映射库（P01-P12）
 * 依命主骨架序号直接读取对应行
 * 格式：地支（主星旺平陷/极旺/极弱）
 */

import { PalaceStrength, type Branch } from '../types';

/**
 * 骨架映射条目
 */
export interface SkeletonMapping {
  index: number;              // P01-P12
  name: string;               // 命宫名称
  branches: {
    子: PalaceStrength;
    丑: PalaceStrength;
    寅: PalaceStrength;
    卯: PalaceStrength;
    辰: PalaceStrength;
    巳: PalaceStrength;
    午: PalaceStrength;
    未: PalaceStrength;
    申: PalaceStrength;
    酉: PalaceStrength;
    戌: PalaceStrength;
    亥: PalaceStrength;
  };
}

/**
 * 解析宫位旺弱字符串为 PalaceStrength 枚举
 */
function parseStrength(str: string): PalaceStrength {
  if (str.includes('极旺')) return PalaceStrength.ExtremelyStrong;
  if (str.includes('旺')) return PalaceStrength.Strong;
  if (str.includes('平')) return PalaceStrength.Medium;
  if (str.includes('陷')) return PalaceStrength.Weak;
  if (str.includes('空陷')) return PalaceStrength.Empty;
  if (str === '空陷' || str === '空') return PalaceStrength.Empty;
  return PalaceStrength.Medium;
}

/**
 * 解析宫位字符串为12宫旺弱数组
 * 输入格式："子旺 丑空陷 寅破军平 卯空陷 辰廉府旺 巳太阴陷 午贪狼旺 未同巨陷 申武相平 酉阳梁平 戌七杀旺 亥天机平"
 */
function parseBranchesString(str: string): SkeletonMapping['branches'] {
  const parts = str.trim().split(/\s+/);
  const branches: Record<string, string> = {};

  for (const part of parts) {
    // 提取地支和旺弱状态
    let branch = part[0] as keyof typeof branches;
    let strength = part.slice(1);

    // 处理特殊格式如 "空陷"、"机巨极弱" 等
    if (strength === '空陷' || strength === '空') {
      branches[branch] = '空陷';
    } else if (strength.includes('极弱')) {
      branches[branch] = '极弱';
    } else if (strength.includes('极旺')) {
      branches[branch] = '极旺';
    } else if (strength.includes('旺') && !strength.includes('极')) {
      branches[branch] = '旺';
    } else if (strength.includes('陷') && !strength.includes('空')) {
      branches[branch] = '陷';
    } else if (strength.includes('平')) {
      branches[branch] = '平';
    } else {
      // 尝试从星名中推断旺弱（如 "破军平" -> "平"）
      const strengthMatch = strength.match(/(旺|平|陷|极旺|极弱|空陷|空)$/);
      if (strengthMatch) {
        branches[branch] = strengthMatch[1];
      } else {
        branches[branch] = '平'; // 默认平
      }
    }
  }

  return {
    子: parseStrength(branches['子'] || '平'),
    丑: parseStrength(branches['丑'] || '平'),
    寅: parseStrength(branches['寅'] || '平'),
    卯: parseStrength(branches['卯'] || '平'),
    辰: parseStrength(branches['辰'] || '平'),
    巳: parseStrength(branches['巳'] || '平'),
    午: parseStrength(branches['午'] || '平'),
    未: parseStrength(branches['未'] || '平'),
    申: parseStrength(branches['申'] || '平'),
    酉: parseStrength(branches['酉'] || '平'),
    戌: parseStrength(branches['戌'] || '平'),
    亥: parseStrength(branches['亥'] || '平'),
  };
}

/**
 * 骨架映射库完整数据
 */
export const SKELETON_MAPPING: SkeletonMapping[] = [
  {
    index: 1,
    name: '紫微在子',
    branches: parseBranchesString('子旺 丑空陷 寅破军平 卯空陷 辰廉府旺 巳太阴陷 午贪狼旺 未同巨陷 申武相平 酉阳梁平 戌七杀旺 亥天机平'),
  },
  {
    index: 2,
    name: '紫破在丑',
    branches: parseBranchesString('子天机旺 丑旺 寅空陷 卯天府平 辰太阴陷 巳廉贪陷 午巨门旺 未天相平 申同梁旺 酉武杀旺 戌太阳陷 亥空陷'),
  },
  {
    index: 3,
    name: '紫府在寅',
    branches: parseBranchesString('子破军旺 丑天机平 寅极旺 卯太阴陷 辰贪狼旺 巳巨门陷 午廉相旺 未天梁旺 申七杀旺 酉天同平 戌武曲旺 亥太阳陷'),
  },
  {
    index: 4,
    name: '紫贪在卯',
    branches: parseBranchesString('子太阳陷 丑天府旺 寅机阴平 卯旺 辰巨门陷 巳天相平 午天梁旺 未廉杀旺 申空陷 酉空陷 戌天同平 亥武破陷'),
  },
  {
    index: 5,
    name: '紫相在辰',
    branches: parseBranchesString('子武府旺 丑阳阴平 寅贪狼旺 卯机巨旺 辰平 巳天梁陷 午七杀旺 未空陷 申廉贞旺 酉空陷 戌破军平 亥天同陷'),
  },
  {
    index: 6,
    name: '紫杀在巳',
    branches: parseBranchesString('子同阴旺 丑武贪旺 寅阳巨旺 卯天相平 辰机梁旺 巳旺 午空陷 未空陷 申空陷 酉廉破陷 戌空陷 亥天府平'),
  },
  {
    index: 7,
    name: '紫微在午',
    branches: parseBranchesString('子贪狼旺 丑同巨陷 寅武相旺 卯阳梁旺 辰七杀平 巳天机平 午旺 未空陷 申破军平 酉空陷 戌廉府旺 亥太阴旺'),
  },
  {
    index: 8,
    name: '紫破在未',
    branches: parseBranchesString('子巨门旺 丑天相平 寅同梁旺 卯武杀旺 辰太阳旺 巳空陷 午天机旺 未旺 申空陷 酉天府旺 戌太阴旺 亥廉贪旺'),
  },
  {
    index: 9,
    name: '紫府在申',
    branches: parseBranchesString('子廉相旺 丑天梁平 寅七杀旺 卯天同平 辰武曲旺 巳太阳旺 午破军旺 未天机平 申极旺 酉太阴旺 戌贪狼旺 亥巨门旺'),
  },
  {
    index: 10,
    name: '紫贪在酉',
    branches: parseBranchesString('子天梁旺 丑廉杀陷 寅空陷 卯空陷 辰天同平 巳武破旺 午太阳旺 未天府旺 申机阴平 酉旺 戌巨门陷 亥天相旺'),
  },
  {
    index: 11,
    name: '紫相在戌',
    branches: parseBranchesString('子七杀旺 丑空陷 寅廉贞旺 卯空陷 辰破军平 巳天同陷 午武府旺 未阳阴平 申贪狼旺 酉机巨极弱 戌平 亥天梁陷'),
  },
  {
    index: 12,
    name: '紫杀在亥',
    branches: parseBranchesString('子空陷 丑空陷 寅空陷 卯廉破平 辰空陷 巳天府旺 午同阴陷 未武贪旺 申阳巨平 酉天相平 戌机梁旺 亥旺'),
  },
];

/**
 * 根据命宫地支获取骨架序号
 * 通过命宫主星组合判断骨架类型
 */
export function getSkeletonIndexByMingPalace(
  mingPalaceBranch: string,
  majorStars: string[]
): number {
  // 简化版：根据命宫地支和主星推断骨架
  // 实际应使用 iztro 库的命盘数据来精确判断

  const starsStr = majorStars.join(',');

  // 根据命宫地支和主星组合判断
  for (const mapping of SKELETON_MAPPING) {
    if (mapping.name.includes(mingPalaceBranch)) {
      // 进一步验证主星
      if (starsStr.includes(mapping.name.split('在')[0])) {
        return mapping.index;
      }
    }
  }

  // 默认返回1
  return 1;
}

/**
 * 根据骨架序号获取宫位旺弱
 */
export function getPalaceStrength(
  skeletonIndex: number,
  branch: string
): PalaceStrength {
  const mapping = SKELETON_MAPPING.find(m => m.index === skeletonIndex);
  if (!mapping) {
    return PalaceStrength.Medium;
  }
  return mapping.branches[branch as keyof typeof mapping.branches] || PalaceStrength.Medium;
}

/**
 * 根据骨架序号获取宫位基础分
 */
export function getBaseScore(strength: PalaceStrength): number {
  switch (strength) {
    case PalaceStrength.ExtremelyStrong:
      return 8.5;
    case PalaceStrength.Strong:
      return 7.0;
    case PalaceStrength.Medium:
      return 5.0;
    case PalaceStrength.Weak:
      return 3.0;
    case PalaceStrength.ExtremelyWeak:
      return 1.5;
    case PalaceStrength.Empty:
      return 2.0;
    default:
      return 5.0;
  }
}

/**
 * 根据骨架序号获取宫位天花板
 */
export function getCeiling(strength: PalaceStrength): number {
  switch (strength) {
    case PalaceStrength.ExtremelyStrong:
      return 8.5;
    case PalaceStrength.Strong:
      return 8.5;
    case PalaceStrength.Medium:
      return 8.0;
    case PalaceStrength.Weak:
      return 7.3;
    case PalaceStrength.ExtremelyWeak:
      return 5.0;
    case PalaceStrength.Empty:
      return 5.3;
    default:
      return 8.0;
  }
}
