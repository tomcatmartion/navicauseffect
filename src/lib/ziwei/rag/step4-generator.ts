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

  const knowledgeText = knowledge.length > 0
    ? knowledge
        .map((k, i) => `### ${i + 1}. ${k.title}\n${k.content}`)
        .join('\n\n')
    : '（无匹配知识）'

  const analysisHints = elements.analysisPoints.length > 0
    ? `\n## 本次解盘要点\n${elements.analysisPoints.map(p => `- ${p}`).join('\n')}`
    : ''

  const techsSection = techs
    ? `\n## 实战技法参考\n${techs}`
    : ''

  const horoscopeSection = horoscopeSummary
    ? `\n## 运限信息\n以下为用户当前大限及目标年份的流年/小限数据，分析时必须参考：\n${horoscopeSummary}`
    : ''

  return `## 用户命盘
${chartSummary}
${analysisHints}
${horoscopeSection}

## 解盘规则（请严格遵循）
${rules}
${techsSection}

## 相关紫微知识
${knowledgeText}

## 历史对话要点
${sessionHistory || '（本轮为首次问询）'}

## 用户问题
${question}`.trim()
}

// ── 大模型生成 ──────────────────────────────────────────

const SYSTEM_PROMPT = `你是一位精通紫微斗数的命理师，风格专业、亲切、有温度。

解盘要求：
1. 严格依照提供的【解盘规则】和【相关紫微知识】进行分析，不得超出范围凭空发挥
2. 结合命盘实际情况具体分析，避免套话和模板式表达
3. 吉凶判断要有理有据，说明是哪颗星、哪个四化、哪个格局导致的结论
4. 语言亲切自然，像与朋友交谈，不要过于生硬学术
5. 回答长度适中，重点突出，不要面面俱到流水账`

/**
 * 获取强推理模型配置（用于最终生成）
 */
async function getGeneratorModelConfig(): Promise<AIModelConfig | null> {
  // 优先用 Claude（最强推理）
  const claude = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, provider: 'claude' },
  })
  if (claude) {
    return {
      id: claude.id,
      name: claude.name,
      provider: claude.provider,
      apiKey: claude.apiKeyEncrypted,
      baseUrl: claude.baseUrl,
      modelId: claude.modelId,
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
