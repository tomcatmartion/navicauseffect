/**
 * M5: 问诊信息规则提取器
 *
 * 从 AI 对话中提取结构化宫位决策 JSON。
 * 策略：规则优先（关键词+正则）→ 提取 70% 字段
 * 剩余字段由 M7 在报告生成时隐式补全（合并到一次 LLM 调用中）。
 *
 * 不单独调用 LLM 做 Extractor，减少延迟和出错点。
 */

import type { MatterType } from '@/core/types'

/** 提取的问诊结果 */
export interface ExtractedAnswers {
  /** 已提取的字段 */
  answers: Record<string, string>
  /** 提取置信度（0-1，越高越可靠） */
  confidence: number
  /** 未提取的字段名 */
  missingFields: string[]
}

/**
 * 从对话文本中提取问诊信息
 *
 * @param dialogText 对话文本（用户最近的几条消息）
 * @param matterType 事项类型
 * @returns 提取结果
 */
export function extractAnswersFromDialog(
  dialogText: string,
  matterType: MatterType,
): ExtractedAnswers {
  const answers: Record<string, string> = {}
  let extractedCount = 0
  const totalFields = getFieldCount(matterType)

  // ── 通用字段提取 ──────────────────────────────────────

  // 合伙人生年（4位数字，1950-2020范围）
  const yearMatch = dialogText.match(/(?:19[5-9]\d|20[0-1]\d)/)
  if (yearMatch) {
    const context = getContext(dialogText, yearMatch.index ?? 0, 20)
    if (/合伙|伙伴|伙伴|朋友|一起/.test(context)) {
      answers.partnerBirthYear = yearMatch[0]
      extractedCount++
    }
  }

  // ── 按事项类型提取 ──────────────────────────────────

  switch (matterType) {
    case '求财':
      extractedCount += extractWealthAnswers(dialogText, answers)
      break
    case '求爱':
      extractedCount += extractLoveAnswers(dialogText, answers)
      break
    case '求学':
      extractedCount += extractStudyAnswers(dialogText, answers)
      break
    case '求职':
      extractedCount += extractCareerAnswers(dialogText, answers)
      break
    case '求健康':
      extractedCount += extractHealthAnswers(dialogText, answers)
      break
    case '求名':
      extractedCount += extractFameAnswers(dialogText, answers)
      break
  }

  const confidence = totalFields > 0 ? extractedCount / totalFields : 0
  const knownFields = Object.keys(answers)
  const missingFields = getExpectedFields(matterType).filter(f => !knownFields.includes(f))

  return { answers, confidence, missingFields }
}

// ═══════════════════════════════════════════════════════════════════
// 各事项提取规则
// ═══════════════════════════════════════════════════════════════════

function extractWealthAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  // 有无劳力
  if (/投资|理财|基金|股票|期货|博弈|彩票/.test(text)) {
    answers.wealth_1 = 'invest'
    count++
  } else if (/开店|经营|上班|打工|做(生意|买卖)/.test(text)) {
    answers.wealth_1 = 'labor'
    count++
  }

  // 有无合伙
  if (/合伙|一起|合作|搭档/.test(text)) {
    answers.wealth_3 = 'partner'
    count++
  } else if (/自己|一个人|独立/.test(text)) {
    answers.wealth_3 = 'solo'
    count++
  }

  // 本地/异地
  if (/外贸|跨境|异地|海外|出口/.test(text)) {
    answers.wealth_4 = 'remote'
    count++
  } else if (/本地|本地|附近|同城的?/.test(text)) {
    answers.wealth_4 = 'local'
    count++
  }

  // 业务特点
  if (/中介|业务|销售|口才|介绍|经纪/.test(text)) {
    answers.wealth_5 = 'sales'
    count++
  } else if (/生产|制造|劳力|体力|技术/.test(text)) {
    answers.wealth_5 = 'labor'
    count++
  }

  // 有无场地
  if (/门店|店铺|公司|工厂|场地|实体/.test(text)) {
    answers.wealth_2a = 'has_site'
    count++
  }

  return count
}

function extractLoveAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/自由恋爱|自己认识|自然/.test(text)) {
    answers.love_1 = 'free'
    count++
  } else if (/相亲|介绍|相亲/.test(text)) {
    answers.love_1 = 'match'
    count++
  }

  if (/找对象|还没|单身|没有对象|想找/.test(text)) {
    answers.love_2 = 'seeking'
    count++
  } else if (/已有|在一起|对象|男朋友|女朋友|老公|老婆|伴侣/.test(text)) {
    answers.love_2 = 'existing'
    count++
  }

  return count
}

function extractStudyAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/留学|出国|异地|外地/.test(text)) {
    answers.study_1 = 'remote'
    count++
  } else if (/本地|在家|附近/.test(text)) {
    answers.study_1 = 'local'
    count++
  }

  if (/备考|冲刺|考试|考研|高考|记诵/.test(text)) {
    answers.study_2 = 'exam'
    count++
  }

  return count
}

function extractCareerAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/跳槽|换工作|离职|辞职/.test(text)) {
    answers.career_1 = 'switch'
    count++
  } else if (/第一次|刚毕业|应届|初入/.test(text)) {
    answers.career_1 = 'first'
    count++
  }

  if (/管理|带人|下属|团队|领导/.test(text)) {
    answers.career_3 = 'manage'
    count++
  }

  if (/异地|外地|出差|驻外/.test(text)) {
    answers.career_4 = 'remote'
    count++
  }

  return count
}

function extractHealthAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/具体|症状|病|痛|不舒服/.test(text)) {
    answers.health_1 = 'specific'
    count++
  } else if (/体质|整体|养生|预防/.test(text)) {
    answers.health_1 = 'general'
    count++
  }

  return count
}

function extractFameAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/直播|网络|自媒体|短视频|演艺|网红/.test(text)) {
    answers.fame_2 = 'online'
    count++
  }

  return count
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

/** 获取上下文窗口文本 */
function getContext(text: string, center: number, radius: number): string {
  const start = Math.max(0, center - radius)
  const end = Math.min(text.length, center + radius)
  return text.slice(start, end)
}

/** 获取事项类型的期望字段数 */
function getFieldCount(matterType: MatterType): number {
  const counts: Record<MatterType, number> = {
    '求学': 2,
    '求爱': 2,
    '求财': 6,
    '求职': 4,
    '求健康': 2,
    '求名': 2,
  }
  return counts[matterType] ?? 2
}

/** 获取事项类型的期望字段名 */
function getExpectedFields(matterType: MatterType): string[] {
  const fields: Record<MatterType, string[]> = {
    '求学': ['study_1', 'study_2'],
    '求爱': ['love_1', 'love_2'],
    '求财': ['wealth_1', 'wealth_2a', 'wealth_3', 'wealth_4', 'wealth_5'],
    '求职': ['career_1', 'career_2', 'career_3', 'career_4'],
    '求健康': ['health_1', 'health_2'],
    '求名': ['fame_1', 'fame_2'],
  }
  return fields[matterType] ?? []
}
