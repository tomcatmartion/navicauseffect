/**
 * 意图分类器单元测试
 */

import { describe, it, expect } from 'vitest'
import { classify, getActionLabel } from '../classifier'
import type { IntentContext } from '../types'

/** 创建默认上下文 */
function makeContext(overrides?: Partial<IntentContext>): IntentContext {
  return {
    currentMatterKey: null,
    currentQueryYear: null,
    knownMatterKeys: [],
    recentMessages: [],
    initialized: true,
    ...overrides,
  }
}

/** 模拟有活跃事项的上下文 */
function makeContextWithMatter(matterKey: string, year = 2026): IntentContext {
  return makeContext({
    currentMatterKey: matterKey,
    currentQueryYear: year,
    knownMatterKeys: [matterKey],
    recentMessages: [
      { role: 'user', content: `我想看看${matterKey}` },
      { role: 'assistant', content: `好的，让我分析一下你的${matterKey}...` },
    ],
  })
}

describe('IntentClassifier', () => {
  // ── REPORT ──
  describe('REPORT', () => {
    it('匹配「生成报告」', () => {
      const result = classify('帮我生成报告', makeContextWithMatter('求财'))
      expect(result.action).toBe('REPORT')
    })

    it('匹配「总结报告」', () => {
      const result = classify('总结报告', makeContextWithMatter('求职'))
      expect(result.action).toBe('REPORT')
    })

    it('匹配「整理一下」', () => {
      const result = classify('帮我整理一下', makeContextWithMatter('求财'))
      expect(result.action).toBe('REPORT')
    })
  })

  // ── INTERACTION ──
  describe('INTERACTION', () => {
    it('匹配「对方」关键词', () => {
      const result = classify('我想看看和对方的关系', makeContext())
      expect(result.action).toBe('INTERACTION')
    })

    it('匹配带年份的「对方」', () => {
      const result = classify('对方1990年的', makeContext())
      expect(result.action).toBe('INTERACTION')
      expect(result.partnerBirthYear).toBe(1990)
    })

    it('匹配「合盘」', () => {
      const result = classify('帮我合盘看看', makeContext())
      expect(result.action).toBe('INTERACTION')
    })

    it('不把「我们的财运」误判为互动', () => {
      // 包含「我」+ 财运关键词，应该是 NEW_MATTER 而非 INTERACTION
      const result = classify('看看我们的财运怎么样', makeContext())
      expect(result.action).not.toBe('INTERACTION')
    })
  })

  // ── RE_CALC ──
  describe('RE_CALC', () => {
    it('年份变更触发重算', () => {
      const ctx = makeContextWithMatter('求财', 2026)
      const result = classify('2027年的财运怎么样', ctx)
      expect(result.action).toBe('RE_CALC')
      expect(result.targetYear).toBe(2027)
    })

    it('同一年份不触发重算', () => {
      const ctx = makeContextWithMatter('求财', 2026)
      const result = classify('2026年的财运呢', ctx)
      // 同一年份 → 应该是 FOLLOW_UP 或 NEW_MATTER（因为同一事项+同一年）
      expect(result.action).not.toBe('RE_CALC')
    })

    it('无活跃事项不触发重算', () => {
      const result = classify('2027年怎么样', makeContext())
      // 没有活跃事项，年份信息保留但不是 RE_CALC
      expect(result.action).not.toBe('RE_CALC')
    })
  })

  // ── NEW_MATTER ──
  describe('NEW_MATTER', () => {
    it('检测到新事项类型', () => {
      const ctx = makeContextWithMatter('求财')
      const result = classify('我想看看事业', ctx)
      expect(result.action).toBe('NEW_MATTER')
      expect(result.matterType).toBe('求职')
    })

    it('无活跃事项时检测到事项', () => {
      const result = classify('今年的财运怎么样', makeContext())
      expect(result.action).toBe('NEW_MATTER')
      expect(result.matterType).toBe('求财')
    })

    it('同一事项不触发 NEW_MATTER', () => {
      const ctx = makeContextWithMatter('求财')
      const result = classify('财运呢', ctx)
      expect(result.action).not.toBe('NEW_MATTER')
    })
  })

  // ── FOLLOW_UP ──
  describe('FOLLOW_UP', () => {
    it('追问词触发 FOLLOW_UP', () => {
      const ctx = makeContextWithMatter('求财')
      const result = classify('为什么这么说', ctx)
      expect(result.action).toBe('FOLLOW_UP')
    })

    it('「具体说说」触发 FOLLOW_UP', () => {
      const ctx = makeContextWithMatter('求职')
      const result = classify('能具体说说吗', ctx)
      expect(result.action).toBe('FOLLOW_UP')
    })

    it('无活跃事项不触发 FOLLOW_UP', () => {
      const result = classify('为什么', makeContext())
      expect(result.action).toBe('CHITCHAT')
    })
  })

  // ── CHITCHAT ──
  describe('CHITCHAT', () => {
    it('通用问题 → CHITCHAT', () => {
      const result = classify('你好', makeContext())
      expect(result.action).toBe('CHITCHAT')
    })

    it('空消息 → CHITCHAT', () => {
      const result = classify('', makeContext())
      expect(result.action).toBe('CHITCHAT')
    })

    it('无关话题 → CHITCHAT', () => {
      const result = classify('今天天气怎么样', makeContext())
      expect(result.action).toBe('CHITCHAT')
    })
  })

  // ── 边界情况 ──
  describe('边界情况', () => {
    it('短年份格式「26年」正确解析', () => {
      const ctx = makeContextWithMatter('求财', 2026)
      const result = classify('27年呢', ctx)
      expect(result.targetYear).toBe(2027)
    })

    it('getActionLabel 返回中文标签', () => {
      expect(getActionLabel('NEW_MATTER')).toBe('新事项')
      expect(getActionLabel('CHITCHAT')).toBe('闲聊')
    })
  })
})
