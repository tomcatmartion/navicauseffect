/**
 * 引动分组引擎
 *
 * 将现有 SihuaTrigger[] 按事项宫位分组，生成规范格式的 TriggerGroupSpec[]。
 * 包含 combinedAdvice 模板库（按文档 7.4 节规则）。
 *
 * 数据来源：sihua-trigger-engine.ts 的 detectSihuaTriggers() 输出。
 */

import type { PalaceName, SihuaTrigger } from '../types'
import { PALACE_NAME_TO_INDEX } from '../types'
import type { TriggerGroupSpec, TriggerItemSpec, PalaceLevel } from './types'

// ═══════════════════════════════════════════════════════════════════
// 引动分组
// ═══════════════════════════════════════════════════════════════════

/**
 * 将 SihuaTrigger[] 按目标事项宫位分组
 *
 * @param triggers 来源：stage3.sihuaTriggers
 * @param primaryPalaces 事项宫位列表（顺序与 yuanJu.primary 一致）
 * @param palaceLevels 各事项宫位的 level（用于生成 effect 和 advice）
 * @param triggerTargetLevel 触发层级：'yuanJu'（大限→原局）或 'daXian'（流年→大限）
 */
export function groupTriggers(
  triggers: SihuaTrigger[],
  primaryPalaces: PalaceName[],
  palaceLevels: Map<PalaceName, PalaceLevel>,
  triggerTargetLevel: 'yuanJu' | 'daXian',
): TriggerGroupSpec[] {
  // 按 targetPalace 索引分组
  const palaceIndexToName = new Map<number, PalaceName>()
  for (const name of primaryPalaces) {
    const idx = PALACE_NAME_TO_INDEX[name]
    if (idx !== undefined) palaceIndexToName.set(idx, name)
  }

  // 为每个事项宫位初始化分组
  const groups = new Map<PalaceName, TriggerGroupSpec>()
  for (const name of primaryPalaces) {
    groups.set(name, {
      primaryPalace: name,
      isTriggered: false,
      triggerItems: [],
      combinedAdvice: '',
    })
  }

  // 将引动分配到对应分组
  for (const trigger of triggers) {
    if (trigger.targetLevel !== triggerTargetLevel) continue

    const targetName = palaceIndexToName.get(trigger.targetPalace)
    if (!targetName || !groups.has(targetName)) continue

    const group = groups.get(targetName)!
    group.isTriggered = true
    group.triggerItems.push(convertTriggerItem(trigger))
  }

  // 为每个分组生成 combinedAdvice
  for (const [name, group] of groups) {
    const level = palaceLevels.get(name) ?? '平'
    group.combinedAdvice = generateCombinedAdvice(group, level)
  }

  // 保持与 primaryPalaces 相同的顺序
  return primaryPalaces
    .map(name => groups.get(name)!)
    .filter((g): g is TriggerGroupSpec => g !== undefined)
}

/** 转换单条引动为规范格式 */
function convertTriggerItem(trigger: SihuaTrigger): TriggerItemSpec {
  return {
    type: trigger.type,
    star: trigger.targetStar,
    sihuaPalace: indexToPalaceName(trigger.triggerPalaces[0] ?? 0),
    relation: trigger.relation,
    effect: generateEffectText(trigger),
  }
}

// ═══════════════════════════════════════════════════════════════════
// effect 文本生成（对齐文档 7.4 节）
// ═══════════════════════════════════════════════════════════════════

/** 关系前缀 */
const RELATION_PREFIX: Record<string, string> = {
  '本宫': '直接落宫',
  '对宫': '对冲引动',
  '三合': '三合引动',
  '双夹': '双夹引动',
}

/** 根据引动类型和宫位等级生成 effect 文本 */
function generateEffectText(trigger: SihuaTrigger): string {
  const prefix = `化${trigger.type}`
  const relationText = RELATION_PREFIX[trigger.relation] ?? '引动'

  return `${prefix}${relationText}`
}

// ═══════════════════════════════════════════════════════════════════
// combinedAdvice 模板库
// ═══════════════════════════════════════════════════════════════════

/**
 * 根据引动情况生成综合建议
 *
 * 模板类别（对齐文档 7.4 节）：
 * - 纯吉引动：所有引动均为 禄/权/科
 * - 纯凶引动：所有引动均为 忌
 * - 吉凶混杂：同时有吉引和凶引
 * - 无引动：无引动
 *
 * 再结合宫位等级（吉旺/平/凶弱）选择具体模板。
 */
function generateCombinedAdvice(
  group: TriggerGroupSpec,
  level: PalaceLevel,
): string {
  if (!group.isTriggered || group.triggerItems.length === 0) {
    return ADVICE_TEMPLATES.noTrigger[level]
  }

  const auspicious = group.triggerItems.filter(t => t.type !== '忌').length
  const inauspicious = group.triggerItems.filter(t => t.type === '忌').length

  if (inauspicious === 0) {
    // 纯吉引动
    return ADVICE_TEMPLATES.pureAuspicious[level]
      .replace('{count}', String(auspicious))
  }

  if (auspicious === 0) {
    // 纯凶引动
    return ADVICE_TEMPLATES.pureInauspicious[level]
      .replace('{count}', String(inauspicious))
  }

  // 吉凶混杂
  return ADVICE_TEMPLATES.mixed[level]
    .replace('{good}', String(auspicious))
    .replace('{bad}', String(inauspicious))
}

/** 建议模板库（4类 × 3等级 = 12条） */
const ADVICE_TEMPLATES = {
  noTrigger: {
    '吉旺': '暂无额外引动，保持现状，稳中求进。',
    '平': '暂无额外引动，建议观望，不宜冒进。',
    '凶弱': '暂无额外引动，底子偏弱，需耐心等待转机。',
  },
  pureAuspicious: {
    '吉旺': '获{count}重吉引，根基扎实且机遇增多，可积极把握。',
    '平': '获{count}重吉引，有助力但根基一般，宜稳中求进。',
    '凶弱': '获{count}重吉引，短期有转机但根基不稳，需见好就收。',
  },
  pureInauspicious: {
    '吉旺': '逢{count}重凶引，增加波折但根基尚稳，可化解。',
    '平': '逢{count}重凶引，阻力增大，需谨慎应对。',
    '凶弱': '逢{count}重凶引，严重阻碍，宜退守保全。',
  },
  mixed: {
    '吉旺': '吉凶混杂（{good}吉{bad}凶），机遇与挑战并存，需择善而从。',
    '平': '吉凶混杂（{good}吉{bad}凶），助力与阻力交织，宜审慎决策。',
    '凶弱': '吉凶混杂（{good}吉{bad}凶），短暂转机但阻力仍大，不宜过度乐观。',
  },
}

/** 索引转宫名 */
function indexToPalaceName(idx: number): PalaceName {
  const names: readonly PalaceName[] = [
    '命宫', '父母', '福德', '田宅', '官禄', '仆役',
    '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
  ]
  return names[idx % 12] ?? '命宫'
}

/**
 * 从 PalaceScoreBrief 的 level 字段提取 PalaceLevel
 * （供外部调用方使用）
 */
export function extractPalaceLevelsFromScores(
  scores: Array<{ palaceName: PalaceName; level: string }>,
): Map<PalaceName, PalaceLevel> {
  const levels = new Map<PalaceName, PalaceLevel>()
  for (const s of scores) {
    if (s.level === '吉旺' || s.level === '平' || s.level === '凶弱') {
      levels.set(s.palaceName, s.level)
    } else {
      levels.set(s.palaceName, '平')
    }
  }
  return levels
}
