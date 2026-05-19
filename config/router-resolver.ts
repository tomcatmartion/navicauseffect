// src/core/router-resolver.ts
import { configLoader } from '../config/config-loader';

interface Option {
  label: string;
  value: string;
  next: string;
}

interface Question {
  id: string;
  question: string;
  options: Option[];
}

interface Resolver {
  primaryPalace?: string;
  primaryRules?: Array<{ condition: string; palace: string }>;
  defaultPrimary?: string;
  secondaryRules?: Array<{ condition: string; palace: string }>;
  specialConditions?: Array<{ condition: string; text: string }>;
  needInteractionRules?: string[];
}

interface Branch {
  firstQuestion: string;
  questions: Record<string, Question>;
  resolver: Resolver;
}

interface RouterTree {
  version: string;
  branches: Record<string, Branch>;
  intentDetection: Array<{ keywords: string[]; type: string }>;
}

let routerTreeCache: RouterTree | null = null;

function getRouterTree(): RouterTree {
  if (!routerTreeCache) {
    routerTreeCache = configLoader.get<RouterTree>('routing');
  }
  return routerTreeCache!;
}

export function detectIntent(userInput: string): string | null {
  const tree = getRouterTree();
  for (const item of tree.intentDetection) {
    if (item.keywords.some(kw => userInput.includes(kw))) {
      return item.type;
    }
  }
  return null;
}

export function getBranch(matterType: string): Branch | null {
  const tree = getRouterTree();
  return tree.branches[matterType] || null;
}

export function getFirstQuestion(matterType: string): Question | null {
  const branch = getBranch(matterType);
  if (!branch) return null;
  const firstId = branch.firstQuestion;
  return branch.questions[firstId] || null;
}

export function getNextQuestion(matterType: string, currentQuestionId: string, selectedValue: string): Question | null {
  const branch = getBranch(matterType);
  if (!branch) return null;
  const current = branch.questions[currentQuestionId];
  if (!current) return null;
  const option = current.options.find(opt => opt.value === selectedValue);
  if (!option) return null;
  if (option.next === 'result') return null;
  return branch.questions[option.next] || null;
}

export function resolvePalaces(matterType: string, answers: Record<string, string>): {
  primary: string;
  secondary: string[];
  specialConditions: string[];
  needInteraction: boolean;
} {
  const branch = getBranch(matterType);
  if (!branch) return { primary: '', secondary: [], specialConditions: [], needInteraction: false };

  const resolver = branch.resolver;
  let primary = resolver.defaultPrimary || '';
  const secondarySet = new Set<string>();
  const specials: string[] = [];
  let needInteraction = false;

  // 处理 primaryRules
  if (resolver.primaryRules) {
    for (const rule of resolver.primaryRules) {
      // 简单条件评估（实际可用安全 eval 或表达式引擎）
      // 此处简化，实际应实现条件解析器
      if (rule.condition.includes(`answers['${Object.keys(answers)[0]}'] === '${answers[Object.keys(answers)[0]]}'`)) {
        primary = rule.palace;
        break;
      }
    }
  }
  if (!primary && resolver.primaryPalace) primary = resolver.primaryPalace;

  // 处理 secondaryRules
  if (resolver.secondaryRules) {
    for (const rule of resolver.secondaryRules) {
      // 同样简化条件判断
      if (rule.condition.includes(`answers['${Object.keys(answers)[0]}'] === '${answers[Object.keys(answers)[0]]}'`)) {
        secondarySet.add(rule.palace);
      }
    }
  }

  // 处理 specialConditions
  if (resolver.specialConditions) {
    for (const cond of resolver.specialConditions) {
      if (cond.condition.includes(`answers['${Object.keys(answers)[0]}'] === '${answers[Object.keys(answers)[0]]}'`)) {
        specials.push(cond.text);
      }
    }
  }

  // 处理 needInteractionRules
  if (resolver.needInteractionRules) {
    for (const rule of resolver.needInteractionRules) {
      if (rule.includes(`answers['${Object.keys(answers)[0]}'] === '${answers[Object.keys(answers)[0]]}'`)) {
        needInteraction = true;
      }
    }
  }

  return {
    primary,
    secondary: Array.from(secondarySet),
    specialConditions: specials,
    needInteraction,
  };
}