/**
 * Step 0：意图识别 — 在问题进入 RAG 管道之前，先判断是否真的需要 AI 解析命盘
 *
 * 判断逻辑：
 * - Layer 1：规则引擎（毫秒级，零 LLM 调用）
 *   - 高确信闲聊正则 → OFFTOPIC（confidence=1.0）
 *   - 高确信命盘正则 → ZIWEI（confidence=1.0）
 *   - 关键词打分 → OFFTOPIC 或 ZIWEI（confidence=0.85）
 *   - 无法判断 → 进入 Layer 2
 * - Layer 2：轻量 LLM 判断（仅边界情况）
 */

import { prisma } from '@/lib/db'
import { createProvider } from '@/lib/ai'
import type { AIModelConfig } from '@/lib/ai/types'
import { IntentType, type IntentDetectionResult } from './types'

export { IntentType }
export type { IntentDetectionResult }

// ── 闲聊高确信正则模式 ──────────────────────────────────

const GREETING_PATTERNS = [
  /^[你好您嗨heyhi]{1,3}[\s。！!]*$/, // "你好" "您好" "嗨"
  /^[在吗在嘛]\??$/, // "在吗" "在吗？"
  /^再见|拜拜|晚安[～~]*$/, // 结束语
  /^(hi|hello|hey)[!！.。]*$/i, // 英文问候
  /^[谢谢感谢]+[!！.]*$/, // 感谢语
]

// ── 命盘话题高确信正则模式 ──────────────────────────────────

const ZIWEI_PATTERNS = [
  /[紫微天机太阳武曲天同廉贞天府太阴贪狼巨门天相天梁七杀破军]/,
  /[化禄化权化科化忌]/,
  /(命宫|兄弟宫|夫妻宫|子女宫|财帛宫|疾厄宫|迁移宫|交友宫|官禄宫|田宅宫|福德宫|父母宫)/,
  /排盘|命盘|大限|流年|小限/,
]

// ── 命盘话题关键词 ──────────────────────────────────

const ZIWEI_TOPIC_KEYWORDS = [
  // 十四主星
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  // 六煞四化
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫',
  '化禄', '化权', '化科', '化忌',
  // 宫位
  '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
  '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫', '身宫',
  // 领域关键词
  '财运', '财富', '收入', '赚钱', '事业', '工作', '感情', '婚姻',
  '健康', '子女', '学业', '出行', '六亲', '人缘',
  // 命盘相关
  '命盘', '排盘', '紫微斗数', '四柱', '八字', '大限', '流年', '小限',
  '本命', '星曜', '格局', '命理', '运势', '预测',
  // 特例星曜
  '天魁', '天钺', '左辅', '右弼', '文昌', '文曲', '科权禄忌',
]

// ── 闲聊/无关关键词 ──────────────────────────────────

const OFFTOPIC_KEYWORDS = [
  // 问候语
  '你好', '您好', 'hi', 'hello', '嗨', 'hey', '在吗', '在嘛',
  // 天气/时间
  '天气', '温度', '下雨', '晴天', '今天几号', '现在几点', '几点了',
  // 新闻/娱乐
  '新闻', '股票', '比赛', '电影', '音乐', '足球', '篮球',
  // 闲聊
  '你是谁', '你是干嘛的', '你能做什么', '介绍一下', '介绍一下自己',
  '谢谢', '拜拜', '再见', '晚安', '早上好', '中午好', '下午好',
  '肚子疼', '头疼', '中暑', '感冒', '发烧', '咳嗽',
  '吃', '吃饭', '睡觉', '做梦', '洗澡',
  // 常见无关问题
  '你会什么', '有用吗', '是真的吗', '准不准', '多少钱', '收费',
]

// ── 规则引擎 ──────────────────────────────────

interface RuleResult {
  intent: IntentType
  confidence: number
  reason: string
  needsLLM: boolean
}

/**
 * 规则引擎：基于关键词和正则模式快速判断意图
 * - confidence = 1.0: 规则确信判断
 * - needsLLM = true: 规则不确定，需要 LLM 裁决
 */
function detectByRules(question: string): RuleResult {
  const q = question.trim()

  // ── 1. 高确信闲聊正则 ───────────────────────────────
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(q)) {
      return {
        intent: IntentType.OFFTOPIC,
        confidence: 1.0,
        reason: `闲聊正则: ${pattern}`,
        needsLLM: false,
      }
    }
  }

  // ── 2. 高确信命盘正则 ───────────────────────────────
  for (const pattern of ZIWEI_PATTERNS) {
    if (pattern.test(q)) {
      return {
        intent: IntentType.ZIWEI,
        confidence: 1.0,
        reason: `命盘正则: ${pattern}`,
        needsLLM: false,
      }
    }
  }

  // ── 3. 关键词打分 ──────────────────────────────────
  const ziweiScore = ZIWEI_TOPIC_KEYWORDS.filter(kw => q.includes(kw)).length
  const offtopicScore = OFFTOPIC_KEYWORDS.filter(kw => q.includes(kw)).length

  // 闲聊词命中多 → 闲聊
  if (offtopicScore >= 2 && offtopicScore > ziweiScore) {
    return {
      intent: IntentType.OFFTOPIC,
      confidence: 0.85,
      reason: `闲聊关键词命中 ${offtopicScore} 个`,
      needsLLM: false,
    }
  }

  // 命盘词命中多 → 需要解盘
  if (ziweiScore >= 2 && ziweiScore > offtopicScore) {
    return {
      intent: IntentType.ZIWEI,
      confidence: 0.85,
      reason: `命盘话题关键词命中 ${ziweiScore} 个`,
      needsLLM: false,
    }
  }

  // ── 4. 无法确信判断 ──────────────────────────────────
  return {
    intent: IntentType.ZIWEI, // 保守兜底
    confidence: 0.5,
    reason: '规则无法确信判断，进入 LLM 裁决',
    needsLLM: true,
  }
}

