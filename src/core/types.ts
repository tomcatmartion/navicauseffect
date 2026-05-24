/**
 * 程序模型混合架构 — 全局类型定义
 *
 * 所有确定性计算模块共享的基础类型。
 * 命名遵循紫微斗数领域术语。
 */

// ═══════════════════════════════════════════════════════════════════
// 天干地支
// ═══════════════════════════════════════════════════════════════════

/** 十天干 */
export type TianGan = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'

/** 十二地支 */
export type DiZhi = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'

// ═══════════════════════════════════════════════════════════════════
// 星曜
// ═══════════════════════════════════════════════════════════════════

/** 十四主星 */
export type MajorStar =
  | '紫微' | '天机' | '太阳' | '武曲' | '天同' | '廉贞' | '天府'
  | '太阴' | '贪狼' | '巨门' | '天相' | '天梁' | '七杀' | '破军'

/** 六吉星 */
export type AuspiciousStar = '左辅' | '右弼' | '文昌' | '文曲' | '天魁' | '天钺'

/** 六煞星 */
export type InauspiciousStar = '擎羊' | '陀罗' | '火星' | '铃星' | '地空' | '地劫'

/** 禄存（单独处理，不归入吉煞） */
export type LuCunStar = '禄存'

/** 辅助星曜（丙丁级等） */
export type MinorStar =
  | '红鸾' | '天喜' | '天刑' | '天姚' | '天哭' | '天虚'
  | '华盖' | '天马' | '咸池' | '破碎'
  | '力士' | '青龙' | '将军' | '伏兵' | '官府'

/** 所有星曜联合类型 */
export type StarName = MajorStar | AuspiciousStar | InauspiciousStar | LuCunStar | MinorStar

// ═══════════════════════════════════════════════════════════════════
// 四化
// ═══════════════════════════════════════════════════════════════════

/** 四化类型 */
export type SihuaType = '化禄' | '化权' | '化科' | '化忌'

/** 单条四化记录 */
export interface SihuaEntry {
  /** 四化类型 */
  type: SihuaType
  /** 被化的星曜 */
  star: MajorStar | AuspiciousStar
  /** 来源：原局侧为「生年」「太岁宫宫干四化」；大限/流年见运限模块 */
  source: SihuaSource
}

/**
 * 四化来源字面量。
 * - **太岁宫宫干四化**：本命盘太岁宫（生年地支宫）之宫干所带四化（五虎遁定该宫之干）。
 * - **遁干四化**：五虎遁所得天干再论四化之法（见 SKILL_宫位原生能级评估等）；**非**本枚举字面量。太岁入卦虚拟盘入卦星 `type` 为 `太岁宫宫干四化`。
 */
export type SihuaSource = '生年' | '太岁宫宫干四化' | '大限' | '流年'

/** 四化映射：天干 → 四颗星 */
export type SihuaMap = {
  禄: MajorStar | AuspiciousStar
  权: MajorStar | AuspiciousStar
  科: MajorStar | AuspiciousStar
  忌: MajorStar | AuspiciousStar
}

/** 四化落宫标注（SKILL_原局四化读取规则 第四步） */
export interface PalaceSihuaAnnotation {
  /** 宫位名称 */
  palaceName: PalaceName
  /** 宫位地支 */
  diZhi: DiZhi
  /** 该宫收到的四化标注 */
  annotations: Array<{
    /** 星曜名 */
    star: string
    /** 四化类型 */
    type: SihuaType
    /** 来源 */
    source: SihuaSource
  }>
}

/** 合并后的原局四化（含特殊叠加检测 + 四化落宫标注） */
export interface MergedSihua {
  /** 生年四化 */
  shengNian: SihuaMap
  /** 太岁宫宫干四化（本命；字段 `dunGan`：五虎遁求太岁宫宫干 → 天干四化表） */
  dunGan: SihuaMap
  /** 所有四化条目（展开） */
  entries: SihuaEntry[]
  /** 特殊叠加情况 */
  specialOverlaps: SihuaOverlap[]
  /** 四化落宫标注（SKILL第四步） */
  palaceAnnotations: PalaceSihuaAnnotation[]
}

