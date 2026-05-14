/**
 * M5: 事项路由 — 决策树
 *
 * 职责：根据用户回答序列，确定事项类型、主看宫位、兼看宫位
 *       6分支决策树：求学/求爱/求财/求职/求健康/求名
 *
 * 来源：SKILL_求测事项路由 V1.0
 */

import type { MatterType, MatterRouteResult, PalaceName } from '../types'

// ═══════════════════════════════════════════════════════════════════
// 问诊问题定义
// ═══════════════════════════════════════════════════════════════════

export interface RouteQuestion {
  /** 问题编号 */
  id: string
  /** 问题文本 */
  question: string
  /** 选项 */
  options: RouteOption[]
}

export interface RouteOption {
  /** 选项文本 */
  label: string
  /** 选项值 */
  value: string
  /** 下一步（问题ID 或 'result'） */
  next: string | 'result'
}

export interface RouteResult {
  /** 主看宫位 */
  primaryPalace: PalaceName
  /** 兼看宫位 */
  secondaryPalaces: PalaceName[]
  /** 特殊条件 */
  specialConditions: string[]
  /** 是否需要互动关系分析 */
  needInteraction: boolean
}

// ═══════════════════════════════════════════════════════════════════
// 求学路由
// ═══════════════════════════════════════════════════════════════════

const studyQuestions: Record<string, RouteQuestion> = {
  'study_1': {
    id: 'study_1',
    question: '是否涉及异地或留学？',
    options: [
      { label: '否，本地', value: 'local', next: 'study_2' },
      { label: '是，异地或留学', value: 'remote', next: 'study_2' },
    ],
  },
  'study_2': {
    id: 'study_2',
    question: '是否以大量记诵/考试为主？',
    options: [
      { label: '否，常规学习', value: 'normal', next: 'result' },
      { label: '是，备考冲刺', value: 'exam', next: 'result' },
    ],
  },
}

function resolveStudy(answers: Record<string, string>): RouteResult {
  const isRemote = answers['study_1'] === 'remote'
  const isExam = answers['study_2'] === 'exam'
  const secondary: PalaceName[] = []
  if (isRemote) secondary.push('迁移')
  if (isExam) secondary.push('田宅')
  return { primaryPalace: '官禄', secondaryPalaces: secondary, specialConditions: [], needInteraction: false }
}

// ═══════════════════════════════════════════════════════════════════
// 求爱路由
// ═══════════════════════════════════════════════════════════════════

const loveQuestions: Record<string, RouteQuestion> = {
  'love_1': {
    id: 'love_1',
    question: '恋爱类型是什么？',
    options: [
      { label: '自由恋爱', value: 'free', next: 'love_2' },
      { label: '相亲型', value: 'match', next: 'love_2' },
      { label: '条件交换型', value: 'exchange', next: 'love_2' },
    ],
  },
  'love_2': {
    id: 'love_2',
    question: '目前处于什么阶段？',
    options: [
      { label: '寻找对象', value: 'seeking', next: 'result' },
      { label: '已有对象，讨论走向', value: 'existing', next: 'result' },
    ],
  },
}

function resolveLove(answers: Record<string, string>): RouteResult {
  const isExchange = answers['love_1'] === 'exchange'
  const isExisting = answers['love_2'] === 'existing'
  const secondary: PalaceName[] = []
  if (isExisting) secondary.push('福德')
  if (isExchange) secondary.push('财帛')
  return { primaryPalace: '夫妻', secondaryPalaces: secondary, specialConditions: [], needInteraction: false }
}

// ═══════════════════════════════════════════════════════════════════
// 求财路由（最复杂，3层嵌套）
// ═══════════════════════════════════════════════════════════════════

