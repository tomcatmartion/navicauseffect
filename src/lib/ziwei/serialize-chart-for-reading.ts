/**
 * 将 iztro FunctionalAstrolabe 序列化为 Hybrid 管线可读 JSON。
 * 须包含 adjectiveStars（红鸾、天喜等多在丙丁级），否则与 iztro 真盘不一致。
 */

// ── 本地类型定义（基于 iztro 实际结构，避免 any） ──────────────────────

interface IztroStar {
  name?: string
  type?: string
  mutagen?: string
  brightness?: string | number
}

interface IztroDecadal {
  range?: [number, number]
  heavenlyStem?: string
  earthlyBranch?: string
}

interface IztroPalace {
  name?: string
  earthlyBranch?: string
  heavenlyStem?: string
  isBodyPalace?: boolean
  isOriginalPalace?: boolean
  majorStars?: IztroStar[]
  minorStars?: IztroStar[]
  adjectiveStars?: IztroStar[]
  decadal?: IztroDecadal
  ages?: number[]
}

interface IztroHoroscopeItem {
  index?: number
  name?: string
  heavenlyStem?: string
  earthlyBranch?: string
  palaceNames?: string[]
  mutagen?: string[]
  nominalAge?: number
}

interface IztroHoroscope {
  decadal?: IztroHoroscopeItem
  yearly?: IztroHoroscopeItem
  age?: IztroHoroscopeItem
  monthly?: IztroHoroscopeItem
  daily?: IztroHoroscopeItem
}

interface IztroAstrolabe {
  name?: string
  gender?: string
  soul?: string
  body?: string
  fiveElementsClass?: string
  solarDate?: string
  lunarDate?: string
  chineseDate?: string
  earthlyBranchOfSoulPalace?: string
  earthlyBranchOfBodyPalace?: string
  /** 生肖（iztro 直接计算，可用于确定太岁宫地支） */
  zodiac?: string
  palaces?: IztroPalace[]
  rawDates?: { chineseDate?: string }
  toJSON?: () => Record<string, unknown>
}

// ── 序列化输出类型 ───────────────────────────────────────────────────

interface SerializedStar {
  name: string
  type: string
  mutagen: string
  brightness: string
}

interface SerializedPalace {
  name: string
  earthlyBranch: string
  heavenlyStem: string
  isBodyPalace: boolean
  isOriginalPalace: boolean
  majorStars: SerializedStar[]
  minorStars: SerializedStar[]
  adjectiveStars: SerializedStar[]
  decadal?: {
    range: [number, number]
    heavenlyStem: string
    earthlyBranch: string
  }
  ages?: number[]
}

interface SerializedHoroscopeScope {
  index: number
  name: string
  heavenlyStem: string
  earthlyBranch: string
  palaceNames: string[]
  mutagen: string[]
}

// ── 序列化函数 ───────────────────────────────────────────────────────

function mapStar(s: IztroStar | undefined): SerializedStar {
  if (!s) return { name: '', type: '', mutagen: '', brightness: '' }
  return {
    name: s.name ?? '',
    type: s.type ?? '',
    mutagen: s.mutagen ?? '',
    brightness: String(s.brightness ?? ''),
  }
}

function mapPalace(p: IztroPalace | undefined): SerializedPalace {
  if (!p) {
    return {
      name: '',
      earthlyBranch: '',
      heavenlyStem: '',
      isBodyPalace: false,
      isOriginalPalace: false,
      majorStars: [],
      minorStars: [],
      adjectiveStars: [],
    }
  }
  const palace: SerializedPalace = {
    name: p.name ?? '',
    earthlyBranch: p.earthlyBranch ?? '',
    heavenlyStem: p.heavenlyStem ?? '',
    isBodyPalace: p.isBodyPalace ?? false,
    isOriginalPalace: p.isOriginalPalace ?? false,
    majorStars: (p.majorStars ?? []).map(mapStar),
    minorStars: (p.minorStars ?? []).map(mapStar),
    adjectiveStars: (p.adjectiveStars ?? []).map(mapStar),
  }
  if (p.decadal) {
    palace.decadal = {
      range: p.decadal.range ?? [0, 0],
      heavenlyStem: p.decadal.heavenlyStem ?? '',
      earthlyBranch: p.decadal.earthlyBranch ?? '',
    }
  }
  if (Array.isArray(p.ages) && p.ages.length > 0) {
    palace.ages = p.ages
  }
  return palace
}

