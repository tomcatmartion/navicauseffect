/**
 * 数据源清单（Data Sources Manifest）
 *
 * 原则：所有命盘基础数据必须以 iztro 为准，JSON/计算数据仅作辅助。
 * 本文件列出所有数据项的权威来源，供开发和排查参考。
 */

// ═══════════════════════════════════════════════════════════════════
// 分类 1：iztro 权威数据（直接读取，禁止二次计算）
// ═══════════════════════════════════════════════════════════════════

export const IZTRO_AUTHORITATIVE_SOURCES = {
  // 出生信息
  birthYearGanZhi: {
    source: 'iztro.rawDates.chineseDate.yearly',
    description: '生年干支 [天干, 地支]，已处理农历跨年',
    example: "['己', '卯']",
    fallback: 'iztro.chineseDate 字符串首词',
  },
  solarDate: {
    source: 'iztro.solarDate',
    description: '阳历日期字符串',
  },
  lunarDate: {
    source: 'iztro.lunarDate',
    description: '农历日期字符串',
  },
  chineseDate: {
    source: 'iztro.chineseDate',
    description: '八字四柱字符串，如 "己卯 丙子 戊午 丁巳"',
  },

  // 命身宫
  mingGongZhi: {
    source: 'iztro.earthlyBranchOfSoulPalace',
    description: '命宫地支',
  },
  shenGongZhi: {
    source: 'iztro.earthlyBranchOfBodyPalace',
    description: '身宫地支',
  },
  soulStar: {
    source: 'iztro.soul',
    description: '命主星',
  },
  bodyStar: {
    source: 'iztro.body',
    description: '身主星',
  },

  // 五行局
  fiveElementsClass: {
    source: 'iztro.fiveElementsClass',
    description: '五行局，如 "水二局"',
  },

  // 十二宫（含星曜）
  palaces: {
    source: 'iztro.palaces',
    description: '十二宫完整数据，每个宫位包含：',
    fields: [
      'name: 宫位名称',
      'earthlyBranch: 地支',
      'heavenlyStem: 天干',
      'isBodyPalace: 是否身宫',
      'isOriginalPalace: 是否原宫',
      'majorStars: 主星数组（name, type, mutagen, brightness）',
      'minorStars: 辅星数组',
      'adjectiveStars: 丙丁级星曜数组',
      'decadal: 大限信息（range, heavenlyStem, earthlyBranch）',
      'ages: 年龄数组',
    ],
  },

  // 运限信息
  horoscope: {
    source: 'iztro.horoscope(date, hourIndex)',
    description: '运限对象，包含：',
    fields: [
      'decadal: 大限（index, name, heavenlyStem, earthlyBranch, palaceNames, mutagen）',
      'yearly: 流年（index, name, heavenlyStem, earthlyBranch, palaceNames, mutagen）',
      'age: 小限（index, name, heavenlyStem, earthlyBranch, nominalAge）',
      'monthly: 流月',
      'daily: 流日',
    ],
  },
} as const

// ═══════════════════════════════════════════════════════════════════
// 分类 2：派生数据（从 iztro 数据计算得出）
// ═══════════════════════════════════════════════════════════════════

export const DERIVED_DATA = {
  taiSuiZhi: {
    source: 'iztro.rawDates.chineseDate.yearly[1]',
    description: '太岁宫地支 = 生年地支',
    calculation: '直接提取，禁止用公历年份公式计算',
  },
  taiSuiPalace: {
    source: 'iztro.palaces.find(p => p.earthlyBranch === taiSuiZhi)',
    description: '太岁宫完整数据',
    calculation: '在 palaces 数组中按地支查找',
  },
  shenGongPalace: {
    source: 'iztro.palaces.find(p => p.isBodyPalace)',
    description: '身宫完整数据',
    calculation: '按 isBodyPalace 标记查找',
  },
  skeletonId: {
    source: 'iztro.palaces 中紫微星所在地支',
    description: '骨架序号 P01-P12',
    calculation: '查找紫微星 → 获取地支 → 地支顺序索引+1',
  },
} as const

// ═══════════════════════════════════════════════════════════════════
// 分类 3：JSON 配置数据（知识库/规则，非命盘数据）
// ═══════════════════════════════════════════════════════════════════

