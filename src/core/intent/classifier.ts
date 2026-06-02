/**
 * 意图分类器 — 基于规则的用户意图识别
 *
 * 规则优先级（按序评估）：
 * 1. REPORT — 生成报告关键词
 * 2. INTERACTION — 互动关系关键词 + 年份
 * 3. RE_CALC — 年份变更 + 有活跃事项
 * 4. NEW_MATTER — 检测到新事项类型
 * 5. FOLLOW_UP — 追问词 + 有活跃事项
 * 6. CHITCHAT — 兜底
 */

import type { IntentAction, IntentResult, IntentContext } from './types'
import { detectMatterIntent } from '../router/decision-tree'
import type { MatterType } from '../types'

// ── 关键词库 ──────────────────────────────────────────────

const REPORT_KEYWORDS = ['生成报告', '总结报告', '帮我整理报告', '出报告', '整理一下', '生成解读报告', '综合报告']
const INTERACTION_KEYWORDS = ['对方', '互动', '合盘', '他', '她', '伴侣', '另一半', '男朋友', '女朋友', '老公', '老婆', '爱人']
const FOLLOW_UP_PATTERNS = /为什么|怎么说|具体|详细|什么意思|怎么理解|那呢|然后呢|继续|再说|还有|深入|展开|比如|举个例子|能不能.*说|是不是|是不是.*的意思/
const YEAR_PATTERN = /(\d{2,4})年/

/** 事项关键词映射（补充 decision-tree 覆盖不到的场景） */
const MATTER_KEYWORDS: Record<string, string[]> = {
  '求财': ['财', '钱', '投资', '赚', '收入', '工资', '理财', '偏财', '正财'],
  '求爱': ['爱', '情', '婚', '恋', '对象', '桃花', '感情', '姻缘', '脱单', '约会', '相亲'],
  '求学': ['学', '考', '试', '书', '研', '读', '升', '培训', '证', '毕业'],
  '求职': ['职', '工作', '业', '跳', '升职', '面试', '转行', '创业'],
  '求健康': ['健康', '病', '身体', '手术', '治疗', '体检', '养生'],
  '求名': ['名', '声', '传播', '品牌', '影响', '粉丝', '曝光'],
}

// ── 年份提取 ──────────────────────────────────────────────

/**
 * 从用户输入中提取年份
 * 支持：「2026年」「26年」格式
 */
function extractYear(text: string): number | null {
  const match = text.match(YEAR_PATTERN)
  if (!match) return null
  let y = parseInt(match[1], 10)
  if (y < 100) y += 2000
  if (y < 1900 || y > 2100) return null
  return y
}

/**
 * 从用户输入中提取对方出生年份
 * 支持：「对方1990年的」「他1990年出生」等格式
 */
function extractPartnerBirthYear(text: string): number | null {
  // 匹配「1990年」「1990年出生」「1990年的」
  const match = text.match(/(\d{4})(?:年|的|出生)/)
  if (!match) return null
  const y = parseInt(match[1], 10)
  if (y < 1930 || y > 2015) return null
  return y
}

// ── 事项检测 ──────────────────────────────────────────────

/**
 * 检测用户消息中的事项类型
 * 优先使用 decision-tree 的意图识别，降级到关键词匹配
 */
function detectMatterType(text: string): MatterType | null {
  // 优先使用决策树
  const intent = detectMatterIntent(text)
  if (intent && intent !== '综合') {
    return intent as MatterType
  }

  // 降级到关键词匹配
  for (const [matter, keywords] of Object.entries(MATTER_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return matter as MatterType
    }
  }
  return null
}

// ── 核心分类器 ────────────────────────────────────────────

/**
 * 对用户消息进行意图分类
 *
 * @param userMessage 用户输入的消息
 * @param context 当前会话上下文
 * @returns 意图分类结果
 */
export function classify(userMessage: string, context: IntentContext): IntentResult {
  const text = userMessage.trim()
  if (!text) {
    return { action: 'CHITCHAT' }
  }

  // ── 1. REPORT：报告生成关键词 ──
  if (REPORT_KEYWORDS.some(kw => text.includes(kw))) {
    // 如果有活跃事项，带上下文生成报告
    return { action: 'REPORT' }
  }

  // ── 2. INTERACTION：互动关系关键词 ──
  const hasInteractionKeyword = INTERACTION_KEYWORDS.some(kw => text.includes(kw))
  if (hasInteractionKeyword) {
    const partnerYear = extractPartnerBirthYear(text)
    // 如果消息中包含事项关键词（如「我们的事业」），则不算互动
    const matterHint = detectMatterType(text)
    if (!matterHint) {
      return {
        action: 'INTERACTION',
        partnerBirthYear: partnerYear ?? undefined,
      }
    }
  }

  // ── 3. 检测年份变更 ──
  const extractedYear = extractYear(text)

  // ── 4. 检测事项类型 ──
  const matterType = detectMatterType(text)

  // ── 5. RE_CALC：年份变更 + 有活跃事项 ──
  if (extractedYear !== null && context.currentMatterKey !== null) {
    const currentYear = context.currentQueryYear ?? new Date().getFullYear()
    if (extractedYear !== currentYear) {
      return {
        action: 'RE_CALC',
        matterType: context.currentMatterKey as MatterType,
        targetYear: extractedYear,
      }
    }
  }

  // ── 6. NEW_MATTER：检测到新事项类型 ──
  if (matterType !== null) {
    // 如果和当前活跃事项不同，视为新事项
    if (matterType !== context.currentMatterKey) {
      return {
        action: 'NEW_MATTER',
        matterType,
        targetYear: extractedYear ?? undefined,
      }
    }
    // 同一事项 + 年份变更（但年份相同或无年份）→ FOLLOW_UP
    if (extractedYear !== null && context.currentQueryYear !== null && extractedYear !== context.currentQueryYear) {
      return {
        action: 'RE_CALC',
        matterType,
        targetYear: extractedYear,
      }
    }
  }

  // ── 7. FOLLOW_UP：追问词 + 有活跃事项 ──
  if (context.currentMatterKey !== null && FOLLOW_UP_PATTERNS.test(text)) {
    return { action: 'FOLLOW_UP' }
  }

  // ── 8. NEW_MATTER：即使没有活跃事项，但检测到事项关键词 ──
  if (matterType !== null && context.currentMatterKey === null) {
    return {
      action: 'NEW_MATTER',
      matterType,
      targetYear: extractedYear ?? undefined,
    }
  }

  // ── 9. CHITCHAT：兜底 ──
  return { action: 'CHITCHAT' }
}

/**
 * 获取意图动作的中文描述（用于调试和日志）
 */
export function getActionLabel(action: IntentAction): string {
  const labels: Record<IntentAction, string> = {
    NEW_MATTER: '新事项',
    RE_CALC: '年份重算',
    FOLLOW_UP: '追问',
    CHITCHAT: '闲聊',
    REPORT: '生成报告',
    INTERACTION: '互动关系',
  }
  return labels[action]
}
