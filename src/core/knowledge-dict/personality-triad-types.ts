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
    analysis_template: string
  }>
  brightness_adverbs: Record<string, string>
  extra_stars_rules: {
    吉星集: Record<string, string>
    煞星集: Record<string, string>
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
}

export interface PersonalityTriadProfile {
  version: string
  mingLayer: PersonalityLayerProfile
  shenLayer: PersonalityLayerProfile
  taiSuiLayer: PersonalityLayerProfile
  synthesis: string
}