const wealthQuestions: Record<string, RouteQuestion> = {
  'wealth_1': {
    id: 'wealth_1',
    question: '是否有劳力付出？',
    options: [
      { label: '否，纯投资', value: 'invest', next: 'wealth_6' },
      { label: '是，有劳力', value: 'labor', next: 'wealth_2a' },
    ],
  },
  'wealth_2a': {
    id: 'wealth_2a',
    question: '是否有实体门店/营业场地？',
    options: [
      { label: '否', value: 'no_site', next: 'wealth_3' },
      { label: '是', value: 'has_site', next: 'wealth_2b' },
    ],
  },
  'wealth_2b': {
    id: 'wealth_2b',
    question: '资本规模大吗？',
    options: [
      { label: '小，摆摊/兼职', value: 'small', next: 'wealth_3' },
      { label: '大，门店/公司', value: 'large', next: 'wealth_3' },
    ],
  },
  'wealth_3': {
    id: 'wealth_3',
    question: '是否涉及合伙？',
    options: [
      { label: '否，独立经营', value: 'solo', next: 'wealth_4' },
      { label: '是，涉及合伙', value: 'partner', next: 'wealth_3a' },
    ],
  },
  'wealth_3a': {
    id: 'wealth_3a',
    question: '合伙模式是什么？',
    options: [
      { label: '自己当头主导', value: 'lead', next: 'wealth_3b' },
      { label: '出资不参与经营', value: 'investor', next: 'result' },
    ],
  },
  'wealth_3b': {
    id: 'wealth_3b',
    question: '合伙人出生年份？',
    options: [
      { label: '没有', value: 'none', next: 'wealth_4' },
      { label: '有（请提供年份）', value: 'has', next: 'wealth_4' },
    ],
  },
  'wealth_4': {
    id: 'wealth_4',
    question: '业务涉及范围？',
    options: [
      { label: '本地', value: 'local', next: 'wealth_5' },
      { label: '异地/跨境/外贸', value: 'remote', next: 'wealth_5' },
    ],
  },
  'wealth_5': {
    id: 'wealth_5',
    question: '业务特点是什么？',
    options: [
      { label: '劳力/生产', value: 'labor', next: 'result' },
      { label: '口才/业务/中介', value: 'sales', next: 'result' },
    ],
  },
  'wealth_6': {
    id: 'wealth_6',
    question: '纯投资形式是什么？',
    options: [
      { label: '理财/基金', value: 'fund', next: 'result' },
      { label: '股票/期货', value: 'stock', next: 'result' },
      { label: '博弈/彩票', value: 'lottery', next: 'result' },
    ],
  },
  'wealth_7': {
    id: 'wealth_7',
    question: '是否涉及置产/收租？',
    options: [
      { label: '否', value: 'no', next: 'wealth_8' },
      { label: '是', value: 'yes', next: 'result' },
    ],
  },
  'wealth_8': {
    id: 'wealth_8',
    question: '是否涉及服务业（需重视空间）？',
    options: [
      { label: '否', value: 'no', next: 'result' },
      { label: '是，空间大的服务业', value: 'yes', next: 'result' },
    ],
  },
}