function mapHoroscopeScope(item: IztroHoroscopeItem | undefined): SerializedHoroscopeScope | undefined {
  if (!item) return undefined
  return {
    index: item.index ?? 0,
    name: item.name ?? '',
    heavenlyStem: item.heavenlyStem ?? '',
    earthlyBranch: item.earthlyBranch ?? '',
    palaceNames: item.palaceNames ?? [],
    mutagen: item.mutagen ?? [],
  }
}

/** 序列化 iztro horoscope 供运限引擎读快照，避免二次 bySolar */
export function serializeHoroscopeForReading(
  horoscope: IztroHoroscope | undefined,
  referenceYear: number,
): Record<string, unknown> {
  if (!horoscope) return { referenceYear }
  return {
    referenceYear,
    decadal: mapHoroscopeScope(horoscope.decadal),
    yearly: mapHoroscopeScope(horoscope.yearly),
    age: horoscope.age
      ? { ...mapHoroscopeScope(horoscope.age), nominalAge: horoscope.age.nominalAge }
      : undefined,
    monthly: mapHoroscopeScope(horoscope.monthly),
    daily: mapHoroscopeScope(horoscope.daily),
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
 * @param astrolabe iztro 排盘结果（IFunctionalAstrolabe 或任何具有兼容属性的对象）
 * @param birthDataParam 出生信息（供运限等后端逻辑）
 */
export function serializeAstrolabeForReading(
  astrolabe: IztroAstrolabe | Record<string, unknown> | null | undefined,
  birthDataParam?: BirthInfoForReading,
  horoscopeParam?: { horoscope: IztroHoroscope | Record<string, unknown>; referenceYear: number },
): Record<string, unknown> {
  if (!astrolabe) return {}

  const $ = astrolabe as Record<string, unknown>
  const result: Record<string, unknown> = {
    name: $.name ?? '命主',
    gender: $.gender ?? 'male',
    soul: $.soul ?? '',
    body: $.body ?? '',
    fiveElementsClass: $.fiveElementsClass ?? '',
    solarDate: $.solarDate ?? '',
    lunarDate: $.lunarDate ?? '',
    chineseDate: $.chineseDate ?? '',
    earthlyBranchOfSoulPalace: $.earthlyBranchOfSoulPalace ?? '',
    earthlyBranchOfBodyPalace: $.earthlyBranchOfBodyPalace ?? '',
    /** 生肖（iztro 直接计算，可用于确定太岁宫地支） */
    zodiac: $.zodiac ?? '',
    palaces: (Array.isArray($.palaces) ? $.palaces : []).map(mapPalace),
  }

  // 传递 rawDates.chineseDate 供后端准确读取生年干支
  const rawDates = $.rawDates as Record<string, unknown> | undefined
  if (rawDates?.chineseDate) {
    result.rawDates = {
      chineseDate: rawDates.chineseDate,
    }
    // 直接从 iztro rawDates 提取生年干支，写入顶层字段（权威数据源，已处理农历跨年）
    const yearly = (rawDates.chineseDate as Record<string, unknown>)?.yearly as string[] | undefined
    if (yearly && yearly.length === 2) {
      result.birthGan = yearly[0]
      result.taiSuiZhi = yearly[1]
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

  if (horoscopeParam?.horoscope) {
    result.horoscope = serializeHoroscopeForReading(
      horoscopeParam.horoscope,
      horoscopeParam.referenceYear,
    )
  }

  return result
}
