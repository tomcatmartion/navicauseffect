// src/core/palace-system.ts
import { configLoader } from '../config/config-loader';

export interface PalaceMeaning {
  meaning: string;
  domains: string[];
  modernContext: string;
}

export interface SkeletonEntry {
  major: string;
  brightness: string;
}

export interface PalaceSkeleton {
  [skeletonId: string]: Record<string, SkeletonEntry>;
}

export interface PalaceSystem {
  宫位含义: Record<string, PalaceMeaning>;
  宫位骨架亮度映射: PalaceSkeleton;
  空宫处理规则: {
    maxRecursionDepth: number;
    decayPerLevel: number;
    defaultBrightness: string;
    defaultBaseScore: number;
    defaultCeiling: number;
  };
  四维合参规则: {
    对宫影响阈值: number;
    三合支撑阈值高: number;
    三合支撑阈值低: number;
    夹宫平衡阈值: number;
  };
}

let palaceSystemCache: PalaceSystem | null = null;

function getPalaceSystem(): PalaceSystem {
  if (!palaceSystemCache) {
    palaceSystemCache = configLoader.get<PalaceSystem>('palace_system');
  }
  return palaceSystemCache!;
}

export function getPalaceMeaning(palaceName: string): PalaceMeaning | null {
  const system = getPalaceSystem();
  return system.宫位含义[palaceName] || null;
}

export function getSkeletonEntry(skeletonId: string, dizhi: string): SkeletonEntry | null {
  const system = getPalaceSystem();
  const skeleton = system.宫位骨架亮度映射[skeletonId];
  if (!skeleton) return null;
  return skeleton[dizhi] || null;
}

export function getEmptyPalaceRule() {
  return getPalaceSystem().空宫处理规则;
}

export function getFourDimensionRule() {
  return getPalaceSystem().四维合参规则;
}