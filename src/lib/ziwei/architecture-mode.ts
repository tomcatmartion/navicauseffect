/**
 * 架构模式配置
 * 控制使用 RAG 向量检索还是 Skill Function Calling 架构
 */

/**
 * 架构模式枚举
 */
export const ARCHITECTURE_MODE = {
  /** Skill Function Calling 架构（新版，推荐） */
  SKILL: 'skill',
  /** RAG 向量检索架构（旧版，保留对照） */
  RAG: 'rag',
  /** 程序模型混合架构（确定性计算代码化 + LLM 只做表达） */
  HYBRID: 'hybrid',
} as const

export type ArchitectureMode = typeof ARCHITECTURE_MODE[keyof typeof ARCHITECTURE_MODE]

/**
 * 获取当前架构模式
 * 从环境变量 ARCHITECTURE_MODE 读取，默认使用 Skill 架构
 */
export function getArchitectureMode(): ArchitectureMode {
  const mode = process.env.ARCHITECTURE_MODE?.toLowerCase()

  if (mode === ARCHITECTURE_MODE.RAG) {
    return ARCHITECTURE_MODE.RAG
  }

  if (mode === ARCHITECTURE_MODE.HYBRID) {
    return ARCHITECTURE_MODE.HYBRID
  }

  // 默认使用 Skill 架构
  return ARCHITECTURE_MODE.SKILL
}

/**
 * 检查是否使用 Skill 架构
 */
export function isSkillArchitecture(): boolean {
  return getArchitectureMode() === ARCHITECTURE_MODE.SKILL
}

/**
 * 检查是否使用 RAG 架构
 */
export function isRagArchitecture(): boolean {
  return getArchitectureMode() === ARCHITECTURE_MODE.RAG
}

/**
 * 检查是否使用混合架构
 */
export function isHybridArchitecture(): boolean {
  return getArchitectureMode() === ARCHITECTURE_MODE.HYBRID
}

/**
 * 获取架构模式描述
 */
export function getArchitectureDescription(): string {
  const mode = getArchitectureMode()

  if (mode === ARCHITECTURE_MODE.SKILL) {
    return 'Skill Function Calling 架构（确定性查询 + JSON 精准召回）'
  }

  if (mode === ARCHITECTURE_MODE.HYBRID) {
    return '程序模型混合架构（确定性计算代码化 + LLM 只做表达）'
  }

  return 'RAG 向量检索架构（MySQL 精确匹配 + Zvec 向量降级）'
}
