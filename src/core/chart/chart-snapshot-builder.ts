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
import iztroPkg from 'iztro/package.json'
import { TIME_INDEX_TO_HOUR } from '@/lib/ziwei/time-index'
import {
  serializeAstrolabeForReading,
  serializeHoroscopeForReading,
} from '@/lib/ziwei/serialize-chart-for-reading'
import { MAJOR_CITIES, calculateTrueSolarTime } from '@/lib/solar-time'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import type { Stage1Output, Stage2Output } from '@/core/types'
import { buildChartSnapshotObject } from '@/core/llm-wrapper/prompt-builder'

// ════════════════════════════════════════════════════════════
// 常量
// ════════════════════════════════════════════════════════════

/**
 * Stage1/2 规则版本号
 *
 * 当 Stage1/2 的规则（格局库、宫位评分权重、四化逻辑、性格标签体系等）发生
 * breaking change 时，bump 此版本号。所有旧 snapshot 会在读取时被判为不兼容
 * → 自动重算并回写，保证同一命盘跨时间结果一致。
 */
export const STAGE_VERSION = 'v1'

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
  /** Stage1/2 规则版本（规则升级后失效旧 snapshot） */
  stageVersion: string
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
  stage1: Stage1Output
  /** Stage2 输出（性格三宫定性） */
  stage2: Stage2Output

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
export function getIztroVersion(): string {
  // 读 iztro fork 的 package.json version（build 时 inline）
  // fork 升级 version 时自动失效旧 snapshot，与 STAGE_VERSION 形成双重版本治理
  return `${iztroPkg.version}-fork`
}

// ════════════════════════════════════════════════════════════
// 主接口
// ════════════════════════════════════════════════════════════

/**
 * 组装 ChartSnapshot（内部共用）
 *
 * 从已序列化的 reading 出发，执行 stage1/2 + 提取 summary，组装完整 snapshot。
 * 被 buildChartSnapshot（排盘后调用）和 buildChartSnapshotFromReading（外部传入 reading）共用，
 * 保证两条路径产出的 stage1/2 + summary 完全一致。
 */