/** 特殊叠加类型 */
export type SihuaOverlap =
  | { type: '双忌叠压'; star: MajorStar | AuspiciousStar }
  | { type: '权忌交冲'; star: MajorStar | AuspiciousStar }
  | { type: '禄忌同星'; star: MajorStar | AuspiciousStar }
  | { type: '双禄叠加'; star: MajorStar | AuspiciousStar }

// ═══════════════════════════════════════════════════════════════════
// 宫位
// ═══════════════════════════════════════════════════════════════════

/** 十二宫名称（固定顺序） */
export const PALACE_NAMES = [
  '命宫', '父母', '福德', '田宅', '官禄', '仆役',
  '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
] as const

/** 宫位名称 */
export type PalaceName = typeof PALACE_NAMES[number]

/** 宫位名称 → 索引映射（统一入口，避免多处重复定义） */
export const PALACE_NAME_TO_INDEX: Record<PalaceName, number> = {
  '命宫': 0, '父母': 1, '福德': 2, '田宅': 3, '官禄': 4, '仆役': 5,
  '迁移': 6, '疾厄': 7, '财帛': 8, '子女': 9, '夫妻': 10, '兄弟': 11,
}

/** 宫位旺弱等级 */
export type PalaceBrightness = '极旺' | '旺' | '平' | '陷' | '极弱' | '空'

/** 加分阶段子步骤详情（基于 scoring_formula.json v1.3） */
export interface BonusDetails {
  /** 2.1 三方四正吉星加分（含空间衰减） */
  '2.1_三方四正吉星': number
  /** 2.2 命主生年化禄加分 */
  '2.2_命主生年化禄': number
  /** 2.3 命主遁干化禄加分 */
  '2.3_命主遁干化禄': number
  /** 2.4 父亲生年化禄加分 */
  '2.4_父亲生年化禄': number
  /** 2.5 父亲遁干化禄加分 */
  '2.5_父亲遁干化禄': number
  /** 2.6 母亲生年化禄加分 */
  '2.6_母亲生年化禄': number
  /** 2.7 母亲遁干化禄加分 */
  '2.7_母亲遁干化禄': number
  /** 2.8 吉格倍率 */
  '2.8_吉格倍率': number
}

/** 减分阶段子步骤详情（基于 scoring_formula.json v2.3） */
export interface PenaltyDetails {
  /** 4.1 三方四正煞星减分（含空间衰减 + intensity_factor） */
  '4.1_三方四正煞星': number
  /** 4.2 命主生年化忌减分 */
  '4.2_命主生年化忌': number
  /** 4.3 命主遁干化忌减分 */
  '4.3_命主遁干化忌': number
  /** 4.4 父亲生年化忌减分（×0.9） */
  '4.4_父亲生年化忌': number
  /** 4.5 父亲遁干化忌减分（×0.9） */
  '4.5_父亲遁干化忌': number
  /** 4.6 母亲生年化忌减分（×0.9） */
  '4.6_母亲生年化忌': number
  /** 4.7 母亲遁干化忌减分（×0.9） */
  '4.7_母亲遁干化忌': number
  /** 4.8 凶格倍率 */
  '4.8_凶格倍率': number
}

