/**
 * sihua_trigger_rules.json 查询辅助
 */

import { getSihuaTriggerRules } from './loader'

export type TriggerSihuaType = '禄' | '权' | '科' | '忌'
export type TriggerSpatialRelation = '本宫' | '对宫' | '三合' | '双夹'

function getRulesBlock(): Record<string, unknown> {
  const raw = getSihuaTriggerRules()
  return (raw.rules ?? raw) as Record<string, unknown>
}

/** 读取引动效果模板 */
export function getTriggerEffectTemplate(
  type: TriggerSihuaType,
  relation: TriggerSpatialRelation,
): string {
  const templates = getRulesBlock()['引动效果模板'] as Record<string, Record<string, string>> | undefined
  return templates?.[type]?.[relation] ?? `${type}化${relation}引动`
}

/** 读取空间关系权重 */
export function getTriggerSpatialWeight(relation: TriggerSpatialRelation): number {
  const weights = (getRulesBlock()['影响评估'] as Record<string, Record<string, number>> | undefined)
    ?.['效果权重']
  return weights?.[relation] ?? 1.0
}

/** 将模板中的占位替换为具体层级描述 */
export function formatTriggerEffect(
  template: string,
  triggerLevel: 'daXian' | 'liuNian',
  targetLevel: 'yuanJu' | 'daXian',
): string {
  const triggerLabel = triggerLevel === 'daXian' ? '大限' : '流年'
  const targetLabel = targetLevel === 'yuanJu' ? '原局' : '大限'
  const timeLabel = triggerLevel === 'daXian' ? '十年' : '当年'
  return template
    .replace(/大限\/流年/g, triggerLabel)
    .replace(/原局\/大限/g, targetLabel)
    .replace(/十年\/当年/g, timeLabel)
}
