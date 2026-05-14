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
  AstroRules,
  EventStarAttributes,
} from './types'

// ═══════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════

const DATA_DIR = path.join(process.cwd(), 'data')

const STAR_ATTR_PATH = path.join(DATA_DIR, 'star_attributes.json')
const PALACE_MEANING_PATH = path.join(DATA_DIR, 'palace_meanings.json')
const EVENT_STAR_ATTR_PATH = path.join(DATA_DIR, 'event_star_attributes.json')
const TAI_SUI_TABLES_PATH = path.join(DATA_DIR, 'tai_sui_rua_gua_tables.json')
const ASTRO_RULES_PATH = path.join(DATA_DIR, 'astro_rules.json')

// ═══════════════════════════════════════════════════════════════════
// 缓存与修改时间追踪
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T | null
  mtime: number
}

const starAttrCache: CacheEntry<Record<string, StarAttribute>> = { data: null, mtime: 0 }
const palaceMeaningCache: CacheEntry<Record<string, PalaceMeaning>> = { data: null, mtime: 0 }
const eventStarAttrCache: CacheEntry<EventStarAttributes> = { data: null, mtime: 0 }
const taiSuiTablesCache: CacheEntry<TaiSuiTables> = { data: null, mtime: 0 }
const astroRulesCache: CacheEntry<AstroRules> = { data: null, mtime: 0 }

// ═══════════════════════════════════════════════════════════════════
// 核心加载函数
// ═══════════════════════════════════════════════════════════════════

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
      cache.data = {} as T
    }
  }
  return cache.data!
}

// ═══════════════════════════════════════════════════════════════════
// 对外 API
// ═══════════════════════════════════════════════════════════════════

/** 获取星曜赋性数据（自动热加载） */
export function getStarAttributes(): Record<string, StarAttribute> {
  return loadJsonFile(STAR_ATTR_PATH, starAttrCache)
}

/** 获取宫位含义数据（自动热加载） */
export function getPalaceMeanings(): Record<string, PalaceMeaning> {
  return loadJsonFile(PALACE_MEANING_PATH, palaceMeaningCache)
}

/** 获取太岁入卦查表数据（自动热加载） */
export function getTaiSuiTables(): TaiSuiTables {
  return loadJsonFile(TAI_SUI_TABLES_PATH, taiSuiTablesCache)
}

/** 获取事项分类赋性数据（自动热加载） */
export function getEventStarAttributes(): EventStarAttributes {
  return loadJsonFile(EVENT_STAR_ATTR_PATH, eventStarAttrCache)
}

/** 获取天文规则数据（自动热加载） */
export function getAstroRules(): AstroRules {
  return loadJsonFile(ASTRO_RULES_PATH, astroRulesCache)
}

/** 手动重新加载所有知识库 */
export function reloadAll() {
  starAttrCache.mtime = 0
  palaceMeaningCache.mtime = 0
  eventStarAttrCache.mtime = 0
  taiSuiTablesCache.mtime = 0
  astroRulesCache.mtime = 0
  getStarAttributes()
  getPalaceMeanings()
  getEventStarAttributes()
  getTaiSuiTables()
  getAstroRules()
}
