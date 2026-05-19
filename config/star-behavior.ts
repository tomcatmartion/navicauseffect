// src/core/star-behavior.ts
import { configLoader } from '../config/config-loader';

export interface StarBehavior {
  type: 'ji' | 'sha' | 'neutral' | 'star' | 'special';
  score: number;
  decay: boolean;
  intensity: boolean;
  special?: 'lu' | 'ji' | 'quan' | 'ke' | 'lu_cun';
  subdueLevel?: 'strong' | 'medium' | 'weak';
}

export interface StarAttribute {
  element?: string;
  coreTrait: string;
  positiveTrait?: string;
  negativeTrait?: string;
  specialNote?: string;
}

export interface StarSystem {
  stars: Record<string, {
    赋性: StarAttribute;
    评分行为: StarBehavior;
  }>;
  全局评分参数: {
    父母四化折扣: number;
    吉星基础分: number;
    煞星基础分: number;
    空间衰减: Record<string, number>;
    夹宫衰减矩阵: Record<string, Record<string, number>>;
    禄存增减分: Record<string, number>;
    亮度初始分与天花板: Record<string, { base: number; ceiling: number }>;
    宫位亮度阈值: Record<string, number>;
    煞星强度系数: Record<string, number>;
    格局倍率: Record<string, number>;
    绝败规则: any;
  };
  夹宫有效组合: Record<string, { left: string; right: string; type: '吉夹' | '煞夹'; note?: string }>;
}

let starSystemCache: StarSystem | null = null;

function getStarSystem(): StarSystem {
  if (!starSystemCache) {
    starSystemCache = configLoader.get<StarSystem>('star_system');
  }
  return starSystemCache!;
}

export function getStarBehavior(starName: string): StarBehavior | null {
  const system = getStarSystem();
  return system.stars[starName]?.评分行为 || null;
}

export function getStarAttribute(starName: string): StarAttribute | null {
  const system = getStarSystem();
  return system.stars[starName]?.赋性 || null;
}

export function getAllJiStars(): string[] {
  const system = getStarSystem();
  return Object.entries(system.stars)
    .filter(([_, v]) => v.评分行为.type === 'ji')
    .map(([name]) => name);
}

export function getAllShaStars(): string[] {
  const system = getStarSystem();
  return Object.entries(system.stars)
    .filter(([_, v]) => v.评分行为.type === 'sha')
    .map(([name]) => name);
}

export function getGlobalScoringParams(): StarSystem['全局评分参数'] {
  return getStarSystem().全局评分参数;
}

export function getJiagongPairs(): StarSystem['夹宫有效组合'] {
  return getStarSystem().夹宫有效组合;
}