/** 宫位评分结果 */
export interface PalaceScore {
  /** 宫位名称 */
  palace: PalaceName
  /** 宫位地支 */
  diZhi: DiZhi
  /** 主星列表 */
  majorStars: Array<{ star: MajorStar; brightness: PalaceBrightness }>
  /** 骨架基础分（步骤1） */
  skeletonScore: number
  /** 天花板分 */
  ceiling: number
  /** 加分阶段总分 */
  bonusTotal: number
  /** 减分阶段总分 */
  penaltyTotal: number
  /** 禄存加减分（步骤5） */
  luCunDelta: number
  /** 最终得分（步骤6） */
  finalScore: number
  /** 原生基调 */
  tone: PalaceTone
  /** 制煞能力等级 */
  subdueLevel: SubdueLevel
  /** 匹配到的格局 */
  patterns: PatternMatch[]
  /** 格局倍率 */
  patternMultiplier: number
  /** 临界状态标注 */
  criticalStatus: CriticalStatus
  /** 是否绝败 */
  isAbsoluteFail: boolean
  /** 特殊结构标注 */
  specialFlags: string[]
  /** 加分后得分（步骤2结束） */
  scoreAfterBonus: number
  /** 减分后得分（步骤4结束） */
  scoreAfterPenalty: number
  /** 禄存处理后得分（步骤5结束） */
  scoreAfterLuCun: number
  /** 加分后旺弱定性（步骤3） */
  warmCoolLabel: '旺' | '旺偏磨炼' | '平' | '虚浮' | '凶危'
  /** 加分阶段子步骤详情 */
  bonusDetails: BonusDetails
  /** 减分阶段子步骤详情 */
  penaltyDetails: PenaltyDetails
}

/** 基调 */
export type PalaceTone = '实旺' | '实旺偏磨炼' | '磨炼' | '虚浮' | '凶危' | '绝败'

/** 制煞能力 */
export type SubdueLevel = '强制煞' | '中制煞' | '弱制煞' | '无'

/** 格局匹配结果 */
export interface PatternMatch {
  /** 格局名称 */
  name: string
  /** 级别 */
  level: PatternLevel
  /** 倍率 */
  multiplier: number
  /** 来源模块（如紫微、日月等） */
  category: string
}

/** 格局级别 */
export type PatternLevel = '大吉' | '中吉' | '小吉' | '小凶' | '中凶' | '大凶'

/** 临界状态 */
export type CriticalStatus = '无临界' | '旺宫临界' | '平宫临界' | '陷地临界'

// ═══════════════════════════════════════════════════════════════════
// 命盘数据结构（从 iztro 转换而来）
// ═══════════════════════════════════════════════════════════════════

/** 单个宫位数据 */
export interface PalaceData {
  /** 宫位名称 */
  name: PalaceName
  /** 宫位地支 */
  diZhi: DiZhi
  /** 宫位天干 */
  tianGan: TianGan
  /** 主星（含旺弱） */
  majorStars: Array<{ star: MajorStar; brightness: PalaceBrightness }>
  /** 六吉星 */
  auspiciousStars: AuspiciousStar[]
  /** 六煞星 */
  inauspiciousStars: InauspiciousStar[]
  /** 禄存 */
  hasLuCun: boolean
  /** 丙丁级星曜 */
  minorStars: MinorStar[]
  /** 四化标注（落入本宫的四化） */
  sihua: SihuaEntry[]
  /** 是否空宫（无主星） */
  isEmpty: boolean
}

/** 完整命盘数据 */
export interface ChartData {
  /** 命主生年天干 */
  birthGan: TianGan
  /** 命主生年地支 */
  birthZhi: DiZhi
  /** 太岁宫地支 */
  taiSuiZhi: DiZhi
  /** 命宫地支（起盘位置） */
  mingGongZhi: DiZhi
  /** 身宫地支 */
  shenGongZhi: DiZhi
  /** 十二宫数据 */
  palaces: PalaceData[]
  /** 骨架序号（P01-P12） */
  skeletonId: string
}

// ═══════════════════════════════════════════════════════════════════
// 事项路由
// ═══════════════════════════════════════════════════════════════════

/** 事项类型 */
export type MatterType = '求学' | '求爱' | '求财' | '求职' | '求健康' | '求名'

/** 事项路由结果 */
export interface MatterRouteResult {
  /** 事项类型 */
  matterType: MatterType
  /** 主看宫位 */
  primaryPalace: PalaceName
  /** 兼看宫位 */
  secondaryPalaces: PalaceName[]
  /** 特殊条件 */
  specialConditions: string[]
  /** 是否需要互动关系分析 */
  needInteraction: boolean
  /** 互动关系所需的对方生年（如有） */
  partnerBirthYear?: number
}

