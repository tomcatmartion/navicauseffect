/**
 * 报告编译器 — 类型定义
 *
 * 结构化命理解读报告，对齐 User Prompt.md 格式
 */

/** 编译后的报告 */
export interface CompiledReport {
  /** 事项类型 */
  matterType: string
  /** 查询年份 */
  queryYear: number
  /** 分析模式 */
  mode: '已发生' | '未发生'
  /** 报告各章节 */
  sections: {
    /** 原局气场 */
    innateAura: string
    /** 大限十年走势 */
    decadalTrend: string
    /** 流年分析 */
    yearlyAnalysis: string
    /** 综合结论与建议 */
    compositeConclusion: string
  }
  /** 元数据 */
  metadata: {
    compositeScore: number
    scoreLabel: string
    directionMatrix: [string, string]
    directionWindow: string
  }
}

/** 报告编译输入 */
export interface ReportCompilerInput {
  /** 事项类型 */
  matterType: string
  /** 查询年份 */
  queryYear: number
  /** 综合评分 */
  compositeScore: number
  /** 评分标签 */
  scoreLabel: string
  /** 方向矩阵 */
  directionMatrix: [string, string]
  /** 方向窗口 */
  directionWindow: string
  /** AI 回复摘要 */
  aiSummary: string
  /** 结构化分析摘要 */
  analysisSummary?: {
    innateBase: string
    fortuneTrend: string
    yearlyTrigger: string
    compositeConclusion: string
    riskAdvice: string
  }
  /** 性格锚点 */
  personalityAnchor?: string
  /** 主看宫位 */
  primaryPalace: string
  /** 主看宫位评分 */
  primaryScore: number
  /** 主看宫位亮度 */
  primaryBrightness: string
  /** 因果链 */
  causalChain?: string
  /** 四化落宫报告文本 */
  sihuaLandingText?: string
}
