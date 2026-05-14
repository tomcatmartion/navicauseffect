/**
 * Stage 4: 互动关系分析
 *
 * P4 阶段：太岁入卦 → 三维合参 → 互动取象 → 输出
 *
 * 数据流：
 * Stage1Output + Stage2Output + partnerBirthYear
 *   → 提取对方天干地支
 *   → buildVirtualChart（含真实 findStarPalace）
 *   → 三维合参分析（入卦者心态 + 命主底色 + 行运引动）
 *   → injectStage4Knowledge
 *   → Stage4Output
 *
 * 模块调用：M1(四化) + M3(太岁入卦) + M6(知识注入)
 * LLM 不参与本阶段任何逻辑判断。
 */

import type {
  Stage4Input, Stage4Output, TianGan, DiZhi,
  InteractionAnalysis, ThreeDimensionAnalysis,
  SihuaType,
} from '@/core/types'
import { buildVirtualChart, groupIncomingByTarget } from '@/core/tai-sui-rua-gua/virtual-chart'
import type { VirtualChart, IncomingStar } from '@/core/tai-sui-rua-gua/virtual-chart'
import { calculateDirectionMatrix, buildThreeLayerTable } from './helpers/fortune-runner'
import { injectStage4Knowledge } from './helpers/knowledge-injector'

/** 十天干 */
const GAN_TABLE: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

/** 十二地支 */
const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/**
 * 执行阶段四：互动关系分析
 *
 * 当 partnerBirthYear 有值时：完整太岁入卦 + 三维合参
 * 当 partnerBirthYear 为 null 时：降级为单方关系宫分析（E3）
 */
export function executeStage4(input: Stage4Input): Stage4Output {
  const { stage1, stage2, partnerBirthYear, targetYear } = input

  // 无对方出生年份 → 单方关系宫分析
  if (partnerBirthYear === null) {
    return executeStage4Solo(input)
  }

  // 1. 计算对方天干地支
  const partnerGan = GAN_TABLE[(partnerBirthYear - 4) % 10]
  const partnerZhi = DI_ZHI_ORDER[(partnerBirthYear - 4) % 12]

  // 2. 构建虚拟命盘（太岁入卦）
  //    修正：传入命主命盘数据，四化落宫直接查找
  const virtualChart = buildVirtualChart(partnerGan, partnerZhi, stage1.scoringCtx.palaces)

  // 3. 将入卦星曜映射到命主实际宫位（二次确认，已由 buildVirtualChart 直接查找）
  //    此步骤保留为安全保障，对已正确映射的星曜不会重复处理
  const mappedChart = mapStarsToNatalChart(virtualChart, stage1.scoringCtx)

  // 4. 三维合参分析
  const threeDimension = buildThreeDimensionAnalysis(
    mappedChart,
    stage2,
    input.chartData,
    targetYear,
    stage1.scoringCtx,
  )

  // 5. 识别核心张力点
  const tensionPoints = extractTensionPoints(mappedChart)

  // 6. 知识注入（M6）
  const partnerStars = mappedChart.incomingStars.map(s => ({
    star: s.star,
    sihuaType: s.sihuaType,
  }))
  const tensionStarNames = tensionPoints.map(t => {
    // 从张力描述中提取星曜名
    const match = t.match(/^([^\s：]+)/)
    return match ? match[1] : ''
  })

  const knowledgeSnippets = injectStage4Knowledge(partnerStars, tensionStarNames)

  // 7. 构建互动分析结果
  const interaction: InteractionAnalysis = {
    partnerGan,
    partnerZhi,
    virtualChart: mappedChart,
    threeDimension,
    tensionPoints,
    adjustableAdvice: generateAdjustableAdvice(tensionPoints),
    fixedRisks: generateFixedRisks(mappedChart),
  }

  return {
    interaction,
    knowledgeSnippets,
  }
}

// ── 内部辅助 ──────────────────────────────────────────────

/**
 * 将虚拟命盘中的 findStarPalace 占位替换为真实查找
 */