// ═══════════════════════════════════════════════════════════════════
// IR 中间表示（计算层 → LLM 层）
// ═══════════════════════════════════════════════════════════════════

/** 命盘快照（用于注入 Prompt 的完整命盘信息） */
export interface ChartSnapshot {
  /** 生年干支 */
  birthGanZhi: string
  /** 生肖 */
  zodiac: string
  /** 五行局 */
  fiveElementsClass: string
  /** 命主 */
  soul: string
  /** 身主 */
  body: string
  /** 阳历 */
  solarDate: string
  /** 农历 */
  lunarDate: string
  /** 命宫 */
  mingGong: { name: string; diZhi: string; majorStars: string[]; minorStars: string[]; adjectiveStars: string[] }
  /** 身宫 */
  shenGong: { name: string; diZhi: string; majorStars: string[]; minorStars: string[]; adjectiveStars: string[] }
  /** 太岁宫 */
  taiSuiGong: { name: string; diZhi: string; majorStars: string[]; minorStars: string[]; adjectiveStars: string[] }
  /** 全部十二宫 */
  allPalaces: Array<{
    name: string
    diZhi: string
    heavenlyStem: string
    majorStars: string[]
    minorStars: string[]
    adjectiveStars: string[]
    isBodyPalace: boolean
    decadal?: { gan: string; range: string }
  }>
  /** 原局四化文本 */
  sihuaText: string
  /** 大限信息文本 */
  decadalText: string
}

/** IR：阶段一宫位评分结果 */
export interface IRStage1 {
  stage: 1
  /** 十二宫评分 */
  palaceScores: PalaceScore[]
  /** 匹配到的格局 */
  allPatterns: PatternMatch[]
  /** 原局四化 */
  mergedSihua: MergedSihua
  /** 是否有父母生年 */
  hasParentInfo: boolean
  /** 父母出生年份（用于 IR 文本展示） */
  parentBirthYears?: { father?: number; mother?: number }
  /** 命盘快照（完整命盘信息，供 AI 参考） */
  chartSnapshot: ChartSnapshot
}

/** IR：阶段二性格定性结果 */
export interface IRStage2 {
  stage: 2
  /** 命宫标签 */
  mingGongTags: FourDimensionTags
  /** 身宫标签 */
  shenGongTags: FourDimensionTags
  /** 太岁宫标签 */
  taiSuiTags: FourDimensionTags
  /** 整体性格基调 */
  overallTone: string
  /** 命宫全息底色 */
  mingGongHolographic: HolographicBase
  /** 身宫索引（用于定位身宫） */
  shenGongIndex?: number
  /** 太岁宫索引 */
  taiSuiIndex?: number
  /** 十二宫评分（从 Stage1 复制，供 AI 参考） */
  palaceScores: PalaceScore[]
  /** 匹配到的格局（从 Stage1 复制） */
  allPatterns: PatternMatch[]
  /** 原局四化（从 Stage1 复制） */
  mergedSihua: MergedSihua
  /** 命盘快照（完整命盘信息，供 AI 参考） */
  chartSnapshot: ChartSnapshot
}

/** 四维合参标签 */
export interface FourDimensionTags {
  palace: PalaceName
  diZhi: DiZhi
  /** 本宫标签 */
  selfTags: string[]
  /** 对宫投射标签 */
  oppositeTags: string[]
  /** 三合支撑标签 */
  trineTags: string[]
  /** 夹宫状态标签 */
  flankingTags: string[]
  /** 综合定性 */
  summary: string
}

/** 命宫全息底色 */
export interface HolographicBase {
  /** 四化方向 */
  sihuaDirection: string
  /** 六吉星影响 */
  auspiciousEffect: string
  /** 六煞星影响 */
  inauspiciousEffect: string
  /** 丙丁级影响 */
  minorEffect: string
  /** 综合底色定性 */
  summary: string
}