function assembleSnapshot(params: {
  reading: Record<string, unknown>
  gender: 'MALE' | 'FEMALE'
  year: number
  month: number
  day: number
  timeIndex: number
  solar: boolean
  longitude: number
  trueSolarTimeInfo: string
}): ChartSnapshot {
  const { reading, gender, year, month, day, timeIndex, solar, longitude, trueSolarTimeInfo } = params

  // Stage1/2 计算（宫位评分 + 性格定性）
  const stage1 = executeStage1({ chartData: reading })
  const stage2 = executeStage2({ stage1, question: '' })

  // 命盘摘要（用 buildChartSnapshotObject 提取关键字段）
  const chartSnapshot = buildChartSnapshotObject(reading, {
    birthGan: stage1.scoringCtx?.birthGan,
    taiSuiZhi: stage1.scoringCtx?.taiSuiZhi,
  })

  return {
    iztroVersion: getIztroVersion(),
    stageVersion: STAGE_VERSION,
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
 * 构建完整命盘快照（排盘 + 序列化 + stage1/2）
 *
 * 用法：
 *   const snapshot = buildChartSnapshot({ gender, birthday, birthCity, region })
 *   await prisma.chartRecord.create({ data: { chartSnapshot: snapshot, ... } })
 *
 * 流程：真太阳时校正 → iztro 排盘 → 序列化为 reading → 组装 snapshot
 */
export function buildChartSnapshot(input: ChartBirthInfo): ChartSnapshot {
  const { gender, birthday, birthCity, region, solar = true } = input

  // 1. 真太阳时校正 + 时辰索引
  const { timeIndex, year, month, day, longitude, trueHour, trueMinute } =
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
    // hour 写入 reading.birthInfo.hour，统一用 timeIndex（与 chart 页 serializeAstrolabeForReading 调用一致），
    // 保证 chartDataToBirthInfo 还原 birthday 时 TIME_INDEX_TO_HOUR 查找正确 → DB 指纹一致
    { year, month, day, hour: timeIndex, gender: genderName, solar, birthCity: input.birthCity ?? undefined },
    {
      horoscope: serializeHoroscopeForReading(horoscope, targetYear) as unknown as Record<string, unknown>,
      referenceYear: targetYear,
    },
  )

  // 3. 组装 snapshot（stage1/2 + summary）
  return assembleSnapshot({
    reading,
    gender, year, month, day, timeIndex, solar, longitude, trueSolarTimeInfo,
  })
}

/**
 * 从已序列化的 reading 构建 ChartSnapshot（跳过 iztro 排盘）
 *
 * 用于"保存命盘"场景：前端 chart 页已排盘并序列化 chartData
 * （serializeAstrolabeForReading 输出，已含 horoscope 序列化数据），
 * 直接复用其作为 reading，避免服务端重复排盘导致与用户所见数据漂移。
 *
 * 与 buildChartSnapshot 的区别：
 *   - 跳过 astro.bySolar + serializeAstrolabeForReading（省 ~50ms 排盘 + 避免数据漂移）
 *   - stage1/2 仍会基于 reading 计算（snapshot 需持久化完整 stage1/2）
 *   - 产出与 buildChartSnapshot（同 birthInfo）的 stage1/2 deep equal（共用 assembleSnapshot）
 */
export function buildChartSnapshotFromReading(input: {
  chartData: Record<string, unknown>
  birthInfo: ChartBirthInfo
}): ChartSnapshot {
  const { chartData, birthInfo } = input
  const { gender, birthday, birthCity, region, solar = true } = birthInfo

  // 真太阳时校正信息（用于 birthInfo 展示 + fingerprint，不重新排盘）
  const { timeIndex, year, month, day, longitude, trueHour, trueMinute } =
    resolveTimeIndex(birthday, birthCity, region)
  const trueSolarTimeInfo = `真太阳时校正：${trueHour}:${String(trueMinute).padStart(2, '0')}（经度${longitude}°）`

  // 直接用前端传来的 chartData 作为 reading，组装 snapshot
  return assembleSnapshot({
    reading: chartData,
    gender, year, month, day, timeIndex, solar, longitude, trueSolarTimeInfo,
  })
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

// TIME_INDEX_TO_HOUR 定义在 @/lib/ziwei/time-index（与 SaveChartButton 共用，保证指纹一致）

/**
 * 从 chartData（serializeAstrolabeForReading 输出）提取 ChartBirthInfo
 *
 * 用于 orchestrator 等"持 chartData 想查 DB 持久缓存"的场景：
 *   chartData → ChartBirthInfo → computeChartFingerprint → 查 ChartRecord
 *
 * 字段不全时返回 null，调用方应降级到 Redis/重算（不影响主流程）。
 *
 * 注意：gender 兼容 'male'/'男'/'MALE' 三种来源；birthday 用 TIME_INDEX_TO_HOUR
 *       映射出"YYYY-MM-DD HH:00"，与 SaveChartButton 保持一致。
 */
export function chartDataToBirthInfo(chartData: Record<string, unknown>): ChartBirthInfo | null {
  const birthInfoObj = chartData.birthInfo as Record<string, unknown> | undefined

  // ── timeIndex 解析 ──
  // 关键：serializeAstrolabeForReading 把 birthDataParam.hour（= iztro timeIndex）原样写入 birthInfo.hour
  // 优先级：chartData.timeIndex > birthInfo.timeIndex > birthInfo.hour（实际写入位置）> 0
  const timeIndex = typeof chartData.timeIndex === 'number'
    ? chartData.timeIndex
    : typeof birthInfoObj?.timeIndex === 'number'
      ? birthInfoObj.timeIndex
      : typeof birthInfoObj?.hour === 'number'
        ? birthInfoObj.hour
        : 0
  const hour = TIME_INDEX_TO_HOUR[timeIndex] ?? 12

  // ── birthday 构造（必须与 SaveChartButton 的 birthdayStr 完全一致：YYYY-MM-DD HH:00，补零）──
  // 优先用 birthInfo.year/month/day（数字，可标准化补零），降级到 chartData.solarDate（格式不可控）
  const year = birthInfoObj?.year
  const month = birthInfoObj?.month
  const day = birthInfoObj?.day
  let birthday: string
  if (typeof year === 'number' && typeof month === 'number' && typeof day === 'number') {
    birthday = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00`
  } else {
    const solarDate = typeof birthInfoObj?.solarDate === 'string'
      ? birthInfoObj.solarDate
      : typeof chartData.solarDate === 'string'
        ? chartData.solarDate
        : ''
    if (!solarDate) return null
    birthday = `${solarDate} ${String(hour).padStart(2, '0')}:00`
  }

  // gender：兼容 'male'/'男'/'MALE'
  const genderRaw = chartData.gender ?? birthInfoObj?.gender
  const gender: 'MALE' | 'FEMALE' =
    genderRaw === 'male' || genderRaw === '男' || genderRaw === 'MALE' ? 'MALE' : 'FEMALE'

  // ── birthCity / region ──
  // 缺失用 ''（与保存路径 computeChartFingerprint 的 `?? ''` 一致，保证指纹相同）
  const birthCity = typeof birthInfoObj?.birthCity === 'string'
    ? birthInfoObj.birthCity
    : typeof chartData.birthCity === 'string'
      ? chartData.birthCity
      : ''
  const region = typeof birthInfoObj?.region === 'string' ? birthInfoObj.region : birthCity

  return { gender, birthday, birthCity, region }
}

/**
 * 校验 snapshot 是否兼容当前 iztro 版本
 *
 * 不兼容时调用方应 fallback 到 buildChartSnapshot 重新计算
 */
export function isSnapshotCompatible(snapshot: ChartSnapshot): boolean {
  if (!snapshot?.iztroVersion || snapshot.iztroVersion === 'unknown') return false
  if (!snapshot.reading || !snapshot.stage1 || !snapshot.stage2) return false
  if (snapshot.iztroVersion !== getIztroVersion()) return false
  // stageVersion 缺失（旧 snapshot）或与当前版本不符 → 视为不兼容，触发重算回写
  if (snapshot.stageVersion !== STAGE_VERSION) return false
  return true
}