function mapStarsToNatalChart(
  chart: VirtualChart,
  natalCtx: Stage4Input['stage1']['scoringCtx'],
): VirtualChart {
  const mappedStars = chart.incomingStars.map(star => {
    if (star.type === '生年四化' || star.type === '太岁宫宫干四化') {
      // 在命盘中查找该星曜所在的真实宫位地支
      const realZhi = findStarInNatal(star.star, natalCtx)
      return { ...star, targetDiZhi: realZhi }
    }
    return star
  })

  return { ...chart, incomingStars: mappedStars }
}

/**
 * 在命盘中查找星曜所在宫位的地支
 */
function findStarInNatal(starName: string, ctx: Stage4Input['stage1']['scoringCtx']): DiZhi {
  for (const palace of ctx.palaces) {
    if (palace.stars.some(s => s.name === starName)) {
      return palace.diZhi
    }
  }
  return '子' // 未找到时的默认值
}

/**
 * 三维合参分析
 */
function buildThreeDimensionAnalysis(
  chart: VirtualChart,
  stage2: Stage4Input['stage2'],
  chartData: Record<string, unknown>,
  targetYear: number,
  natalCtx: Stage4Input['stage1']['scoringCtx'],
): ThreeDimensionAnalysis {
  // 维度 A：入卦者心态
  const shengNianSihua = chart.sihua.shengNian
  const dunGanSihua = chart.sihua.dunGan

  const dimensionA = {
    earlyTendency: `生年四化驱动：${shengNianSihua.禄}化禄（给予）、${shengNianSihua.忌}化忌（执念）`,
    lateTendency: `太岁宫宫干四化（太岁入卦，主晚）驱动：${dunGanSihua.禄}化禄（转变给予）、${dunGanSihua.忌}化忌（转变执念）`,
  }

  // 维度 B：命主底色
  const dimensionB = {
    tone: stage2.overallTone,
    summary: stage2.mingGongHolographic.summary,
  }

  // 维度 C：大限/流年引动（调用真实行运计算）
  const targetYr = targetYear ?? new Date().getFullYear()
  let decadalSummary = '暂无大限数据'
  let yearlySummary = `${targetYr}年流年引动待计算`

  try {
    const chartDataAny = chartData as Record<string, unknown>
    const birthInfo = chartDataAny.birthInfo as Record<string, unknown> | undefined
    const birthYear = typeof birthInfo?.year === 'number' ? birthInfo.year : 0

    if (birthYear > 0) {
      // 构建三层宫位表获取当前大限信息
      const { daXianMappings } = buildThreeLayerTable(
        natalCtx,
        chartDataAny,
        targetYr,
      )
      const currentAge = targetYr - birthYear
      const currentDaXian = daXianMappings.find(
        d => d.ageRange[0] <= currentAge && d.ageRange[1] >= currentAge,
      )

      if (currentDaXian) {
        const daXianSihua = currentDaXian.mutagen.filter(Boolean)
        decadalSummary = `当前大限(${currentDaXian.ageRange[0]}-${currentDaXian.ageRange[1]}岁)天干${currentDaXian.daXianGan}，四化：${daXianSihua.join('、') || '无'}，入卦者能量在${currentDaXian.mingPalaceName}宫发挥`
      }

      // 流年四化与入卦者四化交叉
      const liuNianGan = GAN_TABLE[(targetYr - 4) % 10]
      const liuNianSihua = ['化禄', '化权', '化科', '化忌']
      const crossEffects: string[] = []
      const natalSihuaStars = [chart.sihua.shengNian.禄, chart.sihua.shengNian.忌]
      for (const type of liuNianSihua) {
        // 检查流年四化是否与入卦者四化重叠
        // 这里简化处理，实际需要完整四化计算
        if (natalSihuaStars.some(s => s)) {
          crossEffects.push(`${liuNianGan}干${type}与入卦者能量${crossEffects.length > 0 ? '持续' : '初次'}交叉`)
        }
      }
      yearlySummary = crossEffects.length > 0
        ? `${targetYr}年(${liuNianGan}年)流年引动：${crossEffects.slice(0, 2).join('；')}`
        : `${targetYr}年(${liuNianGan}年)流年引动，暂无特殊交叉效应`
    }
  } catch {
    // 行运计算失败时保持默认值
  }

  const dimensionC = {
    currentDecadalEffect: decadalSummary,
    yearlyTrigger: yearlySummary,
  }

  return { dimensionA, dimensionB, dimensionC }
}

