/**
 * 滑动窗口 + 对话摘要 — 上下文长度控制
 *
 * 策略：
 * - 保留最近 3 轮（6 条消息）完整原文
 * - 更早的消息压缩为一句话摘要
 * - 摘要累积存入 conversationSummary（上限 300 字）
 * - 摘要作为 system message 注入：「【对话摘要】{conversationSummary}」
 */

import type { ConversationMessage } from '../adapters/iztro/types'

const MAX_KEEP_ROUNDS = 3         // 保留最近 3 轮（6 条消息）
const MAX_SUMMARY_LENGTH = 300    // 摘要上限 300 字

/**
 * 应用滑动窗口策略
 * - 保留最近 MAX_KEEP_ROUNDS 轮完整消息
 * - 将更旧的消息压缩为摘要
 *
 * @param conversationHistory 当前完整对话历史
 * @param existingSummary 现有摘要
 * @returns 处理后的对话历史和更新后的摘要
 */
export function applySlidingWindow(
  conversationHistory: ConversationMessage[],
  existingSummary: string,
): {
  trimmedHistory: ConversationMessage[]
  updatedSummary: string
} {
  const maxMessages = MAX_KEEP_ROUNDS * 2  // 每轮 user + assistant = 2 条

  if (conversationHistory.length <= maxMessages) {
    return {
      trimmedHistory: conversationHistory,
      updatedSummary: existingSummary,
    }
  }

  // 分离需要压缩的消息和保留的消息
  const toCompress = conversationHistory.slice(0, conversationHistory.length - maxMessages)
  const toKeep = conversationHistory.slice(-maxMessages)

  // 将旧消息压缩为一行摘要
  const newSummaryLine = compressMessages(toCompress)

  // 合并到现有摘要
  let updatedSummary = existingSummary
    ? `${existingSummary}\n${newSummaryLine}`
    : newSummaryLine

  // 截断到上限
  if (updatedSummary.length > MAX_SUMMARY_LENGTH) {
    updatedSummary = updatedSummary.slice(-MAX_SUMMARY_LENGTH)
    // 截断可能在句子中间，找到最近的换行符重新开始
    const newlineIdx = updatedSummary.indexOf('\n')
    if (newlineIdx > 0 && newlineIdx < 50) {
      updatedSummary = updatedSummary.slice(newlineIdx + 1)
    }
  }

  return {
    trimmedHistory: toKeep,
    updatedSummary,
  }
}

/**
 * 将一组消息压缩为一行摘要
 *
 * 策略：提取每轮的关键信息（用户问题简述 + AI 回复核心）
 */
function compressMessages(messages: ConversationMessage[]): string {
  const rounds: string[] = []

  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i]
    const assistantMsg = messages[i + 1]

    if (!userMsg) continue

    const userBrief = userMsg.content.length > 30
      ? `${userMsg.content.slice(0, 30)}…`
      : userMsg.content

    if (assistantMsg) {
      const aiBrief = assistantMsg.content.length > 50
        ? `${assistantMsg.content.slice(0, 50)}…`
        : assistantMsg.content
      rounds.push(`用户问「${userBrief}」→ 回答：${aiBrief}`)
    } else {
      rounds.push(`用户问「${userBrief}」`)
    }
  }

  return rounds.join('；')
}

/**
 * 为 LLM 上下文构建消息列表
 * 包含：摘要（如有）+ 最近几轮原文
 *
 * @param conversationHistory 当前对话历史（应已 trim）
 * @param conversationSummary 对话摘要
 * @param maxMessages 最多保留几条消息（默认 6）
 * @returns 用于注入 LLM 的消息列表
 */
export function buildContextMessages(
  conversationHistory: ConversationMessage[],
  conversationSummary: string,
  maxMessages: number = 6,
): ConversationMessage[] {
  const result: ConversationMessage[] = []

  // 摘要作为 system message
  if (conversationSummary) {
    result.push({
      role: 'assistant',
      content: `【对话摘要】${conversationSummary}`,
    })
  }

  // 最近几轮原文
  const recent = conversationHistory.slice(-maxMessages)
  result.push(...recent)

  return result
}
