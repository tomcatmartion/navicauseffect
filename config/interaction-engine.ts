// src/core/interaction-engine.ts
import { configLoader } from '../config/config-loader';
import type { ChartContext, InteractionContext } from '../types';

interface RuleCondition {
  op: 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
  lhs: { var: string };
  rhs: number;
}

interface TensionRule {
  name: string;
  condition: RuleCondition;
  template: string;
  priority: number;
}

interface AdjustableAdvice {
  [key: string]: { trigger: string; text: string };
}

interface FixedRisk {
  tooManyJi: { condition: RuleCondition; text: string };
}

interface SoloAnalysis {
  spouseIdx: number;
  oppositeIdx: number;
  fortuneIdx: number;
  childrenIdx: number;
  tensionThresholds: { lowScore: number };
}

interface ThreeDimensionTemplates {
  dimensionA: { early: string; late: string };
  dimensionC: { decadal: string; yearly: string };
}

interface InteractionRules {
  version: string;
  tensionRules: TensionRule[];
  adjustableAdvice: AdjustableAdvice;
  fixedRisks: FixedRisk;
  soloAnalysis: SoloAnalysis;
  threeDimensionTemplates: ThreeDimensionTemplates;
}

let interactionRulesCache: InteractionRules | null = null;

function getInteractionRules(): InteractionRules {
  if (!interactionRulesCache) {
    interactionRulesCache = configLoader.get<InteractionRules>('interaction_rules');
  }
  return interactionRulesCache!;
}

function evaluateCondition(cond: RuleCondition, ctx: InteractionContext): boolean {
  const value = (() => {
    switch (cond.lhs.var) {
      case 'jiCount': return ctx.jiStars.length;
      case 'quanCount': return ctx.quanStars.length;
      case 'luCount': return ctx.luStars.length;
      default: return 0;
    }
  })();
  switch (cond.op) {
    case 'gte': return value >= cond.rhs;
    case 'gt': return value > cond.rhs;
    case 'lte': return value <= cond.rhs;
    case 'lt': return value < cond.rhs;
    case 'eq': return value === cond.rhs;
    default: return false;
  }
}

export function analyzeTension(ctx: InteractionContext): { rule: TensionRule; message: string } | null {
  const rules = getInteractionRules().tensionRules;
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (evaluateCondition(rule.condition, ctx)) {
      let message = rule.template;
      message = message.replace('{stars}', ctx.jiStars.join('、'));
      message = message.replace('{zhi}', ctx.palaceDizhi);
      message = message.replace('{quanStar}', ctx.quanStars[0] || '');
      message = message.replace('{jiStar}', ctx.jiStars[0] || '');
      message = message.replace('{luStar}', ctx.luStars[0] || '');
      return { rule, message };
    }
  }
  return null;
}

export function getAdjustableAdvice(trigger: string): string {
  const rules = getInteractionRules();
  return rules.adjustableAdvice[trigger]?.text || rules.adjustableAdvice.default?.text || '';
}

export function getFixedRisk(ctx: InteractionContext): string | null {
  const rules = getInteractionRules();
  if (evaluateCondition(rules.fixedRisks.tooManyJi.condition, ctx)) {
    return rules.fixedRisks.tooManyJi.text;
  }
  return null;
}

export function getSoloAnalysisConfig() {
  return getInteractionRules().soloAnalysis;
}

export function getThreeDimensionTemplates() {
  return getInteractionRules().threeDimensionTemplates;
}