// src/core/limit-engine.ts
import { configLoader } from '../config/config-loader';
import type { LimitContext, LimitAnalysisResult } from '../types';

interface LimitConfig {
  version: string;
  matterTypeMappings: Record<string, any>;
  timeAnalysis: {
    weights: { daXian: number; liuNian: number; liuYue: number };
    directionJudgment: {
      matrix: Record<string, { strength: string; judgment: string; suggestion: string; description: string }>;
    };
  };
  directionMatrix: {
    windowSize: number;
    scoreThresholds: Record<string, { min: number; label: string; action: string }>;
    palaceWeights: Record<string, Record<string, number>>;
  };
  sihuaWeights: {
    daXianSihua: { weight: number; rules: Record<string, { effect: string; scoreAdjustment: number }> };
    liuNianSihua: { weight: number; rules: Record<string, { effect: string; scoreAdjustment: number }> };
    liuYueSihua: { weight: number; rules: Record<string, { effect: string; scoreAdjustment: number }> };
  };
  daXianQualitative: {
    levels: Record<string, { scoreRange: number[]; features: string; protectionNeeded: boolean | string; effect: string; color: string }>;
  };
  liuNianTimeWindow: {
    windows: Record<string, { condition: string; action: string; duration: string }>;
  };
  innateLevelMap: {
    levels: Record<string, { scoreRange: number[]; description: string; carryingCapacity: string; sihuaEffect: string; advice: string }>;
  };
  protectionMechanism: {
    mechanisms: Record<string, { priority: number; description: string; effect: string; scoreBonus: number }>;
  };
  palaceProjection: {
    coefficients: Record<string, { factor: number; description: string } | { description: string; matrix: Record<string, Record<string, number>> }>;
  };
  compositeScoring: {
    formula: {
      [key: string]: string | Record<string, number>;
    };
  };
}

let limitConfigCache: LimitConfig | null = null;

function getLimitConfig(): LimitConfig {
  if (!limitConfigCache) {
    limitConfigCache = configLoader.get<LimitConfig>('limit_analysis');
  }
  return limitConfigCache!;
}

export function getMatterMapping(matterType: string) {
  return getLimitConfig().matterTypeMappings[matterType] || null;
}

export function getTimeWeights() {
  return getLimitConfig().timeAnalysis.weights;
}

export function getDirectionJudgment(liuNianDir: string, daXianDir: string) {
  const matrix = getLimitConfig().timeAnalysis.directionJudgment.matrix;
  const key = `${liuNianDir}◇${daXianDir}`;
  return matrix[key] || null;
}

export function getPalaceWeights(matterType: string): Record<string, number> {
  const weights = getLimitConfig().directionMatrix.palaceWeights;
  return weights[matterType] || {};
}

export function getScoreThreshold(score: number): { label: string; action: string } {
  const thresholds = getLimitConfig().directionMatrix.scoreThresholds;
  for (const [key, val] of Object.entries(thresholds)) {
    if (score >= val.min) return { label: val.label, action: val.action };
  }
  return { label: '未知', action: '谨慎' };
}

export function getDaXianSihuaAdjustment(ruleKey: string): number {
  const rules = getLimitConfig().sihuaWeights.daXianSihua.rules;
  return rules[ruleKey]?.scoreAdjustment || 0;
}

export function getLiuNianSihuaAdjustment(ruleKey: string): number {
  const rules = getLimitConfig().sihuaWeights.liuNianSihua.rules;
  return rules[ruleKey]?.scoreAdjustment || 0;
}

export function getLiuYueSihuaAdjustment(ruleKey: string): number {
  const rules = getLimitConfig().sihuaWeights.liuYueSihua.rules;
  return rules[ruleKey]?.scoreAdjustment || 0;
}

export function getDaXianQualitative(score: number): string {
  const levels = getLimitConfig().daXianQualitative.levels;
  for (const [level, val] of Object.entries(levels)) {
    if (score >= val.scoreRange[0] && score <= val.scoreRange[1]) return level;
  }
  return '危机期';
}

export function getLiuNianTimeWindow(daXianDir: string, liuNianDir: string): string {
  const windows = getLimitConfig().liuNianTimeWindow.windows;
  for (const [name, win] of Object.entries(windows)) {
    // 简单条件匹配，实际可扩展
    if (name === '推进窗口' && daXianDir === '吉' && liuNianDir === '吉') return name;
    if (name === '风险期' && daXianDir === '凶' && liuNianDir === '凶') return name;
    if (name === '蛰伏期' && daXianDir === '吉' && liuNianDir === '平') return name;
    if (name === '挑战期' && daXianDir === '凶' && liuNianDir === '吉') return name;
  }
  return '蛰伏期';
}

export function getInnateLevel(score: number): string {
  const levels = getLimitConfig().innateLevelMap.levels;
  for (const [level, val] of Object.entries(levels)) {
    if (score >= val.scoreRange[0] && score <= val.scoreRange[1]) return level;
  }
  return '凶危';
}

export function getProtectionMechanisms(): Record<string, any> {
  return getLimitConfig().protectionMechanism.mechanisms;
}

export function getPalaceProjectionFactor(relation: string, selfBrightness?: string, flankBrightness?: string): number {
  const coeffs = getLimitConfig().palaceProjection.coefficients;
  const item = coeffs[relation];
  if (typeof item === 'object' && 'factor' in item) return item.factor;
  if (relation === '夹宫' && selfBrightness && flankBrightness) {
    const matrix = (item as any).matrix;
    const selfKey = selfBrightness === '旺' ? '本宫旺' : (selfBrightness === '平' ? '本宫平' : '本宫弱');
    const flankKey = flankBrightness === '旺' ? '夹宫旺' : (flankBrightness === '平' ? '夹宫平' : '夹宫弱');
    return matrix[selfKey]?.[flankKey] || 0;
  }
  return 1.0;
}

export function computeCompositeScore(
  originScore: number,
  daXianScore: number,
  liuNianScore: number,
  liuYueScore: number,
  mingRegulator: number
): number {
  const formula = getLimitConfig().compositeScoring.formula;
  const originWeight = 0.3;
  const daXianWeight = getTimeWeights().daXian;
  const liuNianWeight = getTimeWeights().liuNian;
  const liuYueWeight = getTimeWeights().liuYue;
  return originScore * originWeight + daXianScore * daXianWeight + liuNianScore * liuNianWeight + liuYueScore * liuYueWeight;
}