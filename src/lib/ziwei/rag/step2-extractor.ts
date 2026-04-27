/**
 * Step 2: 命盘要素提取（单次 LLM 调用）
 *
 * 从「命盘 JSON + 解盘规则 + 用户问题」中提取结构化解盘要素：
 * palaces, stars, sihua, patterns, timeScope, analysisPoints
 *
 * JSON 容错处理（用户强调）：
 * 1. sanitizeLLMJson — 正则清理 markdown 标记（```json ... ```）
 * 2. ReadingElementsSchema.safeParse — Zod 严格校验
 * 3. fallbackExtract — 降级：正则从问题和命盘摘要中提取基础要素
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { createProvider } from '@/lib/ai'
import type { AIModelConfig } from '@/lib/ai/types'
import type { ReadingElements, SihuaEvent } from './types'
import { ReadingElementsSchema } from './types'
import { normalizeElements } from './tag-normalizer'

// ── JSON 容错：清理 LLM 输出中的 Markdown 标记 ─────────────

/**
 * 清理 LLM 输出中可能携带的 Markdown 代码块标记
 * 处理场景：
 * - ```json\n{...}\n```
 * - ```\n{...}\n```
 * - 前后有解释性文字
 */
export function sanitizeLLMJson(raw: string): string {
  // 1. 去除 markdown 代码块标记
  let cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
  // 2. 去除首尾空白
  cleaned = cleaned.trim()
  // 3. 如果还有非 JSON 内容（如前后解释文字），提取第一个 { 到最后一个 }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1)
  }
  return cleaned
}

// ── 降级兜底：正则提取基础要素 ───────────────────────────

const PALACE_NAMES = [
  '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
  '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫',
  '奴仆宫', '事业宫',
]

const STAR_NAMES = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  '文昌', '文曲', '左辅', '右弼', '禄存', '天马',
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫',
]

/**
 * 当 LLM 要素提取失败时，用正则从问题和命盘摘要中提取基础要素
 */
function fallbackExtract(question: string, chartSummary: string): ReadingElements {
  const combined = question + chartSummary

  const foundPalaces = PALACE_NAMES.filter(p => combined.includes(p))
  const foundStars = STAR_NAMES.filter(s => combined.includes(s))

  return {
    palaces: foundPalaces,
    stars: foundStars,
    sihua: [],
    patterns: [],
    timeScope: '本命',
    analysisPoints: [question],
  }
}

// ── 主提取函数 ──────────────────────────────────────────

export interface ExtractElementsParams {
  question: string
  chartSummary: string
  rules: string
  sessionHistory: string
  isFollowUp: boolean
  lastElements?: ReadingElements
}

/**
 * 获取可用的 AI 模型配置（优先使用轻量模型做要素提取）
 */
async function getExtractorModelConfig(): Promise<AIModelConfig | null> {
  // 优先用 DeepSeek（轻量快速、结构化输出好）
  const deepseek = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, provider: 'deepseek' },
  })
  if (deepseek) {
    return {
      id: deepseek.id,
      name: deepseek.name,
      provider: deepseek.provider,
      apiKey: deepseek.apiKeyEncrypted,
      baseUrl: deepseek.baseUrl,
      modelId: deepseek.modelId,
    }
  }

  // 降级到默认模型
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
 * 单次 LLM 调用，强制 JSON 输出解盘要素
 *
 * 容错策略：
 * 1. sanitizeLLMJson 清理 markdown 标记
 * 2. Zod safeParse 严格校验
 * 3. 失败 → fallbackExtract 正则兜底
 */
