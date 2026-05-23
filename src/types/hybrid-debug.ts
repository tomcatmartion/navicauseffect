/**
 * Hybrid 调试信息类型（客户端可安全 import，无 server-only 依赖）
 */
export interface HybridDebugInfo {
  architecture: 'hybrid'
  stage: number
  question: string
  matterType?: string
  palaceCount?: number
  patternCount?: number
  intentDetected?: string
  knowledgeSnippetCount?: number
  fullPromptLength?: number
  timing: Record<string, number>
  baseIRCached?: boolean
  dslPatternHits?: string[]
  /** 组装后的完整 Prompt 消息列表（结构化展示用） */
  promptMessages?: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
    /** 消息标签/分类，用于前端展示 */
    label?: string
  }>
}

export type PipelineDebugInfo = HybridDebugInfo
