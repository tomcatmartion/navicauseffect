/**
 * 运限计算器
 *
 * 从 chartData 中提取出生信息，用 iztro 重建命盘并计算运限数据：
 * 大限（宫干、命宫、四化、年龄范围）、流年（天干地支、四化）、小限（宫位、虚岁）
 *
 * iztro HoroscopeItem 结构：
 * - index: 宫位索引
 * - name: 运限名称
 * - heavenlyStem / earthlyBranch: 天干地支
 * - palaceNames: 十二宫名数组（palaceNames[index] 即该运限命宫名）
 * - mutagen: 四化星数组 [化禄星, 化权星, 化科星, 化忌星]
 */

import 'server-only'

import { astro } from 'iztro'

// ── 类型定义 ────────────────────────────────────────────

interface BirthInfo {
  year: number
  month: number
  day: number
  /** iztro 时辰序号（0-12） */
  hour: number
  gender: string
  solar?: boolean
}

/** 统一的运限数据结构 */
export interface ScopeData {
  heavenlyStem: string
  earthlyBranch: string
  /** 该运限命宫名 */
  mingPalaceName: string
  palaceIndex: number
  /** 四化星 [化禄, 化权, 化科, 化忌] */
  mutagen: string[]
  /** 大限年龄范围（仅大限有值） */
  ageRange?: [number, number]
  /** 虚岁（仅小限有值） */
  nominalAge?: number
}

// ── 核心函数 ────────────────────────────────────────────

/**
 * 从 chartData 中安全提取出生信息
 */
function extractBirthInfo(chartData: Record<string, unknown>): BirthInfo | null {
  const birthInfo = chartData.birthInfo as Record<string, unknown> | undefined
  if (!birthInfo) return null

  const { year, month, day, hour, gender } = birthInfo
  if (
    typeof year !== 'number' || typeof month !== 'number' ||
    typeof day !== 'number' || typeof hour !== 'number' ||
    typeof gender !== 'string'
  ) {
    return null
  }

  return { year, month, day, hour, gender, solar: birthInfo.solar as boolean | undefined }
}

/**
 * 从 HoroscopeItem 提取运限数据
 */
function extractScopeData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
): ScopeData {
  const palaceNames: string[] = item.palaceNames ?? []
  const idx: number = typeof item.index === 'number' ? item.index : 0
  const mutagen: string[] = (item.mutagen ?? []).map(String)

  return {
    heavenlyStem: String(item.heavenlyStem ?? ''),
    earthlyBranch: String(item.earthlyBranch ?? ''),
    mingPalaceName: palaceNames[idx] ?? '',
    palaceIndex: idx,
    mutagen,
  }
}

/**
 * 用 iztro 重建命盘并计算指定年份的运限数据
 */
function computeHoroscope(birthInfo: BirthInfo, targetYear: number): {
  decadal: ScopeData
  yearly: ScopeData
  age: ScopeData
} | null {
  try {
    const genderStr = birthInfo.gender === 'MALE' || birthInfo.gender === '男' ? '男' : '女'
    const dateStr = `${birthInfo.year}-${String(birthInfo.month).padStart(2, '0')}-${String(birthInfo.day).padStart(2, '0')}`

    // 重建命盘
    const astrolabe = astro.bySolar(dateStr, birthInfo.hour, genderStr, true, 'zh-CN')

    // 构造目标日期（取年中 6月15日，避免边界问题）
    const targetDate = new Date(targetYear, 5, 15)
    const horoscope = astrolabe.horoscope(targetDate, birthInfo.hour)

    if (!horoscope) return null

    const decadalItem = horoscope.decadal
    const yearlyItem = horoscope.yearly
    const ageItem = horoscope.age

    if (!decadalItem || !yearlyItem || !ageItem) return null

    const decadal = extractScopeData(decadalItem)
    const yearly = extractScopeData(yearlyItem)
    const age = extractScopeData(ageItem)

    // 小限虚岁
    age.nominalAge = typeof ageItem.nominalAge === 'number' ? ageItem.nominalAge : 0

    // 大限年龄范围：从 iztro palace 的 decadal.ages 获取
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const palaces = (astrolabe as any).palaces as Array<Record<string, unknown>> | undefined
    if (palaces) {
      const decPalace = palaces[decadal.palaceIndex]
      if (decPalace) {
        const decData = decPalace.decadal as Record<string, unknown> | undefined
        if (decData?.range) {
          const range = decData.range as Array<unknown>
          if (range.length >= 2 && typeof range[0] === 'number' && typeof range[1] === 'number') {
            decadal.ageRange = [range[0], range[1]]
          }
        }
        // 备选：从 ages 字段获取
        if (!decadal.ageRange && decData?.ages) {
          const ages = decData.ages as number[]
          if (ages.length >= 2) {
            decadal.ageRange = [ages[0], ages[ages.length - 1]]
          }
        }
      }
    }

    // 如果仍无年龄范围，根据出生年份和大限位置估算
    if (!decadal.ageRange) {
      const currentAge = targetYear - birthInfo.year
      const decStart = Math.floor(currentAge / 10) * 10
      decadal.ageRange = [decStart, decStart + 9]
    }

    return { decadal, yearly, age }
  } catch (err) {
    console.error('[HoroscopeComputer] 计算运限失败:', err)
    return null
  }
}