// ── 轻量 LLM 判断（仅边界情况）──────────────────────────

const INTENT_LLM_PROMPT = `你是一个意图分类器，只输出 JSON，不输出其他内容。

判断用户输入属于以下哪个类别：
- "ziwei": 用户问题涉及紫微斗数、命盘解析、运势预测、性格分析等命理相关内容
- "offtopic": 用户问题与命理无关，如问候、闲聊、天气、时间等

判断标准：
- ziwei: 包含星曜名称（四化、格局等命理术语）、宫位名称，或询问运势/事业/感情/财运等命理问题
- offtopic: 纯问候、无关话题、日常生活闲聊

仅输出 JSON 格式：{"intent":"ziwei或offtopic","reason":"判断理由（10字以内）"}`

/**
 * 获取可用的 AI 模型配置（用于意图识别的 LLM 裁决）
 * 优先使用项目默认模型
 */
async function getIntentModelConfig(): Promise<AIModelConfig | null> {
  // 优先用默认模型（通过 isDefault 字段查找）
  const defaultModel = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  }) ?? await prisma.aIModelConfig.findFirst({
    where: { isActive: true },
  })

  if (!defaultModel) return null

  return {
    id: defaultModel.id,
    name: defaultModel.name,
    provider: defaultModel.provider,
    apiKey: defaultModel.apiKeyEncrypted,
    baseUrl: defaultModel.baseUrl,
    modelId: defaultModel.modelId,
  }
}

/**
 * 轻量 LLM 判断（仅规则无法确信时调用）
 * 使用 DeepSeek 或默认轻量模型（低延迟低成本）
 */
async function detectByLLM(question: string): Promise<IntentDetectionResult> {
  try {
    const modelConfig = await getIntentModelConfig()
    if (!modelConfig) {
      // 无可用模型，保守兜底为需要解盘
      return {
        intent: IntentType.ZIWEI,
        confidence: 0.6,
        reason: '无 AI 模型，保守兜底为需要解盘',
        needsLLM: false,
      }
    }

    const provider = createProvider(modelConfig)
    const response = await provider.chatSync(
      [
        { role: 'system', content: INTENT_LLM_PROMPT },
        { role: 'user', content: question },
      ],
      { temperature: 0.1, maxTokens: 100 }
    )

    const parsed = JSON.parse(response) as { intent: string; reason: string }
    return {
      intent: parsed.intent === 'ziwei' ? IntentType.ZIWEI : IntentType.OFFTOPIC,
      confidence: 0.9,
      reason: parsed.reason ?? 'LLM 判断',
      needsLLM: false,
    }
  } catch (err) {
    // LLM 输出格式异常或调用失败，保守兜底为需要解盘
    console.error('[IntentDetector] LLM 判断异常:', err)
    return {
      intent: IntentType.ZIWEI,
      confidence: 0.6,
      reason: 'LLM 判断异常，保守兜底为需要解盘',
      needsLLM: false,
    }
  }
}

// ── 闲聊回复模板 ──────────────────────────────────

const OFFTOPIC_REPLIES = [
  '您好！我是紫微心理的命理顾问，专注于紫微斗数命盘解析。请问您想了解哪方面的运势呢？',
  '很高兴为您服务！我是紫微心理的 AI 命理师，您可以直接告诉我您的出生日期和时间，我可以为您排盘分析。',
  '您好！请问有什么命理问题想了解吗？您可以告诉我您的出生信息，我来为您解读。',
  '你好！我是紫微心理的命理顾问，期待为您解盘。您可以发送出生日期和时间开始我们的对话。',
]

function getOfftopicReply(): string {
  return OFFTOPIC_REPLIES[Math.floor(Math.random() * OFFTOPIC_REPLIES.length)]
}

// ── 主函数 ──────────────────────────────────

/**
 * 意图检测主函数
 * 规则优先，边界情况走 LLM
 */
export async function detectIntent(question: string): Promise<IntentDetectionResult> {
  const ruleResult = detectByRules(question)

  if (!ruleResult.needsLLM) {
    return {
      intent: ruleResult.intent,
      confidence: ruleResult.confidence,
      reason: ruleResult.reason,
      needsLLM: false,
      suggestedReply: ruleResult.intent === IntentType.OFFTOPIC
        ? getOfftopicReply()
        : undefined,
    }
  }

  // 规则不确定，LLM 裁决
  return detectByLLM(question)
}
