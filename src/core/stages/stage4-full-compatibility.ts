/**
 * Stage4 完整合盘分析（双方完整命盘）
 *
 * 与 executeStage4（仅 partnerBirthYear）的区别：
 *   - 输入：两份完整的 ChartSnapshot（含 12 宫 + 主星 + 四化）
 *   - 输出：12 宫位对照 + 四化交叉 + 星曜互动 + 5 维评分 + 关键/风险提示
 *
 * 用于：合盘分析（情感/事业/财运/沟通/家庭）
 */
import type { ChartSnapshot } from '../chart/chart-snapshot-builder'

// ════════════════════════════════════════════════════════════
// 类型
// ════════════════════════════════════════════════════════════

export interface CompatibilityInput {
  selfChart: ChartSnapshot
  partnerChart: ChartSnapshot
  targetYear?: number
}

export interface PalaceComparison {
  palace: string
  self: { stars: string[]; score?: number }
  partner: { stars: string[]; score?: number }
  /** 'harmony' | 'tension' | 'neutral' */
  harmony: 'harmony' | 'tension' | 'neutral'
  /** 简短解读 */
  note: string
}

export interface CrossSihua {
  /** 谁的四化 */
  from: 'self' | 'partner'
  type: '禄' | '权' | '科' | '忌'
  star: string
  /** 落入对方的哪个宫 */
  landsInPartnerPalace: string
  /** 解读 */
  note: string
}

export interface StarInteraction {
  selfStar: string
  partnerStar: string
  palace: string
  /** '同宫' | '对宫' | '三合' */
  relation: '同宫' | '对宫' | '三合'
  /** '吉' | '凶' | '中性' */
  nature: '吉' | '凶' | '中性'
  note: string
}

export interface DimensionScores {
  /** 情感（0-100） */
  emotion: number
  /** 事业 */
  career: number
  /** 财运 */
  wealth: number
  /** 沟通 */
  communication: number
  /** 家庭 */
  family: number
  /** 综合 */
  overall: number
}

export interface Stage4FullOutput {
  palaceComparison: PalaceComparison[]
  crossSihua: CrossSihua[]
  starInteraction: StarInteraction[]
  dimensionScores: DimensionScores
  highlights: string[]
  risks: string[]
  /** 摘要文本（给 AI 解读用） */
  summaryText: string
}

// ════════════════════════════════════════════════════════════
// 内部工具
// ════════════════════════════════════════════════════════════

interface SimplePalace {
  name: string
  diZhi: string
  majorStars: string[]
  /** 四化（从 stage1 提取后注入；可选） */
  sihua?: Array<{ type: string; star: string }>
}

/** 从 ChartSnapshot.reading 提取 12 宫简化结构 */
function extractPalaces(snapshot: ChartSnapshot): SimplePalace[] {
  const reading = snapshot.reading as { palaces?: Array<Record<string, unknown>> }
  if (!reading?.palaces) return []
  return reading.palaces.map((p) => {
    const name = String(p.name ?? '')
    const diZhi = String(p.earthlyBranch ?? p.diZhi ?? '')
    const majorStarsRaw = (p.majorStars ?? []) as Array<Record<string, unknown>>
    const majorStars = majorStarsRaw.map((s) => String(s.name ?? s.star ?? '')).filter(Boolean)
    return { name, diZhi, majorStars }
  })
}

/** 提取原局生年四化（从 reading.horoscope 或 stage1） */
function extractSihua(snapshot: ChartSnapshot): Array<{ type: '禄' | '权' | '科' | '忌'; star: string; palace: string }> {
  // 优先从 stage1.scoringCtx 提取（最权威）
  const stage1 = snapshot.stage1 as {
    scoringCtx?: { birthSihua?: Array<{ type: string; star: string; palace: string }> }
  } | undefined
  if (stage1?.scoringCtx?.birthSihua?.length) {
    return stage1.scoringCtx.birthSihua.map((s) => ({
      type: s.type as '禄' | '权' | '科' | '忌',
      star: s.star,
      palace: s.palace,
    }))
  }
  return []
}

