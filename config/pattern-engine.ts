// src/core/pattern-engine.ts
import { configLoader } from '../config/config-loader';
import type { ChartContext } from '../types';

interface Condition {
  and?: Condition[];
  or?: Condition[];
  not?: Condition;
  starInPalace?: { star: string; palaceName: string; dizhi?: string };
  anyStarInPalace?: { stars: string[]; palaceName: string };
  allStarsInTriples?: { stars: string[]; basePalace: string };
  anyStarInTriples?: { stars: string[]; basePalace: string };
  palaceBrightness?: { palaceName: string; brightness: string };
  // 可扩展更多原子条件
}

interface Pattern {
  id: string;
  level: string;
  stage: 'bonus' | 'penalty';
  scope: 'corePalaces' | 'fullDisk';
  multiplier: number;
  category: string;
  description: string;
  trigger?: string;
  condition?: Condition;
}

interface PatternLibrary {
  version: string;
  multipliers: Record<string, number>;
  patterns: Pattern[];
}

let patternLibraryCache: PatternLibrary | null = null;

function getPatternLibrary(): PatternLibrary {
  if (!patternLibraryCache) {
    patternLibraryCache = configLoader.get<PatternLibrary>('pattern_library');
  }
  return patternLibraryCache!;
}

function evaluateCondition(cond: Condition, ctx: ChartContext): boolean {
  if (cond.and) return cond.and.every(c => evaluateCondition(c, ctx));
  if (cond.or) return cond.or.some(c => evaluateCondition(c, ctx));
  if (cond.not) return !evaluateCondition(cond.not, ctx);

  if (cond.starInPalace) {
    const palace = ctx.getPalaceByName(cond.starInPalace.palaceName);
    if (!palace) return false;
    if (cond.starInPalace.dizhi && palace.dizhi !== cond.starInPalace.dizhi) return false;
    return palace.major === cond.starInPalace.star || (palace.minorStars || []).includes(cond.starInPalace.star);
  }

  if (cond.anyStarInPalace) {
    const palace = ctx.getPalaceByName(cond.anyStarInPalace.palaceName);
    if (!palace) return false;
    return cond.anyStarInPalace.stars.some(s => palace.major === s || (palace.minorStars || []).includes(s));
  }

  if (cond.allStarsInTriples) {
    const triples = ctx.getTriples(cond.allStarsInTriples.basePalace);
    return cond.allStarsInTriples.stars.every(star =>
      triples.some(p => p.major === star || (p.minorStars || []).includes(star))
    );
  }

  if (cond.anyStarInTriples) {
    const triples = ctx.getTriples(cond.anyStarInTriples.basePalace);
    return cond.anyStarInTriples.stars.some(star =>
      triples.some(p => p.major === star || (p.minorStars || []).includes(star))
    );
  }

  if (cond.palaceBrightness) {
    const palace = ctx.getPalaceByName(cond.palaceBrightness.palaceName);
    return palace?.brightness === cond.palaceBrightness.brightness;
  }

  return false;
}

export function matchPatterns(ctx: ChartContext): Record<string, Pattern[]> {
  const lib = getPatternLibrary();
  const result: Record<string, Pattern[]> = {};

  for (const pattern of lib.patterns) {
    if (!pattern.condition) continue;
    if (evaluateCondition(pattern.condition, ctx)) {
      const corePalace = pattern.scope === 'corePalaces' ? ctx.getCorePalace() : '全局';
      if (!result[corePalace]) result[corePalace] = [];
      result[corePalace].push(pattern);
    }
  }
  return result;
}

export function getPatternMultiplier(level: string): number {
  const lib = getPatternLibrary();
  return lib.multipliers[level] || 1.0;
}