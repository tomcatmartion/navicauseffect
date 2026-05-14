/**
 * Step 4: 上下文组装 + 大模型生成
 *
 * 组装完整的解盘上下文：
 * 命盘摘要 + 解盘规则 + 实战技法 + 精准知识 + 历史3轮摘要 + 问题
 *
 * 然后调用强推理模型生成解盘结果。
 * 支持 SSE 流式输出（仅 Step 4 做流式，Step 1-3 都是同步完成）。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { createProvider } from '@/lib/ai'
import type { AIModelConfig, ChatMessage } from '@/lib/ai/types'
import type { ReadingElements, KnowledgeChunk } from './types'

// ── 上下文组装 ──────────────────────────────────────────

export interface AssembleContextParams {
  chartSummary: string
  rules: string
  techs: string
  knowledge: KnowledgeChunk[]
  elements: ReadingElements
  sessionHistory: string
  question: string
  /** 运限摘要（大限/流年/小限），当问题涉及具体年份时生成 */
  horoscopeSummary?: string
}

/**
 * 组装完整的解盘上下文
 */
export function assembleContext(params: AssembleContextParams): string {
  const { chartSummary, rules, techs, knowledge, elements, sessionHistory, question, horoscopeSummary } = params

  const parts: string[] = []

  // 命盘数据（完整 JSON，含天干地支+大限列表）
  if (chartSummary) {
    parts.push('## 用户命盘')
    parts.push(chartSummary)
  }

  // 运限数据（当有目标年份时）
  if (horoscopeSummary) {
    parts.push('\n## 运限分析数据')
    parts.push(horoscopeSummary)
  }

  // 解盘规则与实战技法
  if (rules) {
    parts.push('\n## 解盘规则（请严格遵循）')
    parts.push(rules)
  }

  // 命盘相关知识（已从知识库精准提取）
  if (knowledge.length > 0) {
    parts.push('\n## 相关紫微知识')
    parts.push(knowledge.map(k => k.content).join('\n\n---\n\n'))
  }

  // 对话历史
  if (sessionHistory) {
    parts.push('\n## 历史对话要点')
    parts.push(sessionHistory)
  }

  // 命主问题（最后）
  parts.push('\n## 用户问题')
  parts.push(question)

  return parts.join('\n')
}

// ── 大模型生成 ──────────────────────────────────────────

const SYSTEM_PROMPT = `你是一位精通紫微斗数的专业命理师，思考过程和分析全部用中文输出。

## 输出要求（严格遵守）
1. **只用中文输出**，所有星曜、宫位、术语、四化、分析理由全部用中文，不得出现英文或缩写
2. **结构化输出**，按照命盘→大限→流年的层次，逐层分析，每个层次单独成段
3. **有据可查**，每项判断必须说明依据（星曜名+四化+落宫），不可仅给结论
4. **具体而非笼统**，必须引用命盘中实际存在的星曜和宫位，不虚构
5. **风格亲切自然**，像与朋友深度交流，有温度、有深度，避免干巴巴的列表

## 解盘原则
- 结合命盘实际情况具体分析，避免套话和模板式表达
- 吉凶判断要有理有据，说明是哪颗星、哪个四化、哪个格局导致的结论
- 不做具体金额/时间预测，不做感情/事业最终结果的绝对判决`

/**
 * 获取强推理模型配置（用于最终生成）
 */
async function getGeneratorModelConfig(): Promise<AIModelConfig | null> {
  // 与全站一致：优先后台标记的默认模型
  const defaultModel = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  })
  if (defaultModel) {
    return {
      id: defaultModel.id,
      name: defaultModel.name,
      provider: defaultModel.provider,
      apiKey: defaultModel.apiKeyEncrypted,
      baseUrl: defaultModel.baseUrl,
      modelId: defaultModel.modelId,
    }
  }

  // 其次 Anthropic 系（含 DeepSeek Anthropic 兼容端点）
  const claudeLike = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, provider: { in: ["claude", "deepseek-anthropic"] } },
  })
  if (claudeLike) {
    return {
      id: claudeLike.id,
      name: claudeLike.name,
      provider: claudeLike.provider,
      apiKey: claudeLike.apiKeyEncrypted,
      baseUrl: claudeLike.baseUrl,
      modelId: claudeLike.modelId,
    }
  }

  const fallback = await prisma.aIModelConfig.findFirst({
    where: { isActive: true },
  })

  if (!fallback) return null

  return {
    id: fallback.id,
    name: fallback.name,
    provider: fallback.provider,
    apiKey: fallback.apiKeyEncrypted,
    baseUrl: fallback.baseUrl,
    modelId: fallback.modelId,
  }
}

/**
 * 同步生成解盘结果
 */
export async function generateReading(context: string): Promise<string> {
  const modelConfig = await getGeneratorModelConfig()
  if (!modelConfig) {
    throw new Error('无可用 AI 模型')
  }

  const provider = createProvider(modelConfig)
  return provider.chatSync(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: context },
    ],
    { temperature: 0.7, maxTokens: 3000 }
  )
}

/**
 * 流式生成解盘结果（SSE）
 * 仅 Step 4 做流式，Step 1-3 都是同步完成后才开始流
 */
export async function generateReadingStream(
  context: string,
): Promise<ReadableStream<Uint8Array>> {
  const modelConfig = await getGeneratorModelConfig()
  if (!modelConfig) {
    throw new Error('无可用 AI 模型')
  }

  const provider = createProvider(modelConfig)
  return provider.chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: context },
    ],
    { temperature: 0.7, maxTokens: 3000, stream: true }
  )
}

/**
 * 构建流式生成的 messages（供外部使用）
 */
export function buildStreamMessages(context: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: context },
  ]
}
