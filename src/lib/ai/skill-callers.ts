/**
 * Skill 架构 AI 调用器
 * 从数据库读取 AI 模型配置，直接使用 fetch 调用 OpenAI 兼容接口
 */
import 'server-only'
import { prisma } from '@/lib/db'
import { createProvider } from '@/lib/ai'
import type { ChatMessage as ProviderChatMessage } from '@/lib/ai/types'
import type { AIModelConfig as PrismaAIModelRow } from '@prisma/client'

// ── 类型定义 ─────────────────────────────────────────────

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface Tool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

export interface CallAIResponse {
  content: string | null
  tool_calls?: ToolCall[]
  finish_reason: string
}

const MAX_RETRY = 3

/** OpenAI Chat Completions 形态（可直接 fetch /chat/completions） */
function isOpenAiChatProvider(p: string): boolean {
  return ['deepseek', 'minimax', 'openai', 'google', 'doubao', 'zhipu', 'qwen'].includes(p)
}

/** 流式解盘：默认一条；无默认则任取一条激活模型（含 deepseek-anthropic / claude） */
async function findActiveModelForStream(): Promise<PrismaAIModelRow | null> {
  const preferred = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  })
  if (preferred) return preferred
  return prisma.aIModelConfig.findFirst({ where: { isActive: true } })
}

function skillMessagesToProvider(messages: ChatMessage[]): ProviderChatMessage[] {
  return messages
    .filter(
      (m): m is ChatMessage & { role: 'system' | 'user' | 'assistant' } =>
        m.role === 'system' || m.role === 'user' || m.role === 'assistant',
    )
    .map(m => ({ role: m.role, content: m.content ?? '' }))
}

// ── 获取 AI 配置 ────────────────────────────────────────

interface AIConfig {
  apiKey: string
  baseUrl: string
  modelId: string
  provider: string
}

async function getAIConfig(): Promise<AIConfig> {
  /** Skill 同步 Tool Calling 仍走 OpenAI `/chat/completions`；仅流式 Hybrid 已支持 Anthropic 协议 */
  const openAiStyle = (p: string) => isOpenAiChatProvider(p)

  let config = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  });

  if (config && !openAiStyle(config.provider)) {
    config = null;
  }

  if (!config) {
    for (const prov of ["minimax", "deepseek", "openai", "google", "doubao", "zhipu", "qwen"] as const) {
      const row = await prisma.aIModelConfig.findFirst({
        where: { isActive: true, provider: prov },
      });
      if (row) {
        config = row;
        break;
      }
    }
  }

  if (!config) {
    config = await prisma.aIModelConfig.findFirst({
      where: { isActive: true },
    });
  }

  if (!config || !openAiStyle(config.provider)) {
    throw new Error(
      "未找到可用于 Skill 的 OpenAI Chat Completions 兼容模型（如 MiniMax / DeepSeek OpenAI 端）。若默认仅为 DeepSeek Anthropic 协议，请在后台再添加一条 OpenAI 兼容模型。",
    );
  }

  return {
    apiKey: config.apiKeyEncrypted,
    baseUrl: config.baseUrl,
    modelId: config.modelId,
    provider: config.provider,
  };
}

// ── 同步调用（含 Tool Calling）───────────────────────────

export async function callAI(params: {
  messages: ChatMessage[]
  tools?: Tool[]
  temperature?: number
  max_tokens?: number
}): Promise<CallAIResponse> {
  const { messages, tools, temperature = 0.3, max_tokens = 3000 } = params

  const config = await getAIConfig()

  let lastErr: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const payload: Record<string, unknown> = {
        model: config.modelId,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }

      // 添加 tools 支持（Tool Calling 核心）
      if (tools && tools.length > 0) {
        payload.tools = tools
        payload.tool_choice = 'auto'
      }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        throw new Error(`AI API error ${response.status}: ${errText.slice(0, 200)}`)
      }

      const data = await response.json()
      const choice = data.choices?.[0]

      return {
        content: choice?.message?.content ?? null,
        tool_calls: choice?.message?.tool_calls,
        finish_reason: choice?.finish_reason ?? 'stop',
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      console.warn(`[callAI] 第${attempt}次失败:`, lastErr.message)
      if (attempt < MAX_RETRY) {
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  throw lastErr
}

// ── 流式调用 ─────────────────────────────────────────────

export async function callAIStream(params: {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}): Promise<ReadableStream> {
  const { messages, temperature = 0.7, max_tokens = 3000 } = params

  const row = await findActiveModelForStream()
  if (!row) {
    throw new Error('未配置任何 AI 模型')
  }

  if (isOpenAiChatProvider(row.provider)) {
    const response = await fetch(`${row.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${row.apiKeyEncrypted}`,
      },
      body: JSON.stringify({
        model: row.modelId,
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Stream 请求失败 ${response.status}: ${errText.slice(0, 200)}`)
    }

    return response.body
  }

  const provider = createProvider({
    id: row.id,
    name: row.name,
    provider: row.provider,
    apiKey: row.apiKeyEncrypted,
    baseUrl: row.baseUrl,
    modelId: row.modelId,
  })
  const provMessages = skillMessagesToProvider(messages)
  return provider.chat(provMessages, {
    temperature,
    maxTokens: max_tokens,
    stream: true,
  })
}