/** IR：阶段三/四分析结果 */
export interface IRStage3or4 {
  stage: 3 | 4
  /** 事项类型 */
  matterType: MatterType | '互动关系'
  /** 主看宫位分析 */
  primaryAnalysis: MatterAnalysis
  /** 大限分析 */
  daXianAnalysis: DaXianAnalysis[]
  /** 流年分析 */
  liuNianAnalysis: LiuNianAnalysis
  /** 十二宫评分（从 Stage1 复制，供 AI 参考） */
  palaceScores: PalaceScore[]
  /** 匹配到的格局（从 Stage1 复制） */
  allPatterns: PatternMatch[]
  /** 原局四化（从 Stage1 复制） */
  mergedSihua: MergedSihua
  /** 命盘快照（完整命盘信息，供 AI 参考） */
  chartSnapshot: ChartSnapshot
}

/** 事项宫位分析 */
export interface MatterAnalysis {
  palace: PalaceName
  /** 四维合参定性 */
  fourDimensionResult: string
  /** 命宫调节结论 */
  mingGongRegulation: string
  /** 格局保护机制 */
  protectionStatus: string
  /** 先天格局定性 */
  innateLevel: string
}

/** 大限分析 */
export interface DaXianAnalysis {
  /** 第几大限 */
  index: number
  /** 年龄范围 */
  ageRange: string
  /** 大限宫干 */
  daXianGan: TianGan
  /** 大限四化落位 */
  sihuaPositions: string[]
  /** 这十年定性 */
  tone: '顺畅期' | '艰辛期' | '危机期' | '转机期'
  /** 是否当前大限 */
  isCurrent: boolean
}

/** 流年分析 */
export interface LiuNianAnalysis {
  /** 流年干 */
  liuNianGan: TianGan
  /** 流年四化落位 */
  sihuaPositions: string[]
  /** 流年方向 */
  direction: '吉' | '凶'
  /** 与大限方向关系 */
  daXianRelation: '吉吉' | '吉凶' | '凶吉' | '凶凶'
  /** 时间窗口 */
  window: DirectionWindow
}

/** IR 联合类型 */
export type IR = IRStage1 | IRStage2 | IRStage3or4

// ═══════════════════════════════════════════════════════════════════
// 三层宫位对照表（原局 / 大限 / 流年）
// ═══════════════════════════════════════════════════════════════════

/** 单层宫位映射 */
export interface PalaceLayer {
  /** 层级标识 */
  layer: '原局' | '大限' | '流年'
  /** 十二宫数据（按 PALACE_NAMES 顺序） */
  palaces: PalaceLayerEntry[]
}

/** 单个宫位在一层中的映射数据 */
export interface PalaceLayerEntry {
  /** 宫名 */
  name: PalaceName
  /** 地支 */
  diZhi: DiZhi
  /** 天干（大限/流年才有） */
  tianGan?: TianGan
  /** 主星（含亮度） */
  majorStars: Array<{ star: MajorStar; brightness: PalaceBrightness }>
  /** 落入的四化 */
  sihua: SihuaEntry[]
  /** 该层评分（如有） */
  score?: number
  /** 基调 */
  tone?: string
}

/** 三层宫位对照表 */
export interface ThreeLayerPalaceTable {
  /** 原局层 */
  natal: PalaceLayer
  /** 大限层（当前大限） */
  decadal: PalaceLayer
  /** 流年层 */
  yearly: PalaceLayer
}

/** 大限宫位映射（全量大限数据） */
export interface DaXianPalaceMapping {
  /** 第几大限（1-based） */
  index: number
  /** 年龄范围 */
  ageRange: [number, number]
  /** 大限宫干 */
  daXianGan: TianGan
  /** 大限命宫名 */
  mingPalaceName: PalaceName
  /** 大限命宫在原局中的索引 */
  palaceIndex: number
  /** 大限四化 [化禄星, 化权星, 化科星, 化忌星] */
  mutagen: string[]
  /** 大限下的十二宫评分（可选，调用 M2 后填入） */
  scores?: PalaceScore[]
  /** 十二锚定宫格局矩阵（可选） */
  palacePatterns?: PatternMatch[][]
  /** 大限命宫作锚定时的格局（兼容旧字段） */
  patterns?: PatternMatch[]
}

