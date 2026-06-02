/**
 * 滑动窗口单元测试
 */

import { describe, it, expect } from 'vitest'
import { applySlidingWindow, buildContextMessages } from '../sliding-window'

function makeMessages(count: number): Array<{ role: 'user' | 'assistant'; content: string }> {
  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (let i = 0; i < count; i++) {
    msgs.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `消息 ${Math.floor(i / 2) + 1}-${i % 2 === 0 ? '用户' : 'AI'}`,
    })
  }
  return msgs
}

describe('slidingWindow', () => {
  describe('applySlidingWindow', () => {
    it('少于 3 轮时不压缩', () => {
      const msgs = makeMessages(4)  // 2 轮
      const result = applySlidingWindow(msgs, '')
      expect(result.trimmedHistory).toHaveLength(4)
      expect(result.updatedSummary).toBe('')
    })

    it('恰好 3 轮时不压缩', () => {
      const msgs = makeMessages(6)  // 3 轮
      const result = applySlidingWindow(msgs, '')
      expect(result.trimmedHistory).toHaveLength(6)
      expect(result.updatedSummary).toBe('')
    })

    it('第 4 轮触发压缩', () => {
      const msgs = makeMessages(8)  // 4 轮
      const result = applySlidingWindow(msgs, '')
      expect(result.trimmedHistory).toHaveLength(6)
      expect(result.updatedSummary).toBeTruthy()
      expect(result.updatedSummary).toContain('用户问')
    })

    it('摘要累积', () => {
      const msgs = makeMessages(8)
      const result = applySlidingWindow(msgs, '之前的摘要')
      expect(result.updatedSummary).toContain('之前的摘要')
      expect(result.updatedSummary).toContain('用户问')
    })

    it('摘要超过 300 字时截断', () => {
      const longSummary = 'A'.repeat(350)
      const msgs = makeMessages(8)
      const result = applySlidingWindow(msgs, longSummary)
      expect(result.updatedSummary.length).toBeLessThanOrEqual(350)  // 截断后应小于等于
    })
  })

  describe('buildContextMessages', () => {
    it('无摘要时只返回原文', () => {
      const msgs = makeMessages(4)
      const result = buildContextMessages(msgs, '')
      expect(result).toHaveLength(4)
    })

    it('有摘要时在开头注入摘要', () => {
      const msgs = makeMessages(4)
      const result = buildContextMessages(msgs, '之前的对话摘要')
      expect(result).toHaveLength(5)
      expect(result[0].content).toContain('之前的对话摘要')
    })

    it('限制最大消息数', () => {
      const msgs = makeMessages(10)
      const result = buildContextMessages(msgs, '', 4)
      expect(result).toHaveLength(4)
    })
  })
})