export async function extractElements(params: ExtractElementsParams): Promise<ReadingElements> {
  const { question, chartSummary, rules, sessionHistory, isFollowUp, lastElements } = params

  // 获取模型配置
  const modelConfig = await getExtractorModelConfig()
  if (!modelConfig) {
    console.warn('[Step2] 无可用 AI 模型，降级到正则提取')
    return fallbackExtract(question, chartSummary)
  }

  const systemPrompt = `你是紫微斗数专家。你的任务是从用户命盘和解盘规则中，精确提取回答问题所需的解盘要素。

重要规则：
1. 只提取命盘中实际存在的星曜和宫位信息，绝不虚构
2. analysisPoints 要具体，结合命盘实际情况描述，而非泛泛而谈
3. 输出必须是合法 JSON，不包含任何其他文字或 markdown 标记`

  const userPrompt = isFollowUp && lastElements
    ? `
【上轮已确认的解盘要素】
${JSON.stringify(lastElements, null, 2)}

【用户追问】${question}

请在上轮基础上，补充或修正解盘要素。
必须严格按以下 JSON 格式输出：
{
  "palaces": ["宫位名"],
  "stars": ["星曜名"],
  "sihua": [{"star":"星曜","type":"化禄|化权|化科|化忌","palace":"落入宫位","source":"本命|大限|流年"}],
  "patterns": ["格局名"],
  "timeScope": "本命|大限|流年|流月",
  "analysisPoints": ["具体解盘要点，结合命盘实际情况"]
}`
    : `
【解盘规则】
${rules}

【用户命盘摘要】
${chartSummary}

【历史对话要点】
${sessionHistory || '（无）'}

【用户问题】${question}

请提取解盘所需要素。只提取命盘中实际存在的内容。
必须严格按以下 JSON 格式输出，不要输出其他任何文字：
{
  "palaces": ["宫位名"],
  "stars": ["星曜名"],
  "sihua": [{"star":"星曜","type":"化禄|化权|化科|化忌","palace":"落入宫位","source":"本命|大限|流年"}],
  "patterns": ["格局名"],
  "timeScope": "本命|大限|流年|流月",
  "analysisPoints": ["具体解盘要点，结合命盘实际情况"]
}`

  try {
    const provider = createProvider(modelConfig)
    const raw = await provider.chatSync(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1 }
    )

    // Step 1: 清理 markdown 标记
    const cleaned = sanitizeLLMJson(raw)

    // Step 2: 解析 JSON
    const parsed = JSON.parse(cleaned)

    // Step 3: Zod 严格校验
    const result = ReadingElementsSchema.safeParse(parsed)
    if (result.success) {
      // 标签归一化
      const normalized = normalizeElements(result.data)
      const final: ReadingElements = {
        ...result.data,
        palaces: normalized.palaces,
        stars: normalized.stars,
      }

      // 追问时与上轮要素合并（继承已确认的要素）
      if (isFollowUp && lastElements) {
        const lastNorm = normalizeElements(lastElements)
        final.palaces = [...new Set([...lastNorm.palaces, ...final.palaces])]
        final.stars = [...new Set([...lastNorm.stars, ...final.stars])]
        final.sihua = mergeSihua(lastElements.sihua, final.sihua)
        final.patterns = [...new Set([...lastElements.patterns, ...final.patterns])]
        // timeScope 和 analysisPoints 以本轮为准
      }

      return final
    }

    // Zod 校验失败 → 尝试宽松使用（如果基本结构完整）
    console.warn('[Step2] Zod 校验失败:', result.error.message)
    if (parsed.palaces && parsed.stars) {
      console.warn('[Step2] 使用宽松解析结果')
      const normalized = normalizeElements(parsed)
      return {
        palaces: normalized.palaces,
        stars: normalized.stars,
        sihua: parsed.sihua ?? [],
        patterns: parsed.patterns ?? [],
        timeScope: parsed.timeScope ?? '本命',
        analysisPoints: parsed.analysisPoints ?? [question],
      }
    }

    // 完全不可用 → 降级
    console.warn('[Step2] 解析结果结构不完整，降级到正则提取')
    return fallbackExtract(question, chartSummary)

  } catch (err) {
    console.error('[Step2] 要素提取异常，降级到正则提取:', err instanceof Error ? err.message : err)
    return fallbackExtract(question, chartSummary)
  }
}

// ── 四化合并工具 ────────────────────────────────────────

/** 按 star+type+palace+source 四元组去重合并四化事件 */
function mergeSihua(base: SihuaEvent[], extra: SihuaEvent[]): SihuaEvent[] {
  const key = (s: SihuaEvent) => `${s.star}|${s.type}|${s.palace}|${s.source}`
  const seen = new Set(base.map(key))
  return [...base, ...extra.filter(s => !seen.has(key(s)))]
}