export const JSON_CONFIG_SOURCES = {
  // 知识库
  starAttributes: {
    source: 'src/core/knowledge-dict/data/star_attributes.json',
    description: '星曜属性（五行、阴阳、化气等）',
    usage: '性格分析、星曜解读',
  },
  palaceAttributes: {
    source: 'src/core/knowledge-dict/data/palace_attributes.json',
    description: '宫位属性（五行、人事类别等）',
    usage: '宫位解读',
  },
  patternLibrary: {
    source: 'src/core/knowledge-dict/data/pattern_library.json',
    description: '格局库（名称、条件、级别、描述）',
    usage: '格局识别、性格影响分析',
  },
  sihuaTable: {
    source: 'src/core/knowledge-dict/data/sihua_table.json',
    description: '四化表（天干 → 禄权科忌）',
    usage: '四化查询',
  },

  // 评分配置
  scoringParams: {
    source: 'src/core/knowledge-dict/data/scoring.json',
    description: '宫位评分参数（权重、阈值等）',
    usage: 'Stage1 评分计算',
  },

  // 规则
  palaceBrightnessRules: {
    source: 'src/core/knowledge-dict/data/palace_brightness_rules.json',
    description: '宫位亮度规则',
    usage: '亮度评估',
  },
  starMutagenRules: {
    source: 'src/core/knowledge-dict/data/star_mutagen_rules.json',
    description: '星曜四化规则',
    usage: '四化影响评估',
  },
} as const

// ═══════════════════════════════════════════════════════════════════
// 分类 4：计算数据（算法生成，非原始数据）
// ═══════════════════════════════════════════════════════════════════

export const COMPUTED_DATA = {
  palaceScores: {
    source: 'Stage1 评分算法',
    description: '十二宫评分（0-10分）',
    inputs: ['iztro palaces', 'scoring.json 参数'],
  },
  patterns: {
    source: '格局识别算法',
    description: '命盘格局列表（君臣庆会、日月并明等）',
    inputs: ['iztro palaces', 'pattern_library.json'],
  },
  personalityTags: {
    source: 'Stage2 性格分析算法',
    description: '性格标签（四维合参、全息底色等）',
    inputs: ['palaceScores', 'iztro palaces', '知识库'],
  },
  fourDimensions: {
    source: 'M4 性格定性模块',
    description: '四维性格分数（开放性、尽责性等）',
    inputs: ['palaceScores', 'iztro palaces'],
  },
} as const

// ═══════════════════════════════════════════════════════════════════
// 数据流追踪辅助函数
// ═══════════════════════════════════════════════════════════════════

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

/**
 * 验证 chartData 是否包含完整的 iztro 原始数据
 */
export function validateChartDataIntegrity(chartData: Record<string, unknown>): {
  valid: boolean
  missing: string[]
} {
  const required = [
    'chineseDate',
    'rawDates.chineseDate.yearly',
    'earthlyBranchOfSoulPalace',
    'earthlyBranchOfBodyPalace',
    'palaces',
    'soul',
    'body',
    'fiveElementsClass',
  ]

  const missing: string[] = []

  for (const path of required) {
    const value = getNestedValue(chartData, path)
    if (value === undefined || value === null || value === '') {
      missing.push(path)
    }
  }

  // 验证 palaces 数组
  const palaces = chartData.palaces
  if (!Array.isArray(palaces) || palaces.length !== 12) {
    missing.push('palaces (必须是非空12元素数组)')
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * 提取关键数据用于调试对比
 */
export function extractKeyDataForDebug(chartData: Record<string, unknown>): {
  birthGanZhi: string
  mingGongZhi: string
  shenGongZhi: string
  taiSuiZhi: string
  taiSuiPalaceName: string
  taiSuiMajorStars: string
  shenPalaceName: string
  shenMajorStars: string
} {
  const rawDates = chartData.rawDates as Record<string, unknown> | undefined
  const chineseDate = rawDates?.chineseDate as Record<string, unknown> | undefined
  const yearly = chineseDate?.yearly as string[] | undefined
  const birthGanZhi = yearly?.join('') ?? '未知'
  const taiSuiZhi = yearly?.[1] ?? '未知'

  const palaces = (chartData.palaces ?? []) as Array<Record<string, unknown>>

  const taiSuiPalace = palaces.find(p => p.earthlyBranch === taiSuiZhi)
  const shenPalace = palaces.find(p => p.isBodyPalace)

  const formatStars = (p: Record<string, unknown> | undefined): string => {
    if (!p) return '(未找到)'
    const stars = (p.majorStars as Array<Record<string, unknown>> ?? [])
      .map(s => `${s.name}${s.brightness ? `(${s.brightness})` : ''}`)
      .join(', ')
    return stars || '(空宫)'
  }

  return {
    birthGanZhi,
    mingGongZhi: String(chartData.earthlyBranchOfSoulPalace ?? '未知'),
    shenGongZhi: String(chartData.earthlyBranchOfBodyPalace ?? '未知'),
    taiSuiZhi,
    taiSuiPalaceName: String(taiSuiPalace?.name ?? '未知'),
    taiSuiMajorStars: formatStars(taiSuiPalace),
    shenPalaceName: String(shenPalace?.name ?? '未知'),
    shenMajorStars: formatStars(shenPalace),
  }
}
