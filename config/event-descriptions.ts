// src/core/event-descriptions.ts
import { configLoader } from '../config/config-loader';

type BrightnessLevel = '实旺' | '磨炼' | '平' | '虚浮' | '凶危';

interface EventDescription {
  [event: string]: {
    [palace: string]: {
      [star: string]: {
        [level in BrightnessLevel]?: string;
      };
    };
  };
}

let eventDescriptionsCache: EventDescription | null = null;

function getEventDescriptions(): EventDescription {
  if (!eventDescriptionsCache) {
    eventDescriptionsCache = configLoader.get<EventDescription>('event_descriptions');
  }
  return eventDescriptionsCache!;
}

/**
 * 获取事项描述
 * @param event 事项类型: '求学' | '求爱' | '求财' | '求职' | '求健康' | '求名'
 * @param palace 宫位名: '事业宫' | '迁移宫' | '田宅宫' | '夫妻宫' | '福德宫' | '财帛宫' | '官禄宫' | '仆役宫' | '疾厄宫' | '命宫' | '父母宫'
 * @param star 主星名: '紫微' | '武曲' ...
 * @param level 亮度等级: '实旺' | '磨炼' | '平' | '虚浮' | '凶危'
 * @returns 描述文本，若未找到则返回空字符串
 */
export function getEventStarDescription(
  event: string,
  palace: string,
  star: string,
  level: BrightnessLevel
): string {
  const data = getEventDescriptions();
  return data[event]?.[palace]?.[star]?.[level] || '';
}

/**
 * 获取所有可用事项类型
 */
export function getAvailableEvents(): string[] {
  return Object.keys(getEventDescriptions());
}

/**
 * 获取某事项下的所有宫位
 */
export function getEventPalaces(event: string): string[] {
  return Object.keys(getEventDescriptions()[event] || {});
}

/**
 * 获取某事项某宫位下的所有主星
 */
export function getEventStars(event: string, palace: string): string[] {
  return Object.keys(getEventDescriptions()[event]?.[palace] || {});
}