/**
 * 将运限数据转换为 AI 可读的文字摘要
 */
function formatHoroscopeSummary(data: { decadal: ScopeData; yearly: ScopeData; age: ScopeData }, targetYear: number): string {
  const lines: string[] = []

  // 大限信息
  const d = data.decadal
  lines.push('### 大限信息')
  lines.push(`- 大限命宫：${d.mingPalaceName}（${d.heavenlyStem}${d.earthlyBranch}）`)
  if (d.ageRange && d.ageRange[0] > 0) {
    lines.push(`- 大限年龄：${d.ageRange[0]}~${d.ageRange[1]}岁`)
  }
  if (d.mutagen.length >= 4) {
    lines.push(`- 大限四化：${d.mutagen[0]}化禄、${d.mutagen[1]}化权、${d.mutagen[2]}化科、${d.mutagen[3]}化忌`)
  }

  // 流年信息
  const y = data.yearly
  lines.push('')
  lines.push(`### 流年信息（${targetYear}年）`)
  lines.push(`- 流年干支：${y.heavenlyStem}${y.earthlyBranch}`)
  lines.push(`- 流年命宫：${y.mingPalaceName}`)
  if (y.mutagen.length >= 4) {
    lines.push(`- 流年四化：${y.mutagen[0]}化禄、${y.mutagen[1]}化权、${y.mutagen[2]}化科、${y.mutagen[3]}化忌`)
  }

  // 小限信息
  const a = data.age
  lines.push('')
  lines.push('### 小限信息')
  if (a.nominalAge && a.nominalAge > 0) {
    lines.push(`- 虚岁：${a.nominalAge}`)
  }
  lines.push(`- 小限宫位：${a.mingPalaceName}（${a.heavenlyStem}${a.earthlyBranch}）`)

  return lines.join('\n')
}

// ── 导出接口 ────────────────────────────────────────────

/**
 * 计算指定年份的运限摘要文字
 *
 * @param chartData 命盘数据（须包含 birthInfo）
 * @param targetYear 目标年份
 * @returns 运限摘要文字，如果无法计算则返回 null
 */
export async function computeHoroscopeSummary(
  chartData: Record<string, unknown>,
  targetYear: number,
): Promise<string | null> {
  const birthInfo = extractBirthInfo(chartData)
  if (!birthInfo) {
    console.warn('[HoroscopeComputer] chartData 缺少 birthInfo，无法计算运限')
    return null
  }

  const horoscopeData = computeHoroscope(birthInfo, targetYear)
  if (!horoscopeData) {
    console.warn(`[HoroscopeComputer] 无法计算 ${targetYear} 年运限`)
    return null
  }

  return formatHoroscopeSummary(horoscopeData, targetYear)
}

/**
 * 计算指定年份的运限结构化数据（供 Skill Pipeline 构建 Prompt 使用）
 *
 * @param chartData 命盘数据（须包含 birthInfo）
 * @param targetYear 目标年份
 * @returns 运限结构化对象，如果无法计算则返回 null
 */
export async function computeHoroscopeData(
  chartData: Record<string, unknown>,
  targetYear: number,
): Promise<{ decadal: ScopeData; yearly: ScopeData; age: ScopeData } | null> {
  const birthInfo = extractBirthInfo(chartData)
  if (!birthInfo) {
    console.warn('[HoroscopeComputer] chartData 缺少 birthInfo，无法计算运限')
    return null
  }
  return computeHoroscope(birthInfo, targetYear)
}