/** 宫位三方四正关系：返回对宫、三合（财帛/官禄） */
const PALACE_OPPOSITES: Record<string, string> = {
  '命宫': '迁移宫', '迁移宫': '命宫',
  '兄弟宫': '仆役宫', '仆役宫': '兄弟宫',
  '夫妻宫': '官禄宫', '官禄宫': '夫妻宫',
  '子女宫': '田宅宫', '田宅宫': '子女宫',
  '财帛宫': '福德宫', '福德宫': '财帛宫',
  '疾厄宫': '父母宫', '父母宫': '疾厄宫',
}

const PALACE_TRINES: Record<string, string[]> = {
  '命宫': ['财帛宫', '官禄宫'],
  '财帛宫': ['命宫', '官禄宫'],
  '官禄宫': ['命宫', '财帛宫'],
}

/** 主星吉凶倾向（紫微斗数常见主星简化标签） */
const STAR_NATURE: Record<string, '吉' | '凶' | '中性'> = {
  '紫微': '中性', '天府': '吉', '太阳': '吉', '太阴': '吉',
  '武曲': '中性', '天相': '吉', '天梁': '吉', '七杀': '中性',
  '破军': '中性', '贪狼': '中性', '廉贞': '中性', '巨门': '凶',
  '天机': '中性', '天同': '吉', '禄存': '吉', '天马': '中性',
  '左辅': '吉', '右弼': '吉', '文昌': '吉', '文曲': '吉',
  '天魁': '吉', '天钺': '吉', '火星': '凶', '铃星': '凶',
  '擎羊': '凶', '陀罗': '凶', '地空': '凶', '地劫': '凶',
}

function getStarNature(star: string): '吉' | '凶' | '中性' {
  return STAR_NATURE[star] ?? '中性'
}

// ════════════════════════════════════════════════════════════
// 子模块
// ════════════════════════════════════════════════════════════

/** 12 宫对照 */
function comparePalaces(self: SimplePalace[], partner: SimplePalace[]): PalaceComparison[] {
  const result: PalaceComparison[] = []
  for (const selfP of self) {
    const partnerP = partner.find((p) => p.name === selfP.name)
    if (!partnerP) continue

    // 同宫吉凶判断
    const selfFirstStar = selfP.majorStars[0] ?? ''
    const partnerFirstStar = partnerP.majorStars[0] ?? ''
    const selfNature = getStarNature(selfFirstStar)
    const partnerNature = getStarNature(partnerFirstStar)

    let harmony: PalaceComparison['harmony'] = 'neutral'
    let note = '宫位能量平稳'

    if (selfNature === '吉' && partnerNature === '吉') {
      harmony = 'harmony'
      note = '双方主星皆为吉星，宫位能量和谐'
    } else if (selfNature === '凶' && partnerNature === '凶') {
      harmony = 'tension'
      note = '双方主星皆为凶星，宫位易有冲突'
    } else if (selfNature === '凶' || partnerNature === '凶') {
      harmony = 'tension'
      note = '一方主星为凶，需注意此宫位议题'
    } else if (selfFirstStar && partnerFirstStar && selfFirstStar === partnerFirstStar) {
      harmony = 'harmony'
      note = '同主星坐宫，能量共振'
    }

    result.push({
      palace: selfP.name,
      self: { stars: selfP.majorStars },
      partner: { stars: partnerP.majorStars },
      harmony,
      note,
    })
  }
  return result
}

/** 四化交叉（A 的四化落宫 vs B 的同位宫位） */
function computeCrossSihua(
  selfSihua: ReturnType<typeof extractSihua>,
  partnerSihua: ReturnType<typeof extractSihua>,
  partnerPalaces: SimplePalace[],
  selfPalaces: SimplePalace[],
): CrossSihua[] {
  const result: CrossSihua[] = []
  // A → B
  for (const s of selfSihua) {
    const partnerTarget = partnerPalaces.find((p) => p.name === s.palace)
    if (!partnerTarget) continue
    result.push({
      from: 'self',
      type: s.type,
      star: s.star,
      landsInPartnerPalace: s.palace,
      note: getSihuaNote('self', s.type, s.star, s.palace),
    })
  }
  // B → A
  for (const s of partnerSihua) {
    const selfTarget = selfPalaces.find((p) => p.name === s.palace)
    if (!selfTarget) continue
    result.push({
      from: 'partner',
      type: s.type,
      star: s.star,
      landsInPartnerPalace: s.palace,
      note: getSihuaNote('partner', s.type, s.star, s.palace),
    })
  }
  return result
}