function resolveWealth(answers: Record<string, string>): RouteResult {
  const hasLabor = answers['wealth_1'] === 'labor'
  const hasSite = answers['wealth_2a'] === 'has_site'
  const isLarge = answers['wealth_2b'] === 'large'
  const hasPartner = answers['wealth_3'] === 'partner'
  const isLead = answers['wealth_3a'] === 'lead'
  const hasPartnerYear = answers['wealth_3b'] === 'has'
  const isRemote = answers['wealth_4'] === 'remote'
  const isSales = answers['wealth_5'] === 'sales'
  const isProperty = answers['wealth_7'] === 'yes'
  const isService = answers['wealth_8'] === 'yes'

  // 置产/收租 → 主看田宅宫
  if (isProperty) {
    return {
      primaryPalace: '田宅',
      secondaryPalaces: [],
      specialConditions: [],
      needInteraction: false,
    }
  }

  // 服务业（空间大）→ 主看田宅宫，兼看迁移
  if (isService) {
    return {
      primaryPalace: '田宅',
      secondaryPalaces: ['迁移'],
      specialConditions: [],
      needInteraction: false,
    }
  }

  // 纯投资
  if (!hasLabor) {
    return {
      primaryPalace: '福德',
      secondaryPalaces: ['迁移'],
      specialConditions: [],
      needInteraction: false,
    }
  }

  // 合伙当头
  if (hasPartner && isLead) {
    return {
      primaryPalace: '迁移',
      secondaryPalaces: ['官禄', '财帛', '田宅', '仆役'],
      specialConditions: hasPartnerYear ? ['需合伙人生年→互动关系分析'] : [],
      needInteraction: !!hasPartnerYear,
    }
  }

  // 合伙出资不参与
  if (hasPartner && !isLead) {
    return {
      primaryPalace: '福德',
      secondaryPalaces: ['迁移'],
      specialConditions: hasPartnerYear ? ['需合伙人生年→互动关系分析'] : [],
      needInteraction: !!hasPartnerYear,
    }
  }

  // 大规模门店
  if (hasSite && isLarge) {
    return {
      primaryPalace: '迁移',
      secondaryPalaces: isRemote ? ['官禄', '财帛', '田宅'] : ['官禄', '财帛'],
      specialConditions: [],
      needInteraction: false,
    }
  }

  // 口才/业务/中介
  if (isSales) {
    return {
      primaryPalace: '迁移',
      secondaryPalaces: ['财帛', '官禄'],
      specialConditions: [],
      needInteraction: false,
    }
  }

  // 异地/外贸
  if (isRemote) {
    return {
      primaryPalace: '迁移',
      secondaryPalaces: ['财帛', '官禄', '田宅'],
      specialConditions: [],
      needInteraction: false,
    }
  }

  // 默认：打工/小规模自营
  return {
    primaryPalace: '财帛',
    secondaryPalaces: [],
    specialConditions: [],
    needInteraction: false,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 求职路由
// ═══════════════════════════════════════════════════════════════════

const careerQuestions: Record<string, RouteQuestion> = {
  'career_1': {
    id: 'career_1',
    question: '是初次求职还是跳槽？',
    options: [
      { label: '初次求职', value: 'first', next: 'career_2' },
      { label: '跳槽换工作', value: 'switch', next: 'career_2' },
    ],
  },
  'career_2': {
    id: 'career_2',
    question: '目标职位有学历/证书门槛吗？',
    options: [
      { label: '无门槛', value: 'no_barrier', next: 'career_3' },
      { label: '有门槛', value: 'has_barrier', next: 'career_3' },
    ],
  },
  'career_3': {
    id: 'career_3',
    question: '职位需要管理下属吗？',
    options: [
      { label: '不需要', value: 'no_manage', next: 'career_4' },
      { label: '需要', value: 'manage', next: 'career_4' },
    ],
  },
  'career_4': {
    id: 'career_4',
    question: '是否涉及异地就职？',
    options: [
      { label: '否', value: 'local', next: 'result' },
      { label: '是', value: 'remote', next: 'result' },
    ],
  },
}

function resolveCareer(answers: Record<string, string>): RouteResult {
  const isSwitch = answers['career_1'] === 'switch'
  const hasBarrier = answers['career_2'] === 'has_barrier'
  const needManage = answers['career_3'] === 'manage'
  const isRemote = answers['career_4'] === 'remote'

  const secondary: PalaceName[] = []
  if (isSwitch || hasBarrier) secondary.push('官禄')
  if (needManage) secondary.push('仆役')

  return {
    primaryPalace: '迁移',
    secondaryPalaces: secondary,
    specialConditions: [],
    needInteraction: false,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 求健康路由
// ═══════════════════════════════════════════════════════════════════

const healthQuestions: Record<string, RouteQuestion> = {
  'health_1': {
    id: 'health_1',
    question: '是整体体质评估，还是针对具体症状？',
    options: [
      { label: '整体体质评估', value: 'general', next: 'health_2' },
      { label: '具体症状/疾病', value: 'specific', next: 'health_2' },
    ],
  },
  'health_2': {
    id: 'health_2',
    question: '是否已有父母生年信息？',
    options: [
      { label: '没有', value: 'no', next: 'health_3' },
      { label: '有', value: 'yes', next: 'health_3' },
    ],
  },
  'health_3': {
    id: 'health_3',
    question: '是否有已知遗传病史？',
    options: [
      { label: '没有', value: 'no', next: 'result' },
      { label: '有（请说明方向）', value: 'yes', next: 'result' },
    ],
  },
}

function resolveHealth(answers: Record<string, string>): RouteResult {
  const isSpecific = answers['health_1'] === 'specific'
  const hasParentInfo = answers['health_2'] === 'yes'
  const hasGeneticHistory = answers['health_3'] === 'yes'

  const secondary: PalaceName[] = ['命宫'] // 命身宫（生命力基础）
  if (isSpecific) secondary.push('父母')
  const specialConditions: string[] = []
  if (hasParentInfo) specialConditions.push('可做太岁入卦遗传分析')
  if (hasGeneticHistory) specialConditions.push('重点关注对应五行星曜')

  return {
    primaryPalace: '疾厄',
    secondaryPalaces: secondary,
    specialConditions,
    needInteraction: false,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 求名路由
// ═══════════════════════════════════════════════════════════════════

const fameQuestions: Record<string, RouteQuestion> = {
  'fame_1': {
    id: 'fame_1',
    question: '成名方式是什么？',
    options: [
      { label: '因技艺/专业能力成名', value: 'skill', next: 'fame_2' },
      { label: '因人缘/流量成名', value: 'social', next: 'fame_2' },
    ],
  },
  'fame_2': {
    id: 'fame_2',
    question: '是否涉及网络传播/直播/演艺？',
    options: [
      { label: '否，传统方式', value: 'traditional', next: 'result' },
      { label: '是，网络/直播/演艺', value: 'online', next: 'result' },
    ],
  },
}

function resolveFame(answers: Record<string, string>): RouteResult {
  const isSkill = answers['fame_1'] === 'skill'
  const isOnline = answers['fame_2'] === 'online'

  const secondary: PalaceName[] = []
  if (isOnline) secondary.push('迁移')

  return {
    primaryPalace: isSkill ? '官禄' : '迁移',
    secondaryPalaces: secondary,
    specialConditions: ['须看科星落位宫', ...(isOnline ? ['须看太阳落位'] : [])],
    needInteraction: false,
  }
}

// ═══════════════════════════════════════════════════════════════════
// 统一路由接口
// ═══════════════════════════════════════════════════════════════════

/** 各事项的问题集合 */
export const MATTER_QUESTIONS: Record<MatterType, Record<string, RouteQuestion>> = {
  '求学': studyQuestions,
  '求爱': loveQuestions,
  '求财': wealthQuestions,
  '求职': careerQuestions,
  '求健康': healthQuestions,
  '求名': fameQuestions,
}

/** 各事项的首问题ID */
export const MATTER_FIRST_QUESTION: Record<MatterType, string> = {
  '求学': 'study_1',
  '求爱': 'love_1',
  '求财': 'wealth_1',
  '求职': 'career_1',
  '求健康': 'health_1',
  '求名': 'fame_1',
}

/** 各事项的路由解析函数 */
export const MATTER_RESOLVERS: Record<MatterType, (answers: Record<string, string>) => RouteResult> = {
  '求学': resolveStudy,
  '求爱': resolveLove,
  '求财': resolveWealth,
  '求职': resolveCareer,
  '求健康': resolveHealth,
  '求名': resolveFame,
}

/**
 * 完整事项路由
 *
 * @param matterType 事项类型
 * @param answers 用户回答（questionId → answer）
 * @returns 路由结果
 */
export function routeMatter(matterType: MatterType, answers: Record<string, string>): MatterRouteResult {
  const resolver = MATTER_RESOLVERS[matterType]
  const result = resolver(answers)

  return {
    matterType,
    primaryPalace: result.primaryPalace,
    secondaryPalaces: result.secondaryPalaces,
    specialConditions: result.specialConditions,
    needInteraction: result.needInteraction,
  }
}

/**
 * 意图识别 — 从用户文本识别事项类型
 *
 * 简单关键词匹配，后续可升级为 LLM 辅助
 */
export function detectMatterIntent(text: string): MatterType | '互动关系' | '综合' | null {
  const rules: Array<{ keywords: string[]; type: MatterType | '互动关系' | '综合' }> = [
    { keywords: ['读书', '考试', '留学', '升学', '学业', '学习', '备考'], type: '求学' },
    { keywords: ['相处', '合作', '互动', '我和'], type: '互动关系' },
    { keywords: ['感情', '恋爱', '婚姻', '找对象', '另一半', '对象', '男朋友', '女朋友', '老公', '老婆', '关系'], type: '求爱' },
    { keywords: ['财运', '赚钱', '投资', '生意', '合伙', '财', '钱', '收入'], type: '求财' },
    { keywords: ['工作', '求职', '跳槽', '升职', '事业', '面试', '就业'], type: '求职' },
    { keywords: ['身体', '健康', '疾病', '体质', '病'], type: '求健康' },
    { keywords: ['名气', '成名', '传播', '影响力', '粉丝', '流量'], type: '求名' },
    { keywords: ['整体运势', '未来趋势', '现阶段', '综合'], type: '综合' },
  ]

  for (const rule of rules) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return rule.type
    }
  }

  return null
}
