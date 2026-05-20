/**
 * P0: 格局人格特质注入
 *
 * 将 Stage1 格局识别结果（allPatterns）转化为性格特质关键词。
 * 每个格局类别对应一组性格维度，用于丰富性格分析。
 */

import type { PatternMatch } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════
// 格局类别 → 性格特质映射表
// ═══════════════════════════════════════════════════════════════════

/** 单条性格特质 */
export interface PatternPersonalityTrait {
  /** 特质关键词 */
  keyword: string
  /** 特质描述 */
  description: string
  /** 影响维度：surface(表层) / middle(中层) / core(核心) */
  dimension: 'surface' | 'middle' | 'core'
  /** 影响强度：1-5 */
  intensity: number
}

/** 格局性格影响 */
export interface PatternPersonalityInfluence {
  /** 格局名称 */
  patternName: string
  /** 格局级别 */
  level: string
  /** 性格特质列表 */
  traits: PatternPersonalityTrait[]
  /** 综合性格底色 */
  personalityBase: string
  /** 行为倾向 */
  behavioralTendency: string
  /** 人际风格 */
  interpersonalStyle: string
  /** 压力反应 */
  stressResponse: string
}

// ═══════════════════════════════════════════════════════════════════
// 格局性格映射字典
// ═══════════════════════════════════════════════════════════════════

