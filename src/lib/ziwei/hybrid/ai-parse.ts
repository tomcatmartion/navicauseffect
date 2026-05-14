/**
 * 流式结束后解析尾部 JSON（memory_update / intent）与 narrative 分离
 */

const MEMORY_KEYS = ['memory_update', 'memoryUpdate'] as const

/**
 * 从助手全文回复中剥离可能的 JSON 块，返回叙事正文与 memory patch
 */
export function parseHybridAssistantPayload(fullReply: string): {
  narrative: string
  memoryUpdate?: Record<string, unknown>
  intent?: string
} {
  let narrative = fullReply.trim()
  let memoryUpdate: Record<string, unknown> | undefined
  let intent: string | undefined

  const fence = narrative.match(/\{[\s\S]*\}\s*$/)
  if (fence) {
    const jsonStr = fence[0].trim()
    try {
      const obj = JSON.parse(jsonStr) as Record<string, unknown>
      for (const k of MEMORY_KEYS) {
        if (obj[k] && typeof obj[k] === 'object' && obj[k] !== null) {
          memoryUpdate = obj[k] as Record<string, unknown>
          break
        }
      }
      if (typeof obj.intent === 'string') intent = obj.intent
      narrative = narrative.slice(0, -jsonStr.length).trim()
    } catch {
      // 非合法 JSON，保留全文
    }
  }

  return { narrative, memoryUpdate, intent }
}

export function mergeCollected(
  base: Record<string, unknown>,
  patch?: Record<string, unknown>,
): Record<string, unknown> {
  if (!patch) return { ...base }
  return { ...base, ...patch }
}
