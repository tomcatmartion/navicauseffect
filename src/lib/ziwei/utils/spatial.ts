/**
 * 空间关系计算工具
 * 计算对宫、三合宫、夹宫等空间关系
 */

import type { PalaceName, Branch, SpatialRelation, StarProjection } from '../types';
import { PALACE_ORDER, BRANCH_ORDER, BRANCH_INDEX } from '../types';

/**
 * 获取对宫地支
 */
export function getOppositeBranch(branch: Branch): Branch {
  const idx = BRANCH_INDEX[branch];
  const oppositeIdx = (idx + 6) % 12;
  return BRANCH_ORDER[oppositeIdx];
}

/**
 * 获取三合宫地支
 * 返回 [左合, 右合]
 */
export function getTriadBranches(branch: Branch): [Branch, Branch] {
  const idx = BRANCH_INDEX[branch];
  // 寅午戌三合火局
  // 申子辰三合水局
  // 巳酉丑三合金局
  // 亥卯未三合木局
  const triadMap: Record<Branch, [Branch, Branch]> = {
    '子': ['申', '辰'],
    '丑': ['巳', '酉'],
    '寅': ['午', '戌'],
    '卯': ['亥', '未'],
    '辰': ['子', '申'],
    '巳': ['丑', '酉'],
    '午': ['寅', '戌'],
    '未': ['卯', '亥'],
    '申': ['子', '辰'],
    '酉': ['巳', '丑'],
    '戌': ['寅', '午'],
    '亥': ['卯', '未'],
  };
  return triadMap[branch];
}

/**
 * 获取夹宫地支
 * 返回 [左夹, 右夹]
 */
export function getFlankBranches(branch: Branch): [Branch, Branch] {
  const idx = BRANCH_INDEX[branch];
  const leftIdx = (idx - 1 + 12) % 12;
  const rightIdx = (idx + 1) % 12;
  return [BRANCH_ORDER[leftIdx], BRANCH_ORDER[rightIdx]];
}

/**
 * 根据命宫地支获取所有宫位的地支分布
 * 返回按宫位顺序的地支数组
 */
export function getPalaceBranches(mingPalace: Branch): Branch[] {
  const mingIdx = BRANCH_INDEX[mingPalace];
  const branches: Branch[] = [];
  for (let i = 0; i < 12; i++) {
    branches.push(BRANCH_ORDER[(mingIdx + i) % 12]);
  }
  return branches;
}

/**
 * 根据地支获取宫位名称（以命宫为起点）
 */
export function getPalaceNameByBranch(mingPalace: Branch, targetBranch: Branch): PalaceName {
  const branches = getPalaceBranches(mingPalace);
  const idx = branches.indexOf(targetBranch);
  return PALACE_ORDER[idx];
}

/**
 * 计算两个地支之间的距离（顺时针）
 */
export function getBranchDistance(from: Branch, to: Branch): number {
  const fromIdx = BRANCH_INDEX[from];
  const toIdx = BRANCH_INDEX[to];
  return (toIdx - fromIdx + 12) % 12;
}

/**
 * 判断两个地支的空间关系
 */
export function getSpatialRelation(from: Branch, to: Branch): SpatialRelation {
  const distance = getBranchDistance(from, to);

  if (distance === 0) return 'self';
  if (distance === 6) return 'opposite';
  if (distance === 4 || distance === 8) return 'triad';
  if (distance === 1 || distance === 11) return 'flank';

  return 'self'; // 默认
}

/**
 * 获取空间衰减系数
 * 对宫固定0.8，三合宫固定0.7，夹宫动态计算
 */
export function getDecayFactor(
  relation: SpatialRelation,
  fromStrength: number,
  toStrength?: number
): number {
  switch (relation) {
    case 'self':
      return 1.0;
    case 'opposite':
      return 0.8;
    case 'triad':
      return 0.7;
    case 'flank':
      // 夹宫动态系数：本宫旺弱 × 夹宫旺弱
      if (toStrength === undefined) {
        return 0.5; // 默认值
      }
      // 动态计算夹宫系数
      return calculateFlankDecay(fromStrength, toStrength);
    default:
      return 1.0;
  }
}

/**
 * 动态计算夹宫衰减系数
 * 根据本宫旺弱和夹宫旺弱计算
 */
export function calculateFlankDecay(selfStrength: number, flankStrength: number): number {
  // 本宫旺弱等级
  const selfLevel = selfStrength >= 8 ? 'strong' : selfStrength >= 5 ? 'medium' : 'weak';
  // 夹宫旺弱等级
  const flankLevel = flankStrength >= 6 ? 'strong' : flankStrength >= 4 ? 'medium' : 'weak';

  // 夹宫动态系数表
  const flankTable: Record<string, Record<string, number>> = {
    strong: { strong: 0.9, medium: 0.5, weak: 0.2 },
    medium: { strong: 0.6, medium: 0.4, weak: 0.2 },
    weak: { strong: 0.3, medium: 0.1, weak: 0.1 },
  };

  return flankTable[selfLevel]?.[flankLevel] ?? 0.2;
}

/**
 * 计算星曜投射到目标宫位的衰减后分值
 */
export function calculateProjectionScore(
  baseScore: number,
  fromStrength: number,
  toStrength: number,
  relation: SpatialRelation
): number {
  const decay = getDecayFactor(relation, fromStrength, toStrength);
  return baseScore * decay;
}

/**
 * 获取宫位的所有空间关系宫位
 */
export function getAllSpatialRelations(branch: Branch): {
  self: Branch;
  opposite: Branch;
  triad: [Branch, Branch];
  flank: [Branch, Branch];
} {
  return {
    self: branch,
    opposite: getOppositeBranch(branch),
    triad: getTriadBranches(branch),
    flank: getFlankBranches(branch),
  };
}

/**
 * 判断夹宫是否成立
 * 夹宫成立条件：左右两侧各自有星曜
 */
export function isFlankValid(
  leftPalaceStars: unknown[],
  rightPalaceStars: unknown[]
): boolean {
  return leftPalaceStars.length > 0 && rightPalaceStars.length > 0;
}

/**
 * 判断夹宫力量是否均衡
 */
export function isFlankBalanced(
  leftScore: number,
  rightScore: number,
  tolerance: number = 1.0
): boolean {
  return Math.abs(leftScore - rightScore) <= tolerance;
}

/**
 * 计算夹宫的不对称落差
 */
export function getFlankImbalance(leftScore: number, rightScore: number): {
  isBalanced: boolean;
  stronger: 'left' | 'right' | 'equal';
  difference: number;
  description: string;
} {
  const difference = Math.abs(leftScore - rightScore);
  const isBalanced = difference <= 1.0;

  let stronger: 'left' | 'right' | 'equal' = 'equal';
  if (leftScore > rightScore + 1.0) stronger = 'left';
  if (rightScore > leftScore + 1.0) stronger = 'right';

  let description = '两侧均衡';
  if (!isBalanced) {
    if (stronger === 'left') {
      description = `左侧较强（${leftScore.toFixed(1)} vs ${rightScore.toFixed(1)}）`;
    } else if (stronger === 'right') {
      description = `右侧较强（${rightScore.toFixed(1)} vs ${leftScore.toFixed(1)}）`;
    }
  }

  return { isBalanced, stronger, difference, description };
}