const CATEGORY_TRAIT_MAP: Record<string, {
  traits: PatternPersonalityTrait[]
  personalityBase: string
  behavioralTendency: string
  interpersonalStyle: string
  stressResponse: string
}> = {
  '紫微': {
    traits: [
      { keyword: '领导力强', description: '天生具备统领全局的气场与魄力', dimension: 'core', intensity: 5 },
      { keyword: '自尊心强', description: '重视面子与尊严，不轻易低头', dimension: 'surface', intensity: 4 },
      { keyword: '有主见', description: '独立思考，不易被他人左右', dimension: 'core', intensity: 5 },
      { keyword: '贵气', description: '举止端庄，自带威严与贵气', dimension: 'surface', intensity: 4 },
      { keyword: '掌控欲', description: '喜欢掌控局面，对失控感到不安', dimension: 'middle', intensity: 4 },
    ],
    personalityBase: '帝王型人格：天生领导者，具备统御全局的胸襟与气魄',
    behavioralTendency: '行事大气，注重排场与仪式感，决策果断但有时会独断',
    interpersonalStyle: '在关系中倾向于主导地位，喜欢被尊重与追随，对下属宽容但对竞争者警惕',
    stressResponse: '压力下倾向于强化控制，可能变得专横或过度自我保护',
  },
  '廉贞': {
    traits: [
      { keyword: '情感丰富', description: '内心世界丰富，情感表达强烈', dimension: 'core', intensity: 4 },
      { keyword: '追求完美', description: '对自己和他人要求高，注重细节', dimension: 'middle', intensity: 5 },
      { keyword: '敢爱敢恨', description: '情感分明，爱憎强烈', dimension: 'surface', intensity: 4 },
      { keyword: '原则性强', description: '有明确的是非观和底线', dimension: 'core', intensity: 4 },
      { keyword: '易纠结', description: '思虑过多，容易陷入内心冲突', dimension: 'middle', intensity: 4 },
    ],
    personalityBase: '次桃花型人格：情感丰富且原则性强，内心敏感而外表刚强',
    behavioralTendency: '做事追求完美，注重品质与格调，情感投入深但收回也快',
    interpersonalStyle: '在关系中追求精神共鸣，对背叛零容忍，重视忠诚度',
    stressResponse: '压力下容易情绪化，可能变得偏执或自我封闭',
  },
  '武曲': {
    traits: [
      { keyword: '务实理性', description: '注重实际效果，不尚空谈', dimension: 'core', intensity: 5 },
      { keyword: '执行力强', description: '说到做到，行动力超群', dimension: 'surface', intensity: 5 },
      { keyword: '理财意识', description: '对金钱敏感，善于理财', dimension: 'middle', intensity: 4 },
      { keyword: '刚毅果决', description: '性格刚强，决策果断', dimension: 'core', intensity: 4 },
      { keyword: '不善表达', description: '情感内敛，不擅长甜言蜜语', dimension: 'surface', intensity: 3 },
    ],
    personalityBase: '财星型人格：务实理性，执行力强，重视物质安全感',
    behavioralTendency: '做事雷厉风行，注重效率与结果，对无意义的事情缺乏耐心',
    interpersonalStyle: '在关系中务实可靠，用行动代替言语表达爱意，重视物质基础',
    stressResponse: '压力下更加努力工作，可能变得冷漠或过度关注物质',
  },
  '巨门': {
    traits: [
      { keyword: '口才出众', description: '表达能力强，善于辩论', dimension: 'surface', intensity: 5 },
      { keyword: '洞察力强', description: '善于看穿事物本质', dimension: 'core', intensity: 4 },
      { keyword: '多疑敏感', description: '思虑过多，容易怀疑', dimension: 'middle', intensity: 4 },
      { keyword: '是非分明', description: '喜欢明辨是非，好论对错', dimension: 'surface', intensity: 4 },
      { keyword: '内心孤独', description: '外表健谈但内心孤独', dimension: 'core', intensity: 4 },
    ],
    personalityBase: '暗曜型人格：口才出众但内心孤独，洞察力强但多疑敏感',
    behavioralTendency: '善于表达与说服，喜欢探究真相，对虚伪零容忍',
    interpersonalStyle: '在关系中需要深度沟通，讨厌敷衍，重视真诚与信任',
    stressResponse: '压力下容易多疑猜忌，可能变得尖刻或过度防御',
  },
  '日月': {
    traits: [
      { keyword: '光明磊落', description: '行事光明正大，不喜暗箱操作', dimension: 'surface', intensity: 4 },
      { keyword: '理想主义', description: '有远大理想，追求完美世界', dimension: 'core', intensity: 4 },
      { keyword: '情绪敏感', description: '对情绪变化敏感，易受环境影响', dimension: 'middle', intensity: 4 },
      { keyword: '乐于助人', description: '有奉献精神，愿意帮助他人', dimension: 'surface', intensity: 4 },
      { keyword: '情绪波动', description: '情绪起伏较大，阴晴不定', dimension: 'middle', intensity: 3 },
    ],
    personalityBase: '光明型人格：理想主义，光明磊落，情绪丰富且敏感',
    behavioralTendency: '行事追求光明正大，重视名誉与形象，有奉献精神',
    interpersonalStyle: '在关系中温暖体贴，需要被认可与尊重，对冷漠敏感',
    stressResponse: '压力下情绪波动明显，可能变得消极或过度理想化',
  },
  '杀破狼': {
    traits: [
      { keyword: '开创精神', description: '勇于开拓，不惧挑战', dimension: 'core', intensity: 5 },
      { keyword: '变动性强', description: '喜欢变化，不喜一成不变', dimension: 'surface', intensity: 5 },
      { keyword: '冒险精神', description: '敢于冒险，不惧失败', dimension: 'core', intensity: 4 },
      { keyword: '独立自主', description: '不依赖他人，喜欢自己做主', dimension: 'middle', intensity: 5 },
      { keyword: '冲动急躁', description: '行动快于思考，容易冲动', dimension: 'surface', intensity: 4 },
    ],
    personalityBase: '变动型人格：开创精神强，独立自主，喜变不喜静',
    behavioralTendency: '勇于尝试新事物，不惧变动与挑战，对稳定感到厌倦',
    interpersonalStyle: '在关系中需要自由空间，讨厌束缚，重视独立与平等',
    stressResponse: '压力下倾向于寻求变化或逃离，可能变得冲动或不负责任',
  },
  '天府': {
    traits: [
      { keyword: '稳重保守', description: '行事稳重，不喜冒险', dimension: 'core', intensity: 4 },
      { keyword: '包容力强', description: '心胸宽广，能容人容事', dimension: 'middle', intensity: 4 },
      { keyword: '理财稳健', description: '善于守财，理财稳健', dimension: 'middle', intensity: 4 },
      { keyword: '重视面子', description: '注重外在形象与社会地位', dimension: 'surface', intensity: 3 },
      { keyword: '缺乏激情', description: '性格平和但缺乏激情', dimension: 'surface', intensity: 3 },
    ],
    personalityBase: '守成型人格：稳重保守，包容力强，善于守成',
    behavioralTendency: '行事稳健保守，注重积累与守成，对冒险持谨慎态度',
    interpersonalStyle: '在关系中宽厚包容，重视家庭与稳定，对变动持保留态度',
    stressResponse: '压力下更加保守，可能变得固执或过度依赖既有模式',
  },
  '机梁同': {
    traits: [
      { keyword: '智慧过人', description: '聪明机智，思维敏捷', dimension: 'core', intensity: 5 },
      { keyword: '善谋多计', description: '善于谋划，足智多谋', dimension: 'middle', intensity: 5 },
      { keyword: '理想主义', description: '有远大理想，追求完美', dimension: 'core', intensity: 4 },
      { keyword: '善于分析', description: '逻辑清晰，善于分析问题', dimension: 'surface', intensity: 4 },
      { keyword: '思虑过多', description: '想得多做得少，容易犹豫', dimension: 'middle', intensity: 4 },
    ],
    personalityBase: '智慧型人格：聪明机智，善谋多计，理想主义色彩浓厚',
    behavioralTendency: '善于分析与谋划，重视知识与智慧，对愚昧缺乏耐心',
    interpersonalStyle: '在关系中重视精神交流，喜欢有深度的对话，对肤浅不耐烦',
    stressResponse: '压力下倾向于过度分析，可能变得优柔寡断或逃避现实',
  },
  '其他': {
    traits: [
      { keyword: '独特个性', description: '性格独特，不走寻常路', dimension: 'surface', intensity: 3 },
      { keyword: '适应力强', description: '能适应各种环境', dimension: 'middle', intensity: 3 },
      { keyword: '综合发展', description: '各方面均衡发展', dimension: 'core', intensity: 3 },
    ],
    personalityBase: '综合型人格：性格多元，适应力强，各方面均衡发展',
    behavioralTendency: '行事灵活多变，善于适应环境，不拘泥于固定模式',
    interpersonalStyle: '在关系中随和包容，能与不同类型的人相处',
    stressResponse: '压力下保持灵活，善于调整策略应对变化',
  },
}

