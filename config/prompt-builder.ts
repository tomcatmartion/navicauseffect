// src/llm/prompt-builder.ts
import { configLoader } from '../config/config-loader';

interface PromptTemplates {
  system_prompt: {
    base: string;
    personality: string;
    event: string;
    interaction: string;
  };
  user_prompt_templates: {
    personality: string;
    event: string;
    interaction: string;
    router_question: string;
  };
  phrase_library: Record<string, string>;
  state_transition_hints: Record<string, string>;
}

let templatesCache: PromptTemplates | null = null;

function getTemplates(): PromptTemplates {
  if (!templatesCache) {
    templatesCache = configLoader.get<PromptTemplates>('prompt_templates');
  }
  return templatesCache!;
}

export function buildSystemPrompt(stage: 'personality' | 'event' | 'interaction' | 'router', extraContext?: string): string {
  const tpl = getTemplates();
  let base = tpl.system_prompt.base;
  let stageSpecific = '';
  switch (stage) {
    case 'personality':
      stageSpecific = tpl.system_prompt.personality;
      break;
    case 'event':
      stageSpecific = tpl.system_prompt.event;
      break;
    case 'interaction':
      stageSpecific = tpl.system_prompt.interaction;
      break;
    default:
      stageSpecific = '';
  }
  let result = base + '\n\n' + stageSpecific;
  if (extraContext) {
    result += '\n\n' + extraContext;
  }
  return result;
}

export function buildUserPrompt(stage: 'personality' | 'event' | 'interaction' | 'router', data: Record<string, any>): string {
  const tpl = getTemplates();
  let template = '';
  switch (stage) {
    case 'personality':
      template = tpl.user_prompt_templates.personality;
      break;
    case 'event':
      template = tpl.user_prompt_templates.event;
      break;
    case 'interaction':
      template = tpl.user_prompt_templates.interaction;
      break;
    case 'router':
      template = tpl.user_prompt_templates.router_question;
      break;
  }
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
}

export function getPhrase(key: string, params?: Record<string, string>): string {
  const tpl = getTemplates();
  let phrase = tpl.phrase_library[key] || '';
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      phrase = phrase.replace(`{${k}}`, v);
    }
  }
  return phrase;
}

export function buildChartSnapshot(chartData: any): string {
  const ming = chartData.palaces.find((p: any) => p.name === '命宫');
  const shen = chartData.shenPalace;
  const taiSui = chartData.taiSuiPalace;
  return `命宫：${ming?.major || '空'}（${ming?.brightness || '平'}）\n身宫：${shen?.major || '空'}（${shen?.brightness || '平'}）\n太岁宫：${taiSui?.major || '空'}（${taiSui?.brightness || '平'}）`;
}

export function buildPersonalityData(stage2Output: any): string {
  return `性格标签：${stage2Output.personalityTags?.join('、') || '待分析'}`;
}