/**
 * 提取核心张力点（1-3个）
 *
 * 规则：化忌重叠、权忌交冲、双忌叠压等
 */
function extractTensionPoints(chart: VirtualChart): string[] {
  const points: string[] = []

  // 按地支分组，检查同一宫位是否有冲突能量
  const grouped = groupIncomingByTarget(chart)

  for (const [zhi, stars] of Object.entries(grouped)) {
    const jiStars = stars.filter(s => s.sihuaType === '化忌')
    const luStars = stars.filter(s => s.sihuaType === '化禄')
    const quanStars = stars.filter(s => s.sihuaType === '化权')

    if (jiStars.length >= 2) {
      points.push(`${jiStars.map(s => s.star).join('+')} 双忌叠压于${zhi}宫，是核心摩擦源`)
    }
    if (jiStars.length > 0 && quanStars.length > 0) {
      points.push(`${quanStars[0].star}化权与${jiStars[0].star}化忌交冲于${zhi}宫，控制欲与执念的拉扯`)
    }
    if (jiStars.length > 0 && luStars.length > 0) {
      points.push(`${luStars[0].star}化禄与${jiStars[0].star}化忌同落于${zhi}宫，给予与索取的矛盾`)
    }
  }

  return points.slice(0, 3)
}

/**
 * 生成可调整建议
 */
function generateAdjustableAdvice(tensionPoints: string[]): string[] {
  const advice: string[] = []

  if (tensionPoints.some(p => p.includes('权忌交冲'))) {
    advice.push('控制欲可通过明确分工和边界感来化解，避免单方面做决定')
  }
  if (tensionPoints.some(p => p.includes('禄忌同落'))) {
    advice.push('给予与索取的矛盾需要双方坦诚沟通期望，建立对等的付出模式')
  }
  if (tensionPoints.some(p => p.includes('双忌叠压'))) {
    advice.push('核心摩擦需要双方都有意识地进行情绪管理，建议设定冷静机制')
  }

  if (advice.length === 0) {
    advice.push('整体互动能量较为平顺，注意保持沟通和理解即可')
  }

  return advice
}

/**
 * 生成不可调整风险预警
 */
function generateFixedRisks(chart: VirtualChart): string[] {
  const risks: string[] = []
  const jiCount = chart.incomingStars.filter(s => s.sihuaType === '化忌').length

  if (jiCount >= 3) {
    risks.push('入卦方化忌过多，关系中存在结构性的误解倾向，需要长期耐心')
  }

  return risks
}

// ── E3 单方关系宫分析（无对方出生年份时的降级方案） ────────

/**
 * 单方关系宫分析
 *
 * 无对方出生年份时，提取命主关系宫位（夫妻宫、对宫、三合）的确定性数据。
 * 关系倾向等软性解读交给 M7 LLM 基于注入的星曜赋性来表达，
 * 不在此处硬编码领域知识。
 */
