/**
 * personality_triad.json 驱动的命身太岁性格画像构建
 */

import type { ScoringContext } from '@/core/energy-evaluator/scoring-flow'
import type { PalaceScore, PalaceName } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'
import { getPersonalityTriad } from '@/core/knowledge-dict/loader'
import { getStarAttr } from '@/core/knowledge-dict/query'
import type {
  PersonalityLayerProfile,
  PersonalityTriadProfile,
  TriadLayerName,
} from '@/core/knowledge-dict/personality-triad-types'
import type { MajorStar } from '@/core/types'

const JI_STARS = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']
const SHA_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']

function scoreStrength(finalScore: number): string {
  const cfg = getPersonalityTriad().score_to_strength
  if (finalScore >= cfg.strong.range[0]) return cfg.strong.level
  if (finalScore >= cfg.medium.range[0]) return cfg.medium.level
  return cfg.weak.level
}

function isYangStar(star: string): boolean {
  const cfg = getPersonalityTriad().star_yin_yang
  if (cfg.阳星.includes(star)) return true
  if (cfg.阴星.includes(star)) return false
  return true
}

function resolveBaseTrait(finalScore: number, mainStar: string): string {
  const yang = isYangStar(mainStar)
  const rules = getPersonalityTriad().temperament_base.rules
  for (const rule of rules) {
    const c = rule.condition
    if (c.includes('score >= 6.0') && finalScore >= 6.0 && c.includes('阳星') && yang) return rule.base_trait
    if (c.includes('score >= 6.0') && finalScore >= 6.0 && c.includes('阴星') && !yang) return rule.base_trait
    if (c.includes('between 4.0 and 5.9') && finalScore >= 4.0 && finalScore <= 5.9) return rule.base_trait
    if (c.includes('score < 4.0') && finalScore < 4.0 && c.includes('阳星') && yang) return rule.base_trait
    if (c.includes('score < 4.0') && finalScore < 4.0 && c.includes('阴星') && !yang) return rule.base_trait
  }
  return '性格表现需结合命盘综合判断'
}

function firstSentence(text: string): string {
  const idx = text.search(/[。！？]/)
  return idx >= 0 ? text.slice(0, idx + 1) : text
}

function patternEffectText(patterns: PalaceScore['patterns']): string {
  if (!patterns.length) return ''
  const levelOrder = ['大凶', '中凶', '小凶', '小吉', '中吉', '大吉']
  let best = patterns[0]
  for (const p of patterns) {
    const cur = levelOrder.indexOf(p.level)
    const prev = levelOrder.indexOf(best.level)
    if (cur > prev) best = p
  }
  const templates = getPersonalityTriad().pattern_effect
  const tpl = templates[best.level as keyof typeof templates]
  if (!tpl) return `格局${best.name}影响性情。`
  const adj = best.level.includes('吉') ? '开朗稳健' : '波动明显'
  return tpl.replace('{正面形容词}', adj).replace('{负面形容词}', '急躁或压抑')
}

function extraStarsText(starNames: string[]): string {
  const cfg = getPersonalityTriad().extra_stars_rules
  const parts: string[] = []
  for (const name of starNames) {
    if (cfg.吉星集[name]) parts.push(`加上${name}，使${cfg.吉星集[name]}`)
    if (cfg.煞星集[name]) parts.push(`加上${name}，使${cfg.煞星集[name]}`)
  }
  return parts.length ? parts.join('；') + '。' : ''
}

function buildLayerProfile(
  layer: TriadLayerName,
  palaceIdx: number,
  palaceName: PalaceName,
  ctx: ScoringContext,
  palaceScores: PalaceScore[],
): PersonalityLayerProfile {
  const palace = ctx.palaces[palaceIdx]
  const score = palaceScores[palaceIdx]?.finalScore ?? 5
  const mainStar = palace.majorStars[0]?.star ?? '无主星'
  const brightness = palace.brightness ?? '平'
  const yinYang: '阳' | '阴' = isYangStar(mainStar) ? '阳' : '阴'
  const strength = scoreStrength(score)
  const baseTrait = resolveBaseTrait(score, mainStar)
  const starAttr = getStarAttr(mainStar as MajorStar)
  const starTrait = starAttr?.coreTrait ?? ''
  const positiveTrait = starAttr ? firstSentence(starAttr.positiveTrait) : ''
  const negativeTrait = starAttr ? firstSentence(starAttr.negativeTrait) : ''
  const adverb = getPersonalityTriad().brightness_adverbs[brightness] ?? '有时'
  const layerCfg = getPersonalityTriad().layers[layer]
  const allStarNames = palace.stars.map(s => s.name)
  const jiSha = allStarNames.filter(n => JI_STARS.includes(n) || SHA_STARS.includes(n))
  const extra = extraStarsText(jiSha)
  const patternFx = patternEffectText(palaceScores[palaceIdx]?.patterns ?? [])

  const template = layerCfg.analysis_template
  const description = template
    .replace('{main_star}', mainStar)
    .replace('{brightness}', brightness)
    .replace('{yin_yang}', yinYang)
    .replace('{score_strength}', strength)
    .replace('{base_trait}', baseTrait)
    .replace('{star_trait}', starTrait)
    .replace('{brightness_adverb}', adverb)
    .replace('{ bright_adverb }', adverb)
    .replace('{positive_trait}', positiveTrait.replace(/。$/, ''))
    .replace('{negative_supplement}', negativeTrait.replace(/。$/, ''))
    .replace('{extra_stars}', extra)
    .replace('{pattern_effect}', patternFx)

  return {
    layer,
    palace: palaceName,
    mainStar,
    brightness,
    yinYang,
    scoreStrength: strength,
    baseTrait,
    description,
  }
}

export interface BuildPersonalityTriadInput {
  ctx: ScoringContext
  palaceScores: PalaceScore[]
  mingIdx: number
  shenIdx: number
  taiSuiIdx: number
}

export function buildPersonalityTriadProfile(input: BuildPersonalityTriadInput): PersonalityTriadProfile {
  const { ctx, palaceScores, mingIdx, shenIdx, taiSuiIdx } = input
  const mingLayer = buildLayerProfile('命宫', mingIdx, '命宫', ctx, palaceScores)
  const shenName = (PALACE_NAMES[shenIdx] ?? '迁移') as PalaceName
  const shenLayer = buildLayerProfile('身宫', shenIdx, shenName, ctx, palaceScores)
  const taiSuiName = (PALACE_NAMES[taiSuiIdx] ?? '父母') as PalaceName
  const taiSuiLayer = buildLayerProfile('太岁宫', taiSuiIdx, taiSuiName, ctx, palaceScores)

  const tpl = getPersonalityTriad().synthesis_priority.template
  const synthesis = tpl
    .replace('{命宫描述}', mingLayer.description)
    .replace('{身宫描述}', shenLayer.description)
    .replace('{太岁宫描述}', taiSuiLayer.description)
    .replace('{整体评价}', `${mingLayer.baseTrait}；压力下${shenLayer.baseTrait}；内核${taiSuiLayer.baseTrait}`)

  return {
    version: getPersonalityTriad().version,
    mingLayer,
    shenLayer,
    taiSuiLayer,
    synthesis,
  }
}
