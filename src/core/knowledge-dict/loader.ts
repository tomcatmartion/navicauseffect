/**
 * M6: 知识字典 — JSON 加载与热加载
 *
 * 职责：从 data/ 目录加载 JSON 知识库文件，支持热加载
 * 所有知识库数据从此处统一加载，禁止硬编码
 */

import fs from 'fs'
import path from 'path'
import type {
  StarAttribute,
  PalaceMeaning,
  TaiSuiTables,
  EventStarAttributes,
  ScoringParams,
  PalaceSystem,
} from './types'
import type { LimitDirectionConfig } from './limit-direction-types'
import type { PersonalityTriadConfig } from './personality-triad-types'

// ═══════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════

const DATA_DIR = path.join(process.cwd(), 'data')

const STAR_SYSTEM_PATH = path.join(DATA_DIR, 'star_system.json')
const PALACE_SYSTEM_PATH = path.join(DATA_DIR, 'palace_system.json')
const EVENT_DESCRIPTIONS_PATH = path.join(DATA_DIR, 'event_descriptions.json')
const TAI_SUI_TABLES_PATH = path.join(DATA_DIR, 'tai_sui_rua_gua_tables.json')
const SCORING_PATH = path.join(DATA_DIR, 'scoring.json')
const ROUTER_PATH = path.join(DATA_DIR, 'router.json')
const ROUTING_LEGACY_PATH = path.join(DATA_DIR, 'routing.json')
const PATTERN_LIBRARY_PATH = path.join(DATA_DIR, 'pattern_library.json')
const INTERACTION_RULES_PATH = path.join(DATA_DIR, 'interaction_rules.json')
const LIMIT_DIRECTION_PATH = path.join(DATA_DIR, 'limit_direction.json')
const PERSONALITY_TRIAD_PATH = path.join(DATA_DIR, 'personality_triad.json')
const SIHUA_TRIGGER_RULES_PATH = path.join(DATA_DIR, 'sihua_trigger_rules.json')

// ═══════════════════════════════════════════════════════════════════
// 缓存与修改时间追踪
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T | null
  mtime: number
}

const starSystemCache: CacheEntry<Record<string, StarAttribute>> = { data: null, mtime: 0 }
const palaceSystemCache: CacheEntry<PalaceSystem> = { data: null, mtime: 0 }
const eventDescriptionsCache: CacheEntry<EventStarAttributes> = { data: null, mtime: 0 }
const taiSuiTablesCache: CacheEntry<TaiSuiTables> = { data: null, mtime: 0 }
const scoringCache: CacheEntry<ScoringParams> = { data: null, mtime: 0 }
const routingCache: CacheEntry<Record<string, unknown>> = { data: null, mtime: 0 }
const patternLibraryCache: CacheEntry<Record<string, unknown>> = { data: null, mtime: 0 }
const interactionRulesCache: CacheEntry<Record<string, unknown>> = { data: null, mtime: 0 }
const limitDirectionCache: CacheEntry<LimitDirectionConfig> = { data: null, mtime: 0 }
const personalityTriadCache: CacheEntry<PersonalityTriadConfig> = { data: null, mtime: 0 }
const sihuaTriggerRulesCache: CacheEntry<Record<string, unknown>> = { data: null, mtime: 0 }

// ═══════════════════════════════════════════════════════════════════
// 核心加载函数
// ═══════════════════════════════════════════════════════════════════