// ═══════════════════════════════════════════════════════════════════
// 运限格局识别
// ═══════════════════════════════════════════════════════════════════

/** 运限类型 */
export type LimitType = '大限' | '流年' | '小限'

/** 运限格局识别结果 */
export interface LimitPatternResult {
  /** 运限类型 */
  limitType: LimitType
  /** 运限标识（如：大限第3限 20-29岁 / 流年2025 / 小限32岁） */
  limitLabel: string
  /** 运限命宫在原局中的索引 */
  mingPalaceIndex: number
  /** 运限命宫地支 */
  mingPalaceZhi: DiZhi
  /** 运限天干 */
  limitGan: TianGan
  /** 匹配到的格局（运限命宫作锚定，兼容） */
  patterns: PatternMatch[]
  /** 十二锚定宫格局矩阵 */
  palacePatterns?: PatternMatch[][]
  /** 格局与原局格局的对比分析 */
  comparisonWithNatal?: {
    /** 原局格局数量 */
    natalPatternCount: number
    /** 运限新增格局数量 */
    newPatternCount: number
    /** 运限消失的原局格局数量 */
    lostPatternCount: number
    /** 持续存在的格局数量 */
    sustainedPatternCount: number
    /** 对比结论 */
    conclusion: string
  }
}

/** 全量运限格局识别输出 */
export interface LimitPatternsOutput {
  /** 原局格局（命宫锚定，参考基准） */
  natalPatterns: PatternMatch[]
  /** 原局十二锚定宫格局矩阵 */
  natalPalacePatterns?: PatternMatch[][]
  /** 十大限格局识别结果 */
  decadalPatterns: LimitPatternResult[]
  /** 指定流年格局识别结果 */
  yearlyPatterns: LimitPatternResult[]
  /** 小限格局识别结果（可选） */
  minorPatterns?: LimitPatternResult[]
  /** 运限格局综合分析 */
  synthesis: {
    /** 格局运势趋势 */
    trend: string
    /** 关键转折大限 */
    keyDecennials: string[]
    /** 格局能量峰值年份 */
    peakYears: number[]
  }
}

// ═══════════════════════════════════════════════════════════════════
// 流年方向矩阵
// ═══════════════════════════════════════════════════════════════════

/** 方向矩阵：流年吉/凶 × 大限吉/凶 */
export type DirectionMatrix = '吉吉' | '吉凶' | '凶吉' | '凶凶'

/** 方向矩阵对应的窗口类型 */
export type DirectionWindow = '推进窗口' | '蛰伏期' | '风险期' | '转机期'

/** 根据方向矩阵获取窗口 */
export function getDirectionWindow(matrix: DirectionMatrix): DirectionWindow {
  switch (matrix) {
    case '吉吉': return '推进窗口'
    case '吉凶': return '转机期'
    case '凶吉': return '蛰伏期'
    case '凶凶': return '风险期'
  }
}

// ═══════════════════════════════════════════════════════════════════
// 知识片段
// ═══════════════════════════════════════════════════════════════════

/** 知识片段（从 M6 查询后注入 IR） */
export interface KnowledgeSnippet {
  /** 查询来源 */
  source: '星曜赋性' | '宫位含义' | '格局定义' | '互动取象' | '四化能量'
  /** 查询键值 */
  key: string
  /** 知识内容 */
  content: string
}

// ═══════════════════════════════════════════════════════════════════
// 互动关系分析
// ═══════════════════════════════════════════════════════════════════

