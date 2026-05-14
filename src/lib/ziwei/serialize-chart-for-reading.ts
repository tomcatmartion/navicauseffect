/**
 * 将 iztro FunctionalAstrolabe 序列化为 Hybrid / RAG 可读 JSON。
 * 须包含 adjectiveStars（红鸾、天喜等多在丙丁级），否则与 iztro 真盘不一致。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStar(s: any) {
  return {
    name: s.name ?? '',
    type: s.type ?? '',
    mutagen: s.mutagen ?? '',
    brightness: s.brightness ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPalace(p: any) {
  return {
    name: p.name ?? '',
    earthlyBranch: p.earthlyBranch ?? '',
    heavenlyStem: p.heavenlyStem ?? '',
    isBodyPalace: p.isBodyPalace ?? false,
    isOriginalPalace: p.isOriginalPalace ?? false,
    majorStars: (p.majorStars ?? []).map(mapStar),
    minorStars: (p.minorStars ?? []).map(mapStar),
    adjectiveStars: (p.adjectiveStars ?? []).map(mapStar),
  }
}

export interface BirthInfoForReading {
  year: number
  month: number
  day: number
  hour: number
  gender: string
  solar?: boolean
}

/**
 * @param astrolabe iztro 排盘结果
 * @param birthDataParam 出生信息（供运限等后端逻辑）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeAstrolabeForReading(astrolabe: any, birthDataParam?: BirthInfoForReading): Record<string, unknown> {
  if (!astrolabe) return {}

  const result: Record<string, unknown> = {
    name: astrolabe.name ?? '命主',
    gender: astrolabe.gender ?? 'male',
    soul: astrolabe.soul ?? '',
    body: astrolabe.body ?? '',
    fiveElementsClass: astrolabe.fiveElementsClass ?? '',
    solarDate: astrolabe.solarDate ?? '',
    lunarDate: astrolabe.lunarDate ?? '',
    chineseDate: astrolabe.chineseDate ?? '',
    earthlyBranchOfSoulPalace: astrolabe.earthlyBranchOfSoulPalace ?? '',
    earthlyBranchOfBodyPalace: astrolabe.earthlyBranchOfBodyPalace ?? '',
    palaces: (astrolabe.palaces ?? []).map(mapPalace),
  }

  // 传递 rawDates.chineseDate 供后端准确读取生年干支
  if (astrolabe.rawDates?.chineseDate) {
    result.rawDates = {
      chineseDate: astrolabe.rawDates.chineseDate,
    }
  }

  if (birthDataParam) {
    result.birthInfo = {
      year: birthDataParam.year,
      month: birthDataParam.month,
      day: birthDataParam.day,
      hour: birthDataParam.hour,
      gender: birthDataParam.gender === 'MALE' ? '男' : birthDataParam.gender,
      solar: birthDataParam.solar ?? true,
    }
  }

  return result
}
