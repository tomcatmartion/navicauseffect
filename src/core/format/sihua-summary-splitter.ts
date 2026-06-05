/**
 * 四化汇总拆分器
 *
 * 将 MergedSihua（生年四化 + 太岁宫宫干四化）拆分为规范格式的 SihuaSummarySpec。
 * 数据来源：sihua-calculator/calculator.ts 的 calculateOriginalSihua() 输出。
 */

import type { MergedSihua, SihuaEntry, PalaceName } from '../types'
import type { SihuaSummarySpec, SihuaItemSpec } from './types'

/**
 * 拆分四化汇总为生年组和太岁组
 *
 * @param mergedSihua 来源：stage1.mergedSihua
 * @param palaceAnnotations 来源：mergedSihua.palaceAnnotations（四化落宫标注）
 */
export function splitSihuaSummary(
  mergedSihua: MergedSihua,
): SihuaSummarySpec {
  const palaceAnnotations = mergedSihua.palaceAnnotations ?? []

  // 构建星曜→落宫映射
  const starPalaceMap = buildStarToPalaceMap(palaceAnnotations)

  // 生年四化
  const shengNian: SihuaItemSpec[] = filterAndConvert(
    mergedSihua.entries,
    '生年',
    starPalaceMap,
  )

  // 太岁宫宫干四化
  const taiSui: SihuaItemSpec[] = filterAndConvert(
    mergedSihua.entries,
    '太岁宫宫干四化',
    starPalaceMap,
  )

  return { shengNian, taiSui }
}

/** 按来源过滤并转换为 SihuaItemSpec */
function filterAndConvert(
  entries: SihuaEntry[],
  source: string,
  starPalaceMap: Map<string, PalaceName>,
): SihuaItemSpec[] {
  return entries
    .filter(e => e.source === source)
    .map(e => ({
      type: sihuaTypeShort(e.type),
      star: e.star,
      palace: starPalaceMap.get(`${e.star}_${e.type}`) ?? '命宫',
    }))
}

/** 化禄 → 禄，化权 → 权，化科 → 科，化忌 → 忌 */
function sihuaTypeShort(fullType: string): '禄' | '权' | '科' | '忌' {
  const map: Record<string, '禄' | '权' | '科' | '忌'> = {
    '化禄': '禄',
    '化权': '权',
    '化科': '科',
    '化忌': '忌',
  }
  return map[fullType] ?? '禄'
}

/** 从 palaceAnnotations 构建 "星曜_类型" → 宫名 的映射 */
function buildStarToPalaceMap(
  annotations: Array<{
    palaceName: PalaceName
    annotations: Array<{ star: string; type: string }>
  }>,
): Map<string, PalaceName> {
  const map = new Map<string, PalaceName>()
  for (const pa of annotations) {
    for (const a of pa.annotations) {
      map.set(`${a.star}_${a.type}`, pa.palaceName)
    }
  }
  return map
}
