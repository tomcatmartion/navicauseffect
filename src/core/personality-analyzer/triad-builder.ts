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
    if (c.includes('between 4.5 and 5.9') && finalScore >= 4.5 && finalScore <= 5.9) return rule.base_trait
    if (c.includes('score < 4.5') && finalScore < 4.5 && c.includes('阳星') && yang) return rule.base_trait
    if (c.includes('score < 4.5') && finalScore < 4.5 && c.includes('阴星') && !yang) return rule.base_trait
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

/** 丙丁级星曜名单 */
const MINOR_STAR_NAMES = ['红鸾', '天喜', '天刑', '天姚', '天哭', '天虚', '华盖', '天马', '咸池', '破碎', '力士', '青龙', '将军', '伏兵', '官府']

function filterMinorStars(starNames: string[]): string[] {
  return starNames.filter(n => MINOR_STAR_NAMES.includes(n))
}

function minorStarsText(minorNames: string[]): string {
  if (minorNames.length === 0) return ''
  const cfg = getPersonalityTriad().extra_stars_rules.丙丁级星曜集
  if (!cfg) return ''
  const parts: string[] = []
  for (const name of minorNames) {
    if (cfg[name]) parts.push(`${name}使其${cfg[name]}`)
  }
  return parts.length ? '此外' + parts.join('，') + '。' : ''
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
  const mainStars = palace.majorStars
  const primaryStar = mainStars[0]?.star ?? '无主星'
  // 主星显示：单星 "太阳"；双星 "武曲(旺)、贪狼(陷)"
  const mainStarDisplay = mainStars.length > 1
    ? mainStars.map(ms => `${ms.star}(${ms.brightness})`).join('、')
    : primaryStar
  const allMainStarNames = mainStars.map(ms => ms.star).join('、') || '无主星'

  // 以首颗主星确定宫位级属性（阴阳、亮度副词）
  const brightness = mainStars[0]?.brightness ?? palace.brightness ?? '平'
  const yinYang: '阳' | '阴' = isYangStar(primaryStar) ? '阳' : '阴'
  const strength = scoreStrength(score)
  const baseTrait = resolveBaseTrait(score, primaryStar)
  const adverb = getPersonalityTriad().brightness_adverbs[brightness] ?? '有时'
  const layerCfg = getPersonalityTriad().layers[layer]

  // 收集所有主星的赋性（双主星宫位两颗都取）
  const starTraits: string[] = []
  const positiveTraits: string[] = []
  const negativeTraits: string[] = []
  for (const { star } of mainStars) {
    const attr = getStarAttr(star as MajorStar)
    if (attr) {
      starTraits.push(attr.coreTrait)
      positiveTraits.push(firstSentence(attr.positiveTrait).replace(/。$/, ''))
      negativeTraits.push(firstSentence(attr.negativeTrait).replace(/。$/, ''))
    }
  }
  const starTrait = starTraits.join('；')
  const positiveTrait = positiveTraits.join('，')
  const negativeTrait = negativeTraits.join('，')

  // 吉煞 + 丙丁级 + 格局（从 palace.stars 全量取，无需改）
  const allStarNames = palace.stars.map(s => s.name)
  const jiSha = allStarNames.filter(n => JI_STARS.includes(n) || SHA_STARS.includes(n))
  const extra = extraStarsText(jiSha)
  const patternFx = patternEffectText(palaceScores[palaceIdx]?.patterns ?? [])
  const minorStarNames = filterMinorStars(allStarNames)
  const minorEffect = minorStarsText(minorStarNames)

  const template = layerCfg.analysis_template
  const description = template
    .replace('{main_star}', mainStarDisplay)
    .replace('{brightness}', brightness)
    .replace('{yin_yang}', yinYang)
    .replace('{score_strength}', strength)
    .replace('{base_trait}', baseTrait)
    .replace('{star_trait}', starTrait)
    .replace('{brightness_adverb}', adverb)
    .replace('{ bright_adverb }', adverb)
    .replace('{positive_trait}', positiveTrait)
    .replace('{negative_supplement}', negativeTrait)
    .replace('{extra_stars}', extra)
    .replace('{pattern_effect}', patternFx)
    .replace('{minor_star_effect}', minorEffect)

  return {
    layer,
    palace: palaceName,
    mainStar: allMainStarNames,
    brightness,
    yinYang,
    scoreStrength: strength,
    baseTrait,
    description,
    manifestationTiming: layerCfg.manifestation_timing,
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