/** 三维合参维度 */
export interface ThreeDimensionAnalysis {
  /** 维度 A：入卦者心态（生年主早 / 太岁宫宫干四化主晚；太岁入卦层） */
  dimensionA: {
    /** 早期心态（生年四化驱动） */
    earlyTendency: string
    /** 晚期心态（太岁宫宫干四化驱动，太岁入卦层） */
    lateTendency: string
  }
  /** 维度 B：命主底色（从 Session 取命宫全息底色） */
  dimensionB: {
    tone: string
    summary: string
  }
  /** 维度 C：大限/流年引动 */
  dimensionC: {
    currentDecadalEffect: string
    yearlyTrigger: string
  }
}

/** 互动关系分析结果 */
export interface InteractionAnalysis {
  /** 对方生年天干 */
  partnerGan: TianGan
  /** 对方生年地支 */
  partnerZhi: DiZhi
  /** 虚拟命盘（单方分析时为 null） */
  virtualChart: import('./tai-sui-rua-gua/virtual-chart').VirtualChart | null
  /** 三维合参 */
  threeDimension: ThreeDimensionAnalysis
  /** 核心张力点（1-3个） */
  tensionPoints: string[]
  /** 可调整建议 */
  adjustableAdvice: string[]
  /** 不可调整风险 */
  fixedRisks: string[]
}

// ═══════════════════════════════════════════════════════════════════
// 阶段输入/输出
// ═══════════════════════════════════════════════════════════════════

/** 阶段一输入 */
export interface Stage1Input {
  /** iztro 命盘 JSON */
  chartData: Record<string, unknown>
  /** 父母生年（可选） */
  parentBirthYears?: { father?: number; mother?: number }
}

/** 阶段一输出 */
export interface Stage1Output {
  /** 评分上下文 */
  scoringCtx: import('./energy-evaluator/scoring-flow').ScoringContext
  /** 十二宫评分 */
  palaceScores: PalaceScore[]
  /** 匹配到的格局 */
  allPatterns: PatternMatch[]
  /** 原局四化 */
  mergedSihua: MergedSihua
  /** 知识片段 */
  knowledgeSnippets: KnowledgeSnippet[]
  /** 是否有父母信息 */
  hasParentInfo: boolean
}

/** 阶段二输入 */
export interface Stage2Input {
  /** 阶段一输出 */
  stage1: Stage1Output
  /** 用户问题 */
  question: string
}

/** 阶段二输出 */
export interface Stage2Output {
  /** 命宫四维标签 */
  mingGongTags: FourDimensionTags
  /** 身宫四维标签 */
  shenGongTags: FourDimensionTags
  /** 太岁宫四维标签 */
  taiSuiTags: FourDimensionTags
  /** 整体性格基调 */
  overallTone: string
  /** 命宫全息底色 */
  mingGongHolographic: HolographicBase
  /** 知识片段 */
  knowledgeSnippets: KnowledgeSnippet[]
  /** 身宫索引 */
  shenGongIndex?: number
  /** 太岁宫索引 */
  taiSuiIndex?: number
  /** P0: 格局人格特质注入结果 */
  patternPersonality?: {
    influences: Array<{
      patternName: string
      level: string
      traits: Array<{ keyword: string; dimension: string; intensity: number }>
      personalityBase: string
      behavioralTendency: string
      interpersonalStyle: string
      stressResponse: string
    }>
    aggregated: {
      surfaceTraits: string[]
      middleTraits: string[]
      coreTraits: string[]
      personalityBase: string
      behavioralTendency: string
      interpersonalStyle: string
      stressResponse: string
    }
  }
  /** P1: 评分原因性格映射结果 */
  scoreReasonPersonality?: {
    mingProfile: {
      palace: string
      finalScore: number
      bonusReasons: Array<{ dimension: string; item: string; personalityInterpretation: string; impactLevel: string }>
      penaltyReasons: Array<{ dimension: string; item: string; personalityInterpretation: string; impactLevel: string }>
      subduePersonality: string
      synthesis: string
    }
    keyDimensions: {
      strengths: string[]
      challenges: string[]
      抗压能力: string
      人际风格: string
    }
  }
  /** P2: 三宫交叉张力分析结果 */
  threePalaceCross?: {
    baseTone: string
    crossTensions: string[]
    synthesis: string
  }
}

