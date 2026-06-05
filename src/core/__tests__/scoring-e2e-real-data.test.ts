/**
 * 真实命盘评分端到端诊断测试
 *
 * 用 1982-09-24 男 timeIndex=2 验证增量评分实际得分
 * 增加详细诊断输出，验证每个计算步骤
 */

import { describe, it, expect } from 'vitest'
import { bySolar } from 'iztro/lib/astro'
import { getSihuaTable } from '@/core/sihua-calculator/tables'
import { evaluateAllPalaces, type ScoringContext, type PalaceForScoring, getOppositeIndex, getTrineIndices } from '@/core/energy-evaluator/scoring-flow'
import { computeSingleLayerDelta, scoreLayerByDelta, type LayerDeltaResult } from '@/core/energy-evaluator/layer-delta-scoring'
import type { DiZhi, TianGan, SihuaType } from '@/core/types'
import { PALACE_NAMES } from '@/core/types'

const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

function buildScoringContextFromIztro(astrolabe: any, birthGan: TianGan): ScoringContext {
  const rawPalaces = astrolabe.palaces ?? []
  const palaces: PalaceForScoring[] = PALACE_NAMES.map((palaceName, idx) => {
    const raw = rawPalaces.find((p: any) => p.name === palaceName)
    if (!raw) return { palaceIndex: idx, diZhi: '子' as DiZhi, brightness: '平' as const, majorStars: [], stars: [], hasLuCun: false }

    const stars: Array<{ name: string; sihua?: SihuaType; sihuaSource?: string }> = []
    for (const s of [...(raw.majorStars ?? []), ...(raw.minorStars ?? []), ...(raw.adjectiveStars ?? [])]) {
      if (!s || !s.name) continue
      const star: { name: string; sihua?: SihuaType; sihuaSource?: string } = { name: s.name }
      if (s.mutagen === '禄') { star.sihua = '化禄'; star.sihuaSource = '原局' }
      else if (s.mutagen === '权') { star.sihua = '化权'; star.sihuaSource = '原局' }
      else if (s.mutagen === '科') { star.sihua = '化科'; star.sihuaSource = '原局' }
      else if (s.mutagen === '忌') { star.sihua = '化忌'; star.sihuaSource = '原局' }
      stars.push(star)
    }

    return {
      palaceIndex: idx,
      diZhi: raw.earthlyBranch as DiZhi,
      brightness: (raw.majorStars?.[0]?.brightness ?? '平') as PalaceForScoring['brightness'],
      majorStars: (raw.majorStars ?? []).map((s: any) => ({
        star: s.name as any,
        brightness: (s.brightness ?? '平') as PalaceForScoring['brightness'],
      })),
      stars,
      hasLuCun: stars.some(s => s.name === '禄存'),
      tianGan: raw.heavenlyStem as TianGan,
    }
  })

  return { skeletonId: 'P01', palaces, birthGan, taiSuiZhi: '戌' as DiZhi, patterns: [] }
}

function buildDaXianCtx(natalCtx: ScoringContext, daXianGan: TianGan, mutagen: string[]): ScoringContext {
  const palaces: PalaceForScoring[] = natalCtx.palaces.map(p => ({
    ...p, stars: p.stars.map(s => ({ ...s })), majorStars: [...p.majorStars],
  }))
  const sihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
  for (let i = 0; i < mutagen.length && i < 4; i++) {
    for (const palace of palaces) {
      for (const star of palace.stars) {
        if (star.name === mutagen[i] && !star.sihua) {
          star.sihua = sihuaTypes[i]
          star.sihuaSource = '大限'
        }
      }
    }
  }
  return { skeletonId: natalCtx.skeletonId, palaces, birthGan: daXianGan, taiSuiZhi: natalCtx.taiSuiZhi, patterns: [] }
}

function buildLiuNianCtx(baseCtx: ScoringContext, liuNianGan: TianGan, mutagen: string[]): ScoringContext {
  const palaces: PalaceForScoring[] = baseCtx.palaces.map(p => ({
    ...p, stars: p.stars.map(s => ({ ...s })), majorStars: [...p.majorStars],
  }))
  const sihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
  for (let i = 0; i < mutagen.length && i < 4; i++) {
    for (const palace of palaces) {
      for (const star of palace.stars) {
        if (star.name === mutagen[i] && !star.sihua) {
          star.sihua = sihuaTypes[i]
          star.sihuaSource = '流年'
        }
      }
    }
  }
  return { skeletonId: baseCtx.skeletonId, palaces, birthGan: liuNianGan, taiSuiZhi: baseCtx.taiSuiZhi, patterns: [] }
}