/** 各配置文件的类型安全默认空对象 */
const DEFAULTS: Record<string, unknown> = {
  [STAR_SYSTEM_PATH]: { stars: {} },
  [PALACE_SYSTEM_PATH]: { version: '1.0', description: '', '宫位含义': {}, '宫位骨架亮度映射': {} },
  [EVENT_DESCRIPTIONS_PATH]: {},
  [TAI_SUI_TABLES_PATH]: { shengNianSihua: {}, luCunYangTuo: {}, tianKuiYue: {}, hongLuanTianXi: {}, wuHuDunGan: {} },
  [SCORING_PATH]: {
    brightnessMap: {},
    initialBaseByBrightness: {},
    ceilingByBrightness: {},
    subdueLevel: { strong: [], medium: [], weak: [] },
    parentSihuaDiscount: 0,
    jiStarScore: 0.5,
    shaStarScore: -0.5,
    recordOnlySihua: [],
    jiStarNames: [],
    shaStarNames: [],
    patternMultiplierMap: {},
    patternScopeDescription: {},
    dunGanLuBonus: 0,
    dunGanJiPenalty: 0,
    dunGanDecay: 0,
    warmCoolThresholds: {},
    toneThresholds: {},
    criticalThresholds: {},
    absoluteFailRules: {},
    parentPenalty: { fatherShengNianJi: 0, fatherDunGanJi: 0, motherShengNianJi: 0, motherDunGanJi: 0 },
    sihuaSourcesPriority: { description: '', sources: [], rule: '' },
    jiagongValidPairs: { description: '', pairs: [] },
    jiagongInvalidConditions: { description: '', conditions: [] },
    jiagongDecayMatrix: {},
    fixedDecay: { opposite: 0.8, trine: 0.7 },
    luCunDelta: { '旺': 0.5, '平': 0.3, '陷': 0.1 },
  },
  [ROUTER_PATH]: { branches: {}, intentDetection: [] },
  [ROUTING_LEGACY_PATH]: { branches: {}, intentDetection: [] },
  [PATTERN_LIBRARY_PATH]: {},
  [INTERACTION_RULES_PATH]: {},
  [LIMIT_DIRECTION_PATH]: {},
  [PERSONALITY_TRIAD_PATH]: { version: '1.0', star_yin_yang: { 阳星: [], 阴星: [] }, brightness_levels: {}, score_to_strength: {}, temperament_base: { rules: [] }, layers: {}, brightness_adverbs: {}, extra_stars_rules: { 吉星集: {}, 煞星集: {}, 丙丁级星曜集: {} }, pattern_effect: {}, synthesis_priority: { template: '' } },
  [SIHUA_TRIGGER_RULES_PATH]: { version: '1.0', rules: {} },
}

function loadJsonFile<T>(filePath: string, cache: CacheEntry<T>): T {
  try {
    const stat = fs.statSync(filePath)
    const currentMtime = stat.mtimeMs

    if (currentMtime !== cache.mtime || cache.data === null) {
      const content = fs.readFileSync(filePath, 'utf-8')
      cache.data = JSON.parse(content) as T
      cache.mtime = currentMtime
    }
  } catch (err) {
    console.error(`[knowledge-dict] Failed to load ${path.basename(filePath)}:`, err)
    if (!cache.data) {
      // 使用类型安全的默认空对象，避免运行时属性访问错误
      cache.data = (DEFAULTS[filePath] ?? {}) as T
    }
  }
  return cache.data!
}

// ═══════════════════════════════════════════════════════════════════
// 对外 API
// ═══════════════════════════════════════════════════════════════════

/** 获取星曜系统数据（自动热加载） */
export function getStarAttributes(): Record<string, StarAttribute> {
  const raw = loadJsonFile<Record<string, unknown>>(STAR_SYSTEM_PATH, starSystemCache)
  const stars = (raw?.stars ?? raw ?? {}) as Record<string, unknown>
  const result: Record<string, StarAttribute> = {}
  for (const [name, entry] of Object.entries(stars)) {
    if (entry && typeof entry === 'object' && '赋性' in entry) {
      result[name] = (entry as Record<string, unknown>).赋性 as StarAttribute
    }
  }
  return result
}

/** 获取宫位含义数据（自动热加载） */
export function getPalaceMeanings(): Record<string, PalaceMeaning> {
  const system = loadJsonFile<PalaceSystem>(PALACE_SYSTEM_PATH, palaceSystemCache)
  return system?.['宫位含义'] || {}
}

/** 获取太岁入卦查表数据（自动热加载） */
export function getTaiSuiTables(): TaiSuiTables {
  return loadJsonFile(TAI_SUI_TABLES_PATH, taiSuiTablesCache)
}

/** 获取事件描述数据（自动热加载） */
export function getEventStarAttributes(): EventStarAttributes {
  return loadJsonFile(EVENT_DESCRIPTIONS_PATH, eventDescriptionsCache)
}