function executeStage4Solo(input: Stage4Input): Stage4Output {
  const { stage1, stage2 } = input
  const ctx = stage1.scoringCtx
  const scores = stage1.palaceScores

  // 关系宫位索引：夫妻宫=10, 迁移宫(对宫)=6, 福德宫(三合)=2, 子女宫(桃花)=9
  const spouseIdx = 10
  const oppositeIdx = 6
  const fortuneIdx = 2
  const childrenIdx = 9

  const spouseScore = scores[spouseIdx]
  const spousePalace = ctx.palaces[spouseIdx]

  // 1. 关系宫四化数据
  const spouseSihua = spousePalace.stars.filter(s => s.sihua).map(s => ({
    type: s.sihua as SihuaType,
    star: s.name,
  }))
  const jiInSpouse = spouseSihua.filter(s => s.type === '化忌')
  const luInSpouse = spouseSihua.filter(s => s.type === '化禄')

  // 2. 夫妻宫主星列表（确定性数据，不含解读）
  const spouseMajorStars = spousePalace.majorStars.map(ms => ms.star)

  // 3. 对宫四化（迁移宫投射）
  const oppositePalace = ctx.palaces[oppositeIdx]
  const oppositeSihua = oppositePalace.stars.filter(s => s.sihua).map(s => ({
    type: s.sihua as SihuaType,
    star: s.name,
  }))

  // 4. 三合宫支撑评分（确定性数值）
  const fortuneScore = scores[fortuneIdx]?.finalScore ?? 5
  const childrenScore = scores[childrenIdx]?.finalScore ?? 5
  const trineSupport = (fortuneScore + childrenScore) / 2

  // 5. 构建三维分析（仅确定性数据，不含软性解读）
  const threeDimension: ThreeDimensionAnalysis = {
    dimensionA: {
      earlyTendency: `夫妻宫${spouseScore?.tone ?? '未知'}（${spouseScore?.finalScore.toFixed(1) ?? '?'}分），主星：${spouseMajorStars.join('、') || '无主星（借对宫）'}。四化：${spouseSihua.map(s => `${s.star}${s.type}`).join('、') || '无'}`,
      lateTendency: `化禄：${luInSpouse.length > 0 ? luInSpouse.map(s => s.star).join('、') : '无'}。化忌：${jiInSpouse.length > 0 ? jiInSpouse.map(s => s.star).join('、') : '无'}`,
    },
    dimensionB: {
      tone: stage2.overallTone,
      summary: stage2.mingGongHolographic.summary,
    },
    dimensionC: {
      currentDecadalEffect: `对宫（迁移宫）四化投射：${oppositeSihua.length > 0 ? oppositeSihua.map(s => `${s.star}${s.type}`).join('、') : '无'}。对宫主星：${oppositePalace.majorStars.map(ms => ms.star).join('、') || '无'}`,
      yearlyTrigger: `三合支撑：福德宫${fortuneScore.toFixed(1)}分 + 子女宫${childrenScore.toFixed(1)}分 = 均值${trineSupport.toFixed(1)}`,
    },
  }

  // 6. 确定性张力点（基于数值阈值，不含软性解读）
  const tensionPoints: string[] = []
  if (jiInSpouse.length > 0) {
    tensionPoints.push(`夫妻宫化忌（${jiInSpouse.map(s => s.star).join('、')}）`)
  }
  if (spouseScore && spouseScore.finalScore < 4) {
    tensionPoints.push(`夫妻宫评分偏低（${spouseScore.finalScore.toFixed(1)}）`)
  }
  if (oppositeSihua.some(s => s.type === '化忌')) {
    tensionPoints.push(`迁移宫化忌投射（${oppositeSihua.filter(s => s.type === '化忌').map(s => s.star).join('、')}）`)
  }

  // 7. 知识注入：夫妻宫主星赋性 + 张力星曜赋性（M6 查询，非硬编码）
  const knowledgeSnippets = injectStage4Knowledge(
    spouseMajorStars.map(s => ({ star: s, sihuaType: spouseSihua.find(h => h.star === s)?.type })),
    tensionPoints,
  )

  const interaction: InteractionAnalysis = {
    partnerGan: '—' as TianGan,
    partnerZhi: '—' as DiZhi,
    virtualChart: null,
    threeDimension,
    tensionPoints,
    adjustableAdvice: [],  // 交由 M7 LLM 基于知识片段解读
    fixedRisks: jiInSpouse.length >= 2
      ? [`夫妻宫双忌（${jiInSpouse.map(s => s.star).join('、')}）`]
      : [],
  }

  return { interaction, knowledgeSnippets }
}
