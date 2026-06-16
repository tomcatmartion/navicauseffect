/**
 * 命盘快照构建器 —— 排盘 + 序列化 + Stage1/2 计算
 *
 * 复用 report-pipeline 的排盘逻辑（真太阳时校正 + iztro + 序列化），
 * 输出可持久化的 ChartSnapshot（体积约 30KB），用于：
 *   - ChartRecord.chartSnapshot 字段持久化
 *   - AI 对话直接调出（无需重排盘）
 *   - 报告生成复用 stage1/2（性能优化）
 *   - 合盘分析（双方完整命盘）
 *
 * 设计要点：
 *   - 只存"序列化数据"（reading JSON + stage1/2），不存 iztro 类实例（无法 JSON.stringify）
 *   - 前端 Iztrolabe 渲染时通过 birthInfo 重新调 astro.bySolar 重建（~50ms 纯计算）
 *   - snapshot 存 iztroVersion，加载时校验，不匹配则 fallback 重算
 */
import { createHash } from 'node:crypto'
import { astro } from 'iztro'
import {
  serializeAstrolabeForReading,
  serializeHoroscopeForReading,
} from '@/lib/ziwei/serialize-chart-for-reading'
import { MAJOR_CITIES, calculateTrueSolarTime } from '@/lib/solar-time'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { buildChartSnapshotObject } from '@/core/llm-wrapper/prompt-builder'

// ════════════════════════════════════════════════════════════
// 类型
// ════════════════════════════════════════════════════════════

export interface ChartBirthInfo {
  gender: 'MALE' | 'FEMALE'
  /** 阳历生日字符串 "YYYY-MM-DD HH:mm" */
  birthday: string
  birthCity?: string | null
  region?: string | null
  /** 阳历 true / 阴历 false（默认 true） */
  solar?: boolean
  /** 闰月（仅阴历） */
  isLeapMonth?: boolean
}

export interface ChartSnapshot {
  /** iztro 版本（用于兼容性校验） */
  iztroVersion: string
  /** 计算时间戳 ISO */
  computedAt: string

  /** 出生信息（前端 Iztrolabe 重建 astrolabe 用） */
  birthInfo: {
    gender: 'MALE' | 'FEMALE'
    year: number
    month: number
    day: number
    /** 时辰索引 0-12（子时早=0...子时晚=12） */
    hour: number
    solar: boolean
    /** 真太阳时校正说明文本 */
    trueSolarTimeInfo?: string
    /** 经度（真太阳时校正用） */
    longitude?: number
  }

  /** 序列化命盘数据（serializeAstrolabeForReading 输出，用于 stage1/2/3 计算） */
  reading: Record<string, unknown>

  /** Stage1 输出（宫位评分/格局/四化） */
  stage1: unknown
  /** Stage2 输出（性格三宫定性） */
  stage2: unknown

  /** 命盘摘要（冗余，便于列表展示与指纹） */
  summary: {
    solarDate: string
    lunarDate: string
    mingGongMajorStars: string[]
    shenGongName: string
    birthGanZhi: string
    zodiac: string
    fiveElementsClass: string
  }
}

// ════════════════════════════════════════════════════════════
// 内部工具
// ════════════════════════════════════════════════════════════

function parseBirthday(birthday: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const m = birthday.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/)
  if (!m) throw new Error(`无法解析出生时间：${birthday}`)
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] }
}

function resolveLongitude(birthCity?: string | null, region?: string | null): number {
  const place = birthCity || region || ''
  const hit = MAJOR_CITIES.find(c => place.includes(c.name))
  return hit?.longitude ?? 120
}

function resolveTimeIndex(
  birthday: string,
  birthCity?: string | null,
  region?: string | null,
): { timeIndex: number; year: number; month: number; day: number; hour: number; longitude: number; trueHour: number; trueMinute: number } {
  const { year, month, day, hour, minute } = parseBirthday(birthday)
  const longitude = resolveLongitude(birthCity, region)
  const date = new Date(year, month - 1, day)
  const result = calculateTrueSolarTime(date, hour, minute, longitude)
  return {
    timeIndex: result.timeIndex,
    year, month, day, hour,
    longitude,
    trueHour: result.hour,
    trueMinute: result.minute,
  }
}

