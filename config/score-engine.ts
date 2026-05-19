// src/core/score-engine.ts
import { getStarBehavior, getGlobalScoringParams, getAllJiStars, getAllShaStars } from './star-behavior';
import { getSkeletonEntry, getEmptyPalaceRule } from './palace-system';
import { matchPatterns, getPatternMultiplier } from './pattern-engine';
import type { PalaceData, ChartContext, ScoredPalace } from '../types';

function getSpaceDecay(relation: '本宫' | '对宫' | '三合' | '夹宫', selfBrightness: string, flankBrightness?: string): number {
  const params = getGlobalScoringParams();
  if (relation === '本宫') return params.空间衰减['本宫'];
  if (relation === '对宫') return params.空间衰减['对宫'];
  if (relation === '三合') return params.空间衰减['三合'];
  if (relation === '夹宫' && flankBrightness) {
    const matrix = params.夹宫衰减矩阵;
    const selfKey = selfBrightness === '实旺' || selfBrightness === '旺' ? '本宫旺' : (selfBrightness === '平' ? '本宫平' : '本宫弱');
    const flankKey = flankBrightness === '实旺' || flankBrightness === '旺' ? '夹宫旺' : (flankBrightness === '平' ? '夹宫平' : '夹宫弱');
    return matrix[selfKey]?.[flankKey] || 0;
  }
  return 1.0;
}

function getIntensityFactor(brightness: string): number {
  const params = getGlobalScoringParams();
  return params.煞星强度系数[brightness] || 1.0;
}

function applyStarsScore(palace: PalaceData, starNames: string[], spaceFactor: number, intensityFactor: number): number {
  let total = 0;
  for (const star of starNames) {
    const behavior = getStarBehavior(star);
    if (!behavior) continue;
    let score = behavior.score;
    if (behavior.decay) score *= spaceFactor;
    if (behavior.intensity) score *= intensityFactor;
    total += score;
  }
  return total;
}

function handleLuCun(palace: PalaceData, brightness: string): number {
  const params = getGlobalScoringParams();
  const delta = params.禄存增减分[brightness] || 0;
  return palace.hasLuCun ? delta : 0;
}

function getSkeletonScore(skeletonId: string, dizhi: string): { base: number; ceiling: number } {
  const entry = getSkeletonEntry(skeletonId, dizhi);
  const params = getGlobalScoringParams();
  const brightness = entry?.brightness || getEmptyPalaceRule().defaultBrightness;
  const config = params.亮度初始分与天花板[brightness];
  return { base: config.base, ceiling: config.ceiling };
}

function getBrightnessLevel(score: number): string {
  const params = getGlobalScoringParams();
  const thresholds = params.宫位亮度阈值;
  for (const [level, th] of Object.entries(thresholds)) {
    if (score >= th) return level;
  }
  return '绝败';
}

export function scorePalace(palace: PalaceData, skeletonId: string, ctx: ChartContext): ScoredPalace {
  const params = getGlobalScoringParams();
  let { base: score, ceiling } = getSkeletonScore(skeletonId, palace.dizhi);

  // 加分阶段
  const jiStars = getAllJiStars();
  let add = 0;
  // 本宫
  add += applyStarsScore(palace, jiStars, getSpaceDecay('本宫'), 1.0);
  // 对宫
  const opposite = ctx.getOpposite(palace);
  add += applyStarsScore(opposite, jiStars, getSpaceDecay('对宫'), 1.0);
  // 三合
  const trines = ctx.getTrines(palace);
  for (const tri of trines) {
    add += applyStarsScore(tri, jiStars, getSpaceDecay('三合'), 1.0);
  }
  // 夹宫 (需有效夹，此处简化，实际需检查左右星曜是否构成有效夹)
  const left = ctx.getLeft(palace);
  const right = ctx.getRight(palace);
  if (left && right) {
    const decay = getSpaceDecay('夹宫', getBrightnessLevel(score), left.brightness);
    add += applyStarsScore(left, jiStars, decay, 1.0);
    add += applyStarsScore(right, jiStars, decay, 1.0);
  }
  score += add;

  // 重定亮度
  const newBrightness = getBrightnessLevel(score);
  const intensity = getIntensityFactor(newBrightness);

  // 减分阶段
  const shaStars = getAllShaStars();
  let sub = 0;
  sub += applyStarsScore(palace, shaStars, getSpaceDecay('本宫'), intensity);
  sub += applyStarsScore(opposite, shaStars, getSpaceDecay('对宫'), intensity);
  for (const tri of trines) {
    sub += applyStarsScore(tri, shaStars, getSpaceDecay('三合'), intensity);
  }
  if (left && right) {
    const decay = getSpaceDecay('夹宫', newBrightness, left.brightness);
    sub += applyStarsScore(left, shaStars, decay, intensity);
    sub += applyStarsScore(right, shaStars, decay, intensity);
  }
  score += sub;

  // 禄存处理
  score += handleLuCun(palace, newBrightness);

  // 格局倍率
  const patterns = matchPatterns(ctx);
  let maxBonus = 1.0;
  for (const p of patterns[palace.name] || []) {
    const multiplier = getPatternMultiplier(p.level);
    if (p.stage === 'bonus' && multiplier > maxBonus) maxBonus = multiplier;
  }
  score *= maxBonus;

  // 天花板截断
  const finalScore = Math.min(score, ceiling);
  return { ...palace, finalScore, brightness: newBrightness };
}