function getSihuaNote(from: 'self' | 'partner', type: string, star: string, palace: string): string {
  const who = from === 'self' ? '你' : '对方'
  switch (type) {
    case '禄':
      return `${who}的化禄（${star}）入对方${palace}，为此领域带来福气与缘分`
    case '权':
      return `${who}的化权（${star}）入对方${palace}，在此领域有主导力或压力`
    case '科':
      return `${who}的化科（${star}）入对方${palace}，带来贵人或和谐能量`
    case '忌':
      return `${who}的化忌（${star}）入对方${palace}，此领域易有纠缠、执着或冲突`
    default:
      return ''
  }
}

/** 星曜互动（双方同宫/对宫/三合） */
function computeStarInteraction(
  self: SimplePalace[],
  partner: SimplePalace[],
): StarInteraction[] {
  const result: StarInteraction[] = []
  for (const selfP of self) {
    const partnerP = partner.find((p) => p.name === selfP.name)
    if (!partnerP) continue

    // 同宫：双方主星交集
    const commonStars = selfP.majorStars.filter((s) => partnerP.majorStars.includes(s))
    for (const star of commonStars) {
      result.push({
        selfStar: star,
        partnerStar: star,
        palace: selfP.name,
        relation: '同宫',
        nature: getStarNature(star) === '凶' ? '凶' : '吉',
        note: `双方在${selfP.name}同坐${star}，能量叠加${getStarNature(star) === '凶' ? '易激化冲突' : '相互增益'}`,
      })
    }

    // 对宫：A 宫 vs B 对宫
    const oppositeName = PALACE_OPPOSITES[selfP.name]
    if (oppositeName) {
      const partnerOpposite = partner.find((p) => p.name === oppositeName)
      if (partnerOpposite) {
        for (const selfStar of selfP.majorStars.slice(0, 1)) {
          for (const partnerStar of partnerOpposite.majorStars.slice(0, 1)) {
            const nat1 = getStarNature(selfStar)
            const nat2 = getStarNature(partnerStar)
            const nature: '吉' | '凶' | '中性' =
              nat1 === '凶' || nat2 === '凶' ? '凶' :
              nat1 === '吉' && nat2 === '吉' ? '吉' : '中性'
            result.push({
              selfStar,
              partnerStar,
              palace: `${selfP.name}↔${oppositeName}`,
              relation: '对宫',
              nature,
              note: `${selfStar}与${partnerStar}对宫相照，能量${nature === '吉' ? '互补' : nature === '凶' ? '相冲' : '拉扯'}`,
            })
            break
          }
        }
      }
    }
  }
  return result
}

/** 5 维评分（启发式） */
function computeScores(
  palaces: PalaceComparison[],
  sihua: CrossSihua[],
  interactions: StarInteraction[],
): DimensionScores {
  const baseScore = 60

  // 情感：夫妻宫对照 + 化禄入夫妻 + 化忌入夫妻
  const hunGong = palaces.find((p) => p.palace === '夫妻宫')
  let emotion = baseScore
  if (hunGong?.harmony === 'harmony') emotion += 15
  else if (hunGong?.harmony === 'tension') emotion -= 15
  const jiIntoHun = sihua.filter((s) => s.type === '忌' && s.landsInPartnerPalace === '夫妻宫').length
  const luIntoHun = sihua.filter((s) => s.type === '禄' && s.landsInPartnerPalace === '夫妻宫').length
  emotion -= jiIntoHun * 10
  emotion += luIntoHun * 10
  emotion = Math.max(20, Math.min(95, emotion))

  // 事业：官禄宫对照
  const guanGong = palaces.find((p) => p.palace === '官禄宫')
  let career = baseScore
  if (guanGong?.harmony === 'harmony') career += 12
  else if (guanGong?.harmony === 'tension') career -= 12

  // 财运：财帛宫对照
  const caiGong = palaces.find((p) => p.palace === '财帛宫')
  let wealth = baseScore
  if (caiGong?.harmony === 'harmony') wealth += 12
  else if (caiGong?.harmony === 'tension') wealth -= 12
  const luIntoCai = sihua.filter((s) => s.type === '禄' && s.landsInPartnerPalace === '财帛宫').length
  wealth += luIntoCai * 8

  // 沟通：命宫 + 兄弟 + 仆役
  const mingGong = palaces.find((p) => p.palace === '命宫')
  let communication = baseScore
  if (mingGong?.harmony === 'harmony') communication += 10
  else if (mingGong?.harmony === 'tension') communication -= 10

  // 家庭：田宅 + 父母 + 子女
  const tianzhai = palaces.find((p) => p.palace === '田宅宫')
  let family = baseScore
  if (tianzhai?.harmony === 'harmony') family += 10
  else if (tianzhai?.harmony === 'tension') family -= 10

  // 综合加权
  const overall = Math.round(
    emotion * 0.3 + career * 0.2 + wealth * 0.2 + communication * 0.15 + family * 0.15
  )

  return {
    emotion: Math.max(20, Math.min(95, emotion)),
    career: Math.max(20, Math.min(95, career)),
    wealth: Math.max(20, Math.min(95, wealth)),
    communication: Math.max(20, Math.min(95, communication)),
    family: Math.max(20, Math.min(95, family)),
    overall: Math.max(20, Math.min(95, overall)),
  }
}