/**
 * 获取 iztro 版本号（用于 snapshot 兼容性校验）
 * iztro 是 fork file:./packages/iztro，读 package.json version
 */
function getIztroVersion(): string {
  try {
    // 运行时取 iztro 包版本；失败则用 'unknown'
    // 避免在 build 阶段引入 fs 读 package.json，简化处理
    return '2.5.8-fork'
  } catch {
    return 'unknown'
  }
}

// ════════════════════════════════════════════════════════════
// 主接口
// ════════════════════════════════════════════════════════════

/**
 * 构建完整命盘快照（排盘 + 序列化 + stage1/2）
 *
 * 用法：
 *   const snapshot = await buildChartSnapshot({ gender, birthday, birthCity, region })
 *   await prisma.chartRecord.create({ data: { chartSnapshot: snapshot, ... } })
 */
export function buildChartSnapshot(input: ChartBirthInfo): ChartSnapshot {
  const { gender, birthday, birthCity, region, solar = true } = input

  // 1. 真太阳时校正 + 时辰索引
  const { timeIndex, year, month, day, hour, longitude, trueHour, trueMinute } =
    resolveTimeIndex(birthday, birthCity, region)
  const trueSolarTimeInfo = `真太阳时校正：${trueHour}:${String(trueMinute).padStart(2, '0')}（经度${longitude}°）`

  // 2. 排盘 + 序列化（复用 report-pipeline 同源逻辑）
  const genderName = gender === 'MALE' ? '男' : '女'
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const targetYear = new Date().getFullYear()
  const astrolabe = astro.bySolar(dateStr, timeIndex, genderName as '男' | '女', true)
  const horoscope = astrolabe.horoscope(new Date(targetYear, month - 1, day), timeIndex)
  const reading = serializeAstrolabeForReading(
    astrolabe as unknown as Record<string, unknown>,
    { year, month, day, hour, gender: genderName, solar },
    {
      horoscope: serializeHoroscopeForReading(horoscope, targetYear) as unknown as Record<string, unknown>,
      referenceYear: targetYear,
    },
  )

  // 3. Stage1/2 计算（前置宫位评分 + 性格定性）
  const stage1 = executeStage1({ chartData: reading })
  const stage2 = executeStage2({ stage1, question: '' })

  // 4. 命盘摘要（用 buildChartSnapshotObject 提取关键字段）
  const chartSnapshot = buildChartSnapshotObject(reading, {
    birthGan: stage1.scoringCtx?.birthGan,
    taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
  })

  return {
    iztroVersion: getIztroVersion(),
    computedAt: new Date().toISOString(),
    birthInfo: {
      gender,
      year, month, day, hour: timeIndex,
      solar,
      trueSolarTimeInfo,
      longitude,
    },
    reading,
    stage1,
    stage2,
    summary: {
      solarDate: chartSnapshot.solarDate,
      lunarDate: chartSnapshot.lunarDate,
      mingGongMajorStars: chartSnapshot.mingGong.majorStars,
      shenGongName: chartSnapshot.shenGong.name,
      birthGanZhi: chartSnapshot.birthGanZhi,
      zodiac: chartSnapshot.zodiac,
      fiveElementsClass: chartSnapshot.fiveElementsClass,
    },
  }
}

/**
 * 计算命盘指纹（sha256）
 *
 * 同一出生信息（生日+城市+性别）→ 同一指纹，用于去重和合盘匹配
 */
export function computeChartFingerprint(input: ChartBirthInfo): string {
  const raw = [
    input.birthday.trim(),
    (input.birthCity ?? '').trim(),
    (input.region ?? '').trim(),
    input.gender,
  ].join('|')
  return createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32)
}

/**
 * 校验 snapshot 是否兼容当前 iztro 版本
 *
 * 不兼容时调用方应 fallback 到 buildChartSnapshot 重新计算
 */
export function isSnapshotCompatible(snapshot: ChartSnapshot): boolean {
  if (!snapshot?.iztroVersion || snapshot.iztroVersion === 'unknown') return false
  if (!snapshot.reading || !snapshot.stage1 || !snapshot.stage2) return false
  return snapshot.iztroVersion === getIztroVersion()
}