// ═══════════════════════════════════════════════════════════════════
// 格局级别 → 影响强度倍率
// ═══════════════════════════════════════════════════════════════════

const LEVEL_INTENSITY_MAP: Record<string, number> = {
  '大吉': 1.5,
  '中吉': 1.3,
  '小吉': 1.1,
  '小凶': 0.9,
  '中凶': 0.7,
  '大凶': 0.5,
}

// ═══════════════════════════════════════════════════════════════════
// 核心函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 将格局列表转化为性格影响
 */
export function extractPatternPersonalityInfluences(
  patterns: PatternMatch[],
): PatternPersonalityInfluence[] {
  return patterns.map(p => {
    const categoryMap = CATEGORY_TRAIT_MAP[p.category] ?? CATEGORY_TRAIT_MAP['其他']
    const intensityMultiplier = LEVEL_INTENSITY_MAP[p.level] ?? 1.0

    // 根据格局级别调整特质强度
    const traits = categoryMap.traits.map(t => ({
      ...t,
      intensity: Math.min(5, Math.round(t.intensity * intensityMultiplier)),
    }))

    return {
      patternName: p.name,
      level: p.level,
      traits,
      personalityBase: categoryMap.personalityBase,
      behavioralTendency: categoryMap.behavioralTendency,
      interpersonalStyle: categoryMap.interpersonalStyle,
      stressResponse: categoryMap.stressResponse,
    }
  })
}

/**
 * 聚合多个格局的性格影响，生成综合性格画像
 */
export function aggregatePatternTraits(
  influences: PatternPersonalityInfluence[],
): {
  surfaceTraits: string[]
  middleTraits: string[]
  coreTraits: string[]
  personalityBase: string
  behavioralTendency: string
  interpersonalStyle: string
  stressResponse: string
} {
  if (influences.length === 0) {
    return {
      surfaceTraits: ['性格平和，无明显格局特质'],
      middleTraits: ['内在特质由主星和四化主导'],
      coreTraits: ['核心性格需结合具体星曜分析'],
      personalityBase: '无明显格局底色，性格由主星和四化塑造',
      behavioralTendency: '行事风格随环境变化，缺乏固定模式',
      interpersonalStyle: '人际关系顺其自然，无特殊倾向',
      stressResponse: '压力反应因人而异，需具体分析',
    }
  }

  // 按维度聚合特质，按强度排序
  const surfaceMap = new Map<string, number>()
  const middleMap = new Map<string, number>()
  const coreMap = new Map<string, number>()

  for (const inf of influences) {
    for (const t of inf.traits) {
      const map = t.dimension === 'surface' ? surfaceMap : t.dimension === 'middle' ? middleMap : coreMap
      const current = map.get(t.keyword) ?? 0
      map.set(t.keyword, current + t.intensity)
    }
  }

  // 排序并取前N个
  const sortByIntensity = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, total]) => ({ keyword, totalIntensity: total }))
      .slice(0, 5)

  const surfaceSorted = sortByIntensity(surfaceMap)
  const middleSorted = sortByIntensity(middleMap)
  const coreSorted = sortByIntensity(coreMap)

  // 生成综合描述
  const personalityBase = influences.length === 1
    ? influences[0].personalityBase
    : `复合型人格：${influences.map(i => i.personalityBase.split('：')[0]).join(' + ')}`

  // 合并行为倾向（取前3个格局的）
  const behavioralTendency = influences.slice(0, 3).map(i => i.behavioralTendency).join('；')
  const interpersonalStyle = influences.slice(0, 3).map(i => i.interpersonalStyle).join('；')
  const stressResponse = influences.slice(0, 3).map(i => i.stressResponse).join('；')

  return {
    surfaceTraits: surfaceSorted.map(t => `${t.keyword}(${t.totalIntensity})`),
    middleTraits: middleSorted.map(t => `${t.keyword}(${t.totalIntensity})`),
    coreTraits: coreSorted.map(t => `${t.keyword}(${t.totalIntensity})`),
    personalityBase,
    behavioralTendency,
    interpersonalStyle,
    stressResponse,
  }
}

/**
 * 生成格局性格影响文本描述（供前端展示）
 */
export function generatePatternInfluenceDescriptions(
  influences: PatternPersonalityInfluence[],
): string[] {
  return influences.map(inf => {
    const traitStr = inf.traits.slice(0, 3).map(t => t.keyword).join('、')
    return `${inf.patternName}（${inf.level}）：${inf.personalityBase}。主要特质：${traitStr}。${inf.behavioralTendency}`
  })
}