// ════════════════════════════════════════════════════════════
// 主入口
// ════════════════════════════════════════════════════════════

export function executeStage4Full(input: CompatibilityInput): Stage4FullOutput {
  const { selfChart, partnerChart } = input

  const selfPalaces = extractPalaces(selfChart)
  const partnerPalaces = extractPalaces(partnerChart)
  const selfSihua = extractSihua(selfChart)
  const partnerSihua = extractSihua(partnerChart)

  const palaceComparison = comparePalaces(selfPalaces, partnerPalaces)
  const crossSihua = computeCrossSihua(selfSihua, partnerSihua, partnerPalaces, selfPalaces)
  const starInteraction = computeStarInteraction(selfPalaces, partnerPalaces)
  const dimensionScores = computeScores(palaceComparison, crossSihua, starInteraction)

  // 关键提示
  const highlights: string[] = []
  for (const s of crossSihua.filter((s) => s.type === '禄').slice(0, 3)) {
    highlights.push(s.note)
  }
  for (const it of starInteraction.filter((i) => i.nature === '吉').slice(0, 2)) {
    highlights.push(it.note)
  }
  if (dimensionScores.emotion >= 75) highlights.push('情感契合度高，关系基础稳固')
  if (dimensionScores.wealth >= 75) highlights.push('财运互补，合作生财潜力大')

  // 风险提示
  const risks: string[] = []
  for (const s of crossSihua.filter((s) => s.type === '忌').slice(0, 3)) {
    risks.push(s.note)
  }
  for (const it of starInteraction.filter((i) => i.nature === '凶').slice(0, 2)) {
    risks.push(it.note)
  }
  if (dimensionScores.emotion < 45) risks.push('情感宫位压力大，需用心经营')
  if (dimensionScores.communication < 45) risks.push('沟通易有摩擦，注意表达方式')

  // 摘要文本（给 AI 解读用）
  const summaryText = [
    `宫位对照：${palaceComparison.filter((p) => p.harmony !== 'neutral').map((p) => `${p.palace}(${p.harmony === 'harmony' ? '吉' : '凶'})`).join('、') || '宫位能量平稳'}`,
    `四化交叉：${crossSihua.length}项`,
    `星曜互动：${starInteraction.length}项（吉${starInteraction.filter((i) => i.nature === '吉').length}/凶${starInteraction.filter((i) => i.nature === '凶').length}）`,
    `维度评分：情感${dimensionScores.emotion}·事业${dimensionScores.career}·财运${dimensionScores.wealth}·沟通${dimensionScores.communication}·家庭${dimensionScores.family}`,
    `综合契合度：${dimensionScores.overall}`,
    highlights.length ? `关键亮点：${highlights.join('；')}` : '',
    risks.length ? `风险提示：${risks.join('；')}` : '',
  ].filter(Boolean).join('\n')

  return {
    palaceComparison,
    crossSihua,
    starInteraction,
    dimensionScores,
    highlights,
    risks,
    summaryText,
  }
}