/** 阶段三输入 */
export interface Stage3Input {
  /** 阶段一输出 */
  stage1: Stage1Output
  /** 阶段二输出 */
  stage2: Stage2Output
  /** 事项类型 */
  matterType: MatterType
  /** 事项路由结果 */
  routeResult: MatterRouteResult
  /** 命盘原始数据（用于行运计算） */
  chartData: Record<string, unknown>
  /** 目标流年 */
  targetYear: number
}

/** 阶段三输出 */
export interface Stage3Output {
  /** 事项类型 */
  matterType: MatterType
  /** 主看宫位分析 */
  primaryAnalysis: MatterAnalysis
  /** 全量大限映射 */
  allDaXianMappings: DaXianPalaceMapping[]
  /** 三层宫位对照表 */
  threeLayerTable: ThreeLayerPalaceTable
  /** 方向矩阵 */
  directionMatrix: DirectionMatrix
  /** 方向窗口 */
  directionWindow: DirectionWindow
  /** 知识片段 */
  knowledgeSnippets: KnowledgeSnippet[]
}

/** 阶段四输入 */
export interface Stage4Input {
  /** 阶段一输出 */
  stage1: Stage1Output
  /** 阶段二输出 */
  stage2: Stage2Output
  /** 对方生年（null 时降级为单方关系宫分析） */
  partnerBirthYear: number | null
  /** 命盘原始数据 */
  chartData: Record<string, unknown>
  /** 目标流年 */
  targetYear: number
  /** 事项上下文（C2→E4 时有值，E2→E4 时为空） */
  focusContext?: {
    matterType: MatterType
    primaryPalace: PalaceName
  }
}

/** 阶段四输出 */
export interface Stage4Output {
  /** 互动分析 */
  interaction: InteractionAnalysis
  /** 知识片段 */
  knowledgeSnippets: KnowledgeSnippet[]
}

// ═══════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════

/** 获取对宫地支（六合） */
export function getOppositeGong(zhi: DiZhi): DiZhi {
  const map: Record<DiZhi, DiZhi> = {
    '子': '午', '丑': '未', '寅': '申', '卯': '酉',
    '辰': '戌', '巳': '亥', '午': '子', '未': '丑',
    '申': '寅', '酉': '卯', '戌': '辰', '亥': '巳',
  }
  return map[zhi]
}

/** 获取三合宫地支（返回两个） */
export function getTrineGong(zhi: DiZhi): [DiZhi, DiZhi] {
  const map: Record<DiZhi, [DiZhi, DiZhi]> = {
    '子': ['辰', '申'], '丑': ['巳', '酉'], '寅': ['午', '戌'], '卯': ['未', '亥'],
    '辰': ['子', '申'], '巳': ['丑', '酉'], '午': ['寅', '戌'], '未': ['卯', '亥'],
    '申': ['子', '辰'], '酉': ['丑', '巳'], '戌': ['寅', '午'], '亥': ['卯', '未'],
  }
  return map[zhi]
}

/** 获取夹宫地支（左右邻宫）
 *
 * 方向约定（scoring_params.json directionConvention）：
 * - 左 = counterClockwise = 索引 +1
 * - 右 = clockwise = 索引 -1
 *
 * 例如：本宫为丑(1)，则 left = 寅(2)，right = 子(0)
 */
export function getFlankingGong(zhi: DiZhi): [DiZhi, DiZhi] {
  const order: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  const idx = order.indexOf(zhi)
  const left = order[(idx + 1) % 12]
  const right = order[(idx - 1 + 12) % 12]
  return [left, right]
}

/** DiZhi 索引（0-11） */
export function diZhiIndex(zhi: DiZhi): number {
  return ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].indexOf(zhi)
}

/** TianGan 索引（0-9） */
export function tianGanIndex(gan: TianGan): number {
  return ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].indexOf(gan)
}
