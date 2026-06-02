/**
 * M5: 问诊信息规则提取器
 *
 * 从 AI 对话中提取结构化宫位决策 JSON。
 * 策略：规则优先（关键词+正则）→ 提取 70% 字段
 * 剩余字段由 M7 在报告生成时隐式补全（合并到一次 LLM 调用中）。
 *
 * 字段定义与 data/router.json 各分支 questions 对齐。
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
 */
export function extractAnswersFromDialog(
  dialogText: string,
  matterType: MatterType,
): ExtractedAnswers {
  const answers: Record<string, string> = {}
  let extractedCount = 0
  const totalFields = getFieldCount(matterType)

  // 合伙人生年（4位数字，1950-2020范围）
  const yearMatch = dialogText.match(/(?:19[5-9]\d|20[0-1]\d)/)
  if (yearMatch) {
    const context = getContext(dialogText, yearMatch.index ?? 0, 24)
    if (/合伙|伙伴|朋友|一起|搭档/.test(context)) {
      answers.partnerBirthYear = yearMatch[0]
      if (matterType === '求财') {
        answers.wealth_3 = answers.wealth_3 ?? 'partner'
        answers.wealth_3b = 'has'
      }
      extractedCount++
    }
  }

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

  const confidence = totalFields > 0 ? Math.min(1, extractedCount / totalFields) : 0
  const knownFields = Object.keys(answers).filter(k => k !== 'partnerBirthYear')
  const missingFields = getExpectedFields(matterType).filter(f => !knownFields.includes(f))

  return { answers, confidence, missingFields }
}

function extractWealthAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/投资|理财|基金|股票|期货|博弈|彩票|纯投资/.test(text)) {
    answers.wealth_1 = 'invest'
    count++
    if (/基金|理财|定存/.test(text)) {
      answers.wealth_6 = 'fund'
      count++
    } else if (/股票|期货|证券/.test(text)) {
      answers.wealth_6 = 'stock'
      count++
    } else if (/彩票|博弈|赌/.test(text)) {
      answers.wealth_6 = 'lottery'
      count++
    }
  } else if (/开店|经营|上班|打工|做(生意|买卖)|劳力|生产/.test(text)) {
    answers.wealth_1 = 'labor'
    count++
  }

  if (/门店|店铺|公司|工厂|场地|实体|营业/.test(text)) {
    answers.wealth_2a = 'has_site'
    count++
    if (/摆摊|兼职|小本|小生意/.test(text)) {
      answers.wealth_2b = 'small'
      count++
    } else if (/大公司|连锁|规模|门店/.test(text)) {
      answers.wealth_2b = 'large'
      count++
    }
  } else if (/没有店|无店|线上|无场地/.test(text)) {
    answers.wealth_2a = 'no_site'
    count++
  }

  if (/合伙|一起|合作|搭档/.test(text)) {
    answers.wealth_3 = 'partner'
    count++
    if (/当头|主导|负责经营|我来管/.test(text)) {
      answers.wealth_3a = 'lead'
      count++
    } else if (/只出资|不参与|投资人/.test(text)) {
      answers.wealth_3a = 'investor'
      count++
    }
  } else if (/自己|一个人|独立|单干/.test(text)) {
    answers.wealth_3 = 'solo'
    count++
  }

  if (/外贸|跨境|异地|海外|出口/.test(text)) {
    answers.wealth_4 = 'remote'
    count++
  } else if (/本地|同城|附近/.test(text)) {
    answers.wealth_4 = 'local'
    count++
  }

  if (/中介|业务|销售|口才|介绍|经纪/.test(text)) {
    answers.wealth_5 = 'sales'
    count++
  } else if (/生产|制造|劳力|体力|技术/.test(text)) {
    answers.wealth_5 = 'labor'
    count++
  }

  if (/收租|置产|房产|不动产|收房/.test(text)) {
    answers.wealth_7 = 'yes'
    count++
  }

  if (/服务业|空间.*大|餐饮|酒店|会所/.test(text)) {
    answers.wealth_8 = 'yes'
    count++
  }

  return count
}

function extractLoveAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/自由恋爱|自己认识|自然/.test(text)) {
    answers.love_1 = 'free'
    count++
  } else if (/相亲|介绍/.test(text)) {
    answers.love_1 = 'match'
    count++
  } else if (/条件|交换|物质/.test(text)) {
    answers.love_1 = 'exchange'
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
  } else if (/常规|平时|日常学习/.test(text)) {
    answers.study_2 = 'normal'
    count++
  }

  return count
}

function extractCareerAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/跳槽|换工作|离职|辞职/.test(text)) {
    answers.career_1 = 'switch'
    count++
  } else if (/第一次|刚毕业|应届|初入|初次/.test(text)) {
    answers.career_1 = 'first'
    count++
  }

  if (/学历|证书|门槛|资格证|要求/.test(text)) {
    answers.career_2 = 'has_barrier'
    count++
  } else if (/无门槛|不限学历/.test(text)) {
    answers.career_2 = 'no_barrier'
    count++
  }

  if (/管理|带人|下属|团队|领导/.test(text)) {
    answers.career_3 = 'manage'
    count++
  } else if (/不需要管理|不带人/.test(text)) {
    answers.career_3 = 'no_manage'
    count++
  }

  if (/异地|外地|出差|驻外/.test(text)) {
    answers.career_4 = 'remote'
    count++
  } else if (/本地|同城/.test(text)) {
    answers.career_4 = 'local'
    count++
  }

  return count
}

function extractHealthAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/具体|症状|病|痛|不舒服|疾病/.test(text)) {
    answers.health_1 = 'specific'
    count++
  } else if (/体质|整体|养生|预防|评估/.test(text)) {
    answers.health_1 = 'general'
    count++
  }

  if (/父母.*生年|父亲.*年|母亲.*年|爸妈.*年/.test(text)) {
    answers.health_2 = 'yes'
    count++
  } else if (/没有.*父母.*生年|不知.*父母/.test(text)) {
    answers.health_2 = 'no'
    count++
  }

  if (/遗传|家族病史|家族.*病/.test(text)) {
    answers.health_3 = 'yes'
    count++
  } else if (/无遗传|没有遗传/.test(text)) {
    answers.health_3 = 'no'
    count++
  }

  return count
}

function extractFameAnswers(text: string, answers: Record<string, string>): number {
  let count = 0

  if (/技艺|专业|技能|能力|手艺/.test(text)) {
    answers.fame_1 = 'skill'
    count++
  } else if (/流量|粉丝|人脉|社交|人缘|网红/.test(text)) {
    answers.fame_1 = 'social'
    count++
  }

  if (/直播|网络|自媒体|短视频|演艺|网红/.test(text)) {
    answers.fame_2 = 'online'
    count++
  } else if (/传统|线下|口碑/.test(text)) {
    answers.fame_2 = 'traditional'
    count++
  }

  return count
}

function getContext(text: string, center: number, radius: number): string {
  const start = Math.max(0, center - radius)
  const end = Math.min(text.length, center + radius)
  return text.slice(start, end)
}

function getFieldCount(matterType: MatterType): number {
  return getExpectedFields(matterType).length
}

/** 与 router.json 各分支 questions id 对齐（不含 partnerBirthYear 辅助字段） */
function getExpectedFields(matterType: MatterType): string[] {
  const fields: Record<MatterType, string[]> = {
    '求学': ['study_1', 'study_2'],
    '求爱': ['love_1', 'love_2'],
    '求财': [
      'wealth_1',
      'wealth_2a',
      'wealth_2b',
      'wealth_3',
      'wealth_3a',
      'wealth_3b',
      'wealth_4',
      'wealth_5',
      'wealth_6',
      'wealth_7',
      'wealth_8',
    ],
    '求职': ['career_1', 'career_2', 'career_3', 'career_4'],
    '求健康': ['health_1', 'health_2', 'health_3'],
    '求名': ['fame_1', 'fame_2'],
  }
  return fields[matterType] ?? []
}