/** 获取评分配置数据（自动热加载） — 唯一评分配置源 */
export function getScoringParams(): ScoringParams {
  const raw = loadJsonFile<ScoringParams>(SCORING_PATH, scoringCache)
  if (raw && typeof raw === 'object' && 'params' in raw) {
    return (raw as Record<string, unknown>).params as ScoringParams
  }
  return raw ?? {} as ScoringParams
}

/** 获取事项路由配置（自动热加载，优先 data/router.json） */
export function getRouterTree(): Record<string, unknown> {
  const target = fs.existsSync(ROUTER_PATH) ? ROUTER_PATH : ROUTING_LEGACY_PATH
  return loadJsonFile(target, routingCache)
}

/** 获取格局库配置（自动热加载） */
export function getPatternConfig(): Record<string, unknown> {
  return loadJsonFile(PATTERN_LIBRARY_PATH, patternLibraryCache)
}

/** 格局定义项（来自 pattern_library.json patterns 数组） */
export interface PatternDefinition {
  id: string
  level: string
  stage: string
  scope: string
  multiplier: number
  category: string
  description?: string
  trigger?: string
  condition?: unknown
}

/** 按格局名称查找定义 */
export function getPatternDefinition(name: string): PatternDefinition | undefined {
  const config = loadJsonFile<Record<string, unknown>>(PATTERN_LIBRARY_PATH, patternLibraryCache)
  const patterns = (config?.patterns ?? []) as PatternDefinition[]
  return patterns.find(p => p.id === name)
}

/** 按格局级别获取倍率 */
export function getPatternMultiplierByLevel(level: string): number {
  const config = loadJsonFile<Record<string, unknown>>(PATTERN_LIBRARY_PATH, patternLibraryCache)
  const multipliers = (config?.multipliers ?? {}) as Record<string, number>
  return multipliers[level] ?? 1.0
}

/** 获取互动规则配置（自动热加载） */
export function getInteractionQuXiang(): Record<string, unknown> {
  return loadJsonFile(INTERACTION_RULES_PATH, interactionRulesCache)
}

/** 获取大限流年方向配置（自动热加载） */
export function getLimitDirection(): LimitDirectionConfig {
  return loadJsonFile(LIMIT_DIRECTION_PATH, limitDirectionCache)
}

/** 获取命身太岁性格三宫配置（自动热加载） */
export function getPersonalityTriad(): PersonalityTriadConfig {
  return loadJsonFile(PERSONALITY_TRIAD_PATH, personalityTriadCache)
}

/** 获取三代四化引动规则（自动热加载） */
export function getSihuaTriggerRules(): Record<string, unknown> {
  return loadJsonFile(SIHUA_TRIGGER_RULES_PATH, sihuaTriggerRulesCache)
}

/** 获取宫位系统数据（自动热加载） */
export function getPalaceSystem(): PalaceSystem {
  return loadJsonFile(PALACE_SYSTEM_PATH, palaceSystemCache)
}

/** 获取宫位骨架映射表（自动热加载） */
export function getPalaceInnateSkeleton(): Record<string, Record<string, { major: string; brightness: string }>> {
  const system = loadJsonFile<PalaceSystem>(PALACE_SYSTEM_PATH, palaceSystemCache)
  return system?.['宫位骨架亮度映射'] || {}
}

/** 手动重新加载所有知识库 */
export function reloadAll() {
  starSystemCache.mtime = 0
  palaceSystemCache.mtime = 0
  eventDescriptionsCache.mtime = 0
  taiSuiTablesCache.mtime = 0
  scoringCache.mtime = 0
  routingCache.mtime = 0
  patternLibraryCache.mtime = 0
  interactionRulesCache.mtime = 0
  limitDirectionCache.mtime = 0
  personalityTriadCache.mtime = 0
  sihuaTriggerRulesCache.mtime = 0
  getStarAttributes()
  getPalaceMeanings()
  getEventStarAttributes()
  getTaiSuiTables()
  getScoringParams()
  getRouterTree()
  getPatternConfig()
  getInteractionQuXiang()
  getLimitDirection()
  getPersonalityTriad()
  getSihuaTriggerRules()
  getPalaceInnateSkeleton()
}
