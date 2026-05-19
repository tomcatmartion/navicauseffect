/**
 * iztro 原始 JSON → readChartFromData 可消费形态
 *
 * 职责：屏蔽 iztro 版本/字段别名差异（如 tianGan vs heavenlyStem），
 *       集中在一处适配，避免 ChartBridge 与上游多处打补丁。
 */

function adaptStarList(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return []
  return raw.map((x: Record<string, unknown>) => ({
    name: String(x.name ?? x['星名'] ?? ''),
    type: String(x.type ?? ''),
    brightness: String(x.brightness ?? x['亮度'] ?? ''),
    mutagen: x.mutagen ?? x['四化'] ?? '',
  }))
}

function adaptPalace(p: Record<string, unknown>): Record<string, unknown> {
  const heavenlyStem = String(p.heavenlyStem ?? p.tianGan ?? p['宫干'] ?? '')
  const earthlyBranch = String(p.earthlyBranch ?? p.diZhi ?? p['地支'] ?? '')
  return {
    ...p,
    name: String(p.name ?? ''),
    heavenlyStem,
    earthlyBranch,
    isBodyPalace: Boolean(p.isBodyPalace),
    majorStars: adaptStarList(p.majorStars),
    minorStars: adaptStarList(p.minorStars),
    adjectiveStars: adaptStarList(p.adjectiveStars),
  }
}

function adaptHoroscope(h: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!h || typeof h !== 'object') return undefined
  const out: Record<string, unknown> = { ...h }
  const decadal = h.decadal as Record<string, unknown> | undefined
  if (decadal && typeof decadal === 'object') {
    out.decadal = {
      ...decadal,
      heavenlyStem: decadal.heavenlyStem ?? decadal.gan,
      earthlyBranch: decadal.earthlyBranch ?? decadal.zhi,
    }
  }
  const yearly = h.yearly as Record<string, unknown> | undefined
  if (yearly && typeof yearly === 'object') {
    out.yearly = {
      ...yearly,
      heavenlyStem: yearly.heavenlyStem ?? yearly.gan,
      earthlyBranch: yearly.earthlyBranch ?? yearly.zhi,
    }
  }
  return out
}

/**
 * 标准化 iztro / 前端 命盘 JSON，再交给 `readChartFromData`。
 */
export function adaptIztroChartData(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw }

  if (typeof out.gender === 'string') {
    const g = out.gender
    if (g === 'MALE' || g === 'male') out.gender = '男'
    if (g === 'FEMALE' || g === 'female') out.gender = '女'
  }

  const palaces = raw.palaces
  if (Array.isArray(palaces)) {
    out.palaces = palaces.map(p => adaptPalace(p as Record<string, unknown>))
  }

  out.earthlyBranchOfSoulPalace = String(
    out.earthlyBranchOfSoulPalace ?? raw.earthlyBranchOfSoulPalace ?? '',
  )
  out.earthlyBranchOfBodyPalace = String(
    out.earthlyBranchOfBodyPalace ?? raw.earthlyBranchOfBodyPalace ?? '',
  )

  const horoscope = adaptHoroscope(raw.horoscope as Record<string, unknown> | undefined)
  if (horoscope) out.horoscope = horoscope

  return out
}