describe('真实命盘评分端到端诊断', () => {
  it('1982-09-24 男 2024年 详细诊断', () => {
    const astrolabe = bySolar('1982-9-24', 2, '男', true)
    const horoscope = astrolabe.horoscope('2024-6-1')
    const birthGan = (astrolabe as any).rawDates?.chineseDate?.yearly?.[0] ?? '壬'

    const natalCtx = buildScoringContextFromIztro(astrolabe, birthGan)
    const natalScores = evaluateAllPalaces(natalCtx)

    // ═══ 原局诊断 ═══
    console.log('\n══ 原局评分 ══')
    for (let i = 0; i < 12; i++) {
      const p = natalCtx.palaces[i]
      const s = natalScores[i]!
      const sihua = p.stars.filter(st => st.sihua).map(st => `${st.name}${st.sihua}(${st.sihuaSource})`).join(',')
      const allStarNames = p.stars.map(st => st.name).join(',')
      console.log(`  [${String(i).padStart(2)}] ${PALACE_NAMES[i]}(${p.diZhi}): ${s.finalScore.toFixed(2)} ceil=${s.ceiling} tone=${s.tone}${sihua ? ` ← ${sihua}` : ''}`)
      console.log(`      星:${allStarNames}`)
    }

    // ═══ 大限诊断 ═══
    const dec = horoscope.decadal
    const dxGan = dec.heavenlyStem as TianGan
    const dxMutagen = dec.mutagen as string[]
    const daXianCtx = buildDaXianCtx(natalCtx, dxGan, dxMutagen)

    console.log(`\n══ 大限 Context 诊断 (天干=${dxGan}, 四化=${dxMutagen.join('/')}) ══`)

    // 验证每个大限四化星的标注
    const dxSihuaMap = getSihuaTable()[dxGan]
    const dxSihuaEntries = [
      { star: dxSihuaMap.禄, type: '化禄' as SihuaType },
      { star: dxSihuaMap.权, type: '化权' as SihuaType },
      { star: dxSihuaMap.科, type: '化科' as SihuaType },
      { star: dxSihuaMap.忌, type: '化忌' as SihuaType },
    ]

    for (const entry of dxSihuaEntries) {
      let found = false
      for (let pi = 0; pi < 12; pi++) {
        const star = daXianCtx.palaces[pi].stars.find(s => s.name === entry.star && s.sihua === entry.type && s.sihuaSource === '大限')
        if (star) {
          console.log(`  ${entry.type}=${entry.star} → [${pi}]${PALACE_NAMES[pi]}(${daXianCtx.palaces[pi].diZhi}) ✅`)
          found = true
        }
      }
      if (!found) {
        // 检查是否被原局四化阻挡
        for (let pi = 0; pi < 12; pi++) {
          const star = daXianCtx.palaces[pi].stars.find(s => s.name === entry.star)
          if (star) {
            console.log(`  ${entry.type}=${entry.star} → [${pi}]${PALACE_NAMES[pi]}: 已有${star.sihua}(${star.sihuaSource}) → 大限${entry.type}被跳过 ⚠️`)
          }
        }
      }
    }

    // ═══ 用 computeSingleLayerDelta 单独诊断关键宫位 ═══
    console.log('\n══ 逐宫大限增量诊断 ══')

    for (let i = 0; i < 12; i++) {
      const base = natalScores[i]!
      const result = computeSingleLayerDelta({
        baseScore: base.finalScore,
        natalPalaceIndex: i,
        layerCtx: daXianCtx,
        layerLabel: '大限',
        ceiling: base.ceiling,
      })

      if (result.rawDelta !== 0 || Object.keys(result.bonusDetails).length > 0 || Object.keys(result.penaltyDetails).length > 0) {
        console.log(`  [${String(i).padStart(2)}] ${PALACE_NAMES[i]}: ${base.finalScore.toFixed(2)} → ${result.finalScore.toFixed(2)} (Δ${result.rawDelta >= 0 ? '+' : ''}${result.rawDelta.toFixed(2)})`)
        if (Object.keys(result.bonusDetails).length > 0) {
          console.log(`      bonus: ${JSON.stringify(result.bonusDetails)}`)
        }
        if (Object.keys(result.penaltyDetails).length > 0) {
          console.log(`      penalty: ${JSON.stringify(result.penaltyDetails)}`)
        }

        // 诊断三方四正搜索
        const sfsz = [i, getOppositeIndex(i), ...getTrineIndices(i)]
        const sfszStr = sfsz.map(idx => `[${idx}]${PALACE_NAMES[idx]}`).join(', ')
        console.log(`      三方四正: ${sfszStr}`)

        // 找每个宫位中 layerLabel 的大限四化星
        for (const posIdx of sfsz) {
          const dxStars = daXianCtx.palaces[posIdx].stars.filter(s => s.sihuaSource === '大限')
          if (dxStars.length > 0) {
            console.log(`        [${posIdx}]${PALACE_NAMES[posIdx]}: ${dxStars.map(s => `${s.name}${s.sihua}`).join(',')}`)
          }
        }
      }
    }

    // ═══ 大限完整评分 ═══
    const daXianScores = scoreLayerByDelta(natalScores, { layerCtx: daXianCtx, layerLabel: '大限' })
    console.log('\n══ 大限完整评分 ══')
    for (let i = 0; i < 12; i++) {
      const ns = natalScores[i]!
      const ds = daXianScores[i]!
      const delta = ds.finalScore - ns.finalScore
      if (Math.abs(delta) > 0.001) {
        console.log(`  [${String(i).padStart(2)}] ${PALACE_NAMES[i]}: ${ns.finalScore.toFixed(2)} → ${ds.finalScore.toFixed(2)} (Δ${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`)
      }
    }

    // ═══ 流年诊断 ═══
    const year = horoscope.yearly
    const lnGan = year.heavenlyStem as TianGan
    const lnMutagen = year.mutagen as string[]
    const liuNianCtx = buildLiuNianCtx(daXianCtx, lnGan, lnMutagen)

    console.log(`\n══ 流年 Context 诊断 (天干=${lnGan}, 四化=${lnMutagen.join('/')}) ══`)
    const lnSihuaMap = getSihuaTable()[lnGan]
    const lnSihuaEntries = [
      { star: lnSihuaMap.禄, type: '化禄' as SihuaType },
      { star: lnSihuaMap.权, type: '化权' as SihuaType },
      { star: lnSihuaMap.科, type: '化科' as SihuaType },
      { star: lnSihuaMap.忌, type: '化忌' as SihuaType },
    ]
    for (const entry of lnSihuaEntries) {
      let found = false
      for (let pi = 0; pi < 12; pi++) {
        const star = liuNianCtx.palaces[pi].stars.find(s => s.name === entry.star && s.sihua === entry.type && s.sihuaSource === '流年')
        if (star) {
          console.log(`  ${entry.type}=${entry.star} → [${pi}]${PALACE_NAMES[pi]}(${liuNianCtx.palaces[pi].diZhi}) ✅`)
          found = true
        }
      }
      if (!found) {
        for (let pi = 0; pi < 12; pi++) {
          const star = liuNianCtx.palaces[pi].stars.find(s => s.name === entry.star)
          if (star) {
            console.log(`  ${entry.type}=${entry.star} → [${pi}]${PALACE_NAMES[pi]}: 已有${star.sihua}(${star.sihuaSource}) → 流年${entry.type}被跳过 ⚠️`)
          }
        }
      }
    }

    // ═══ 流年完整评分 ═══
    const liuNianScores = scoreLayerByDelta(daXianScores, { layerCtx: liuNianCtx, layerLabel: '流年' })
    console.log('\n══ 三层评分汇总 ══')
    for (let i = 0; i < 12; i++) {
      const ns = natalScores[i]!
      const ds = daXianScores[i]!
      const ls = liuNianScores[i]!
      const dxD = ds.finalScore - ns.finalScore
      const lnD = ls.finalScore - ds.finalScore
      if (Math.abs(dxD) > 0.001 || Math.abs(lnD) > 0.001) {
        console.log(`  [${String(i).padStart(2)}] ${PALACE_NAMES[i]}: ${ns.finalScore.toFixed(2)} →${ds.finalScore.toFixed(2)} →${ls.finalScore.toFixed(2)} (大限${dxD >= 0 ? '+' : ''}${dxD.toFixed(2)} 流年${lnD >= 0 ? '+' : ''}${lnD.toFixed(2)})`)
      }
    }

    // ═══ 关键断言 ═══
    // 大限四化全部标注
    expect(daXianCtx.palaces[7].stars.some(s => s.name === '巨门' && s.sihua === '化禄' && s.sihuaSource === '大限')).toBe(true)
    expect(daXianCtx.palaces[7].stars.some(s => s.name === '太阳' && s.sihua === '化权' && s.sihuaSource === '大限')).toBe(true)
    expect(daXianCtx.palaces[11].stars.some(s => s.name === '文曲' && s.sihua === '化科' && s.sihuaSource === '大限')).toBe(true)
    expect(daXianCtx.palaces[1].stars.some(s => s.name === '文昌' && s.sihua === '化忌' && s.sihuaSource === '大限')).toBe(true)

    // 大限得分变化方向正确
    expect(daXianScores[7]!.finalScore).toBeGreaterThan(natalScores[7]!.finalScore) // 疾厄: 巨门禄+太阳权
    expect(daXianScores[11]!.finalScore).toBeGreaterThan(natalScores[11]!.finalScore) // 兄弟: 文曲科

    // 无四化的宫位不变
    expect(daXianScores[4]!.finalScore).toBe(natalScores[4]!.finalScore) // 官禄: 不在三方四正内

    // 流年得分变化
    expect(liuNianScores[2]!.finalScore).toBeGreaterThan(daXianScores[2]!.finalScore) // 福德: 廉贞禄+破军权

    // 太阳已有大限化权 → 流年化忌被跳过
    const taiYangStar = liuNianCtx.palaces[7].stars.find(s => s.name === '太阳')
    expect(taiYangStar?.sihua).toBe('化权')
    expect(taiYangStar?.sihuaSource).toBe('大限')
  })
})
