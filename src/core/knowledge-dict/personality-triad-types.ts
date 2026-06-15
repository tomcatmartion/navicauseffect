/**
 * personality_triad.json 类型定义
 */

import type { PalaceName } from '@/core/types'

export type TriadLayerName = '命宫' | '身宫' | '太岁宫'

export interface PersonalityTriadConfig {
  version: string
  star_yin_yang: { 阳星: string[]; 阴星: string[] }
  brightness_levels: Record<string, string>
  score_to_strength: {
    strong: { range: [number, number]; level: string }
    medium: { range: [number, number]; level: string }
    weak: { range: [number, number]; level: string }
  }
  temperament_base: {
    rules: Array<{ condition: string; base_trait: string }>
  }
  layers: Record<TriadLayerName, {
    description: string
    key_words: string[]
    /** 显现时机：告诉用户该层特质何时显现 */
    manifestation_timing: string
    /** 给 LLM 的提示：如何描述显现时机 */
    manifestation_hint: string
    analysis_template: string
  }>
  brightness_adverbs: Record<string, string>
  extra_stars_rules: {
    吉星集: Record<string, string>
    煞星集: Record<string, string>
    /** 丙丁级星曜对性格的修饰 */
    丙丁级星曜集: Record<string, string>
  }
  pattern_effect: Record<string, string>
  synthesis_priority: { template: string }
}

export interface PersonalityLayerProfile {
  layer: TriadLayerName
  palace: PalaceName
  mainStar: string
  brightness: string
  yinYang: '阳' | '阴'
  scoreStrength: string
  baseTrait: string
  description: string
  /** 显现时机：该层特质何时显现（如"终身显现""第三大限后逐渐明显"） */
  manifestationTiming: string
}

export interface PersonalityTriadProfile {
  version: string
  mingLayer: PersonalityLayerProfile
  shenLayer: PersonalityLayerProfile
  taiSuiLayer: PersonalityLayerProfile
  synthesis: string
}
