/**
 * 大限/流年数据完整验证 — 两个命盘
 *
 * 命盘1: 1982-09-24 男 寅时(3-5点, timeIndex=2) → 2024年
 * 命盘2: 1986-09-25 女 酉时(17-19点, timeIndex=9) → 2026年
 *
 * 用法: npx tsx scripts/verify-full-data.ts
 */

import { bySolar } from 'iztro/lib/astro'
import { getSihuaTable } from '../src/core/sihua-calculator/tables'

const PALACE_NAMES = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'] as const
const GAN_TABLE = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DI_ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

function verifyChart(
  label: string,
  solarDate: string,
  timeIndex: number,
  gender: string,
  targetYear: number,
) {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log(`║ ${label}`)
  console.log(`║ ${solarDate} ${gender} timeIndex=${timeIndex} | 目标年: ${targetYear}`)
  console.log('╚══════════════════════════════════════════════════════╝')

  const astrolabe = bySolar(solarDate, timeIndex, gender, true) as any
  const rawPalaces = astrolabe.palaces ?? []
  const horoscope = astrolabe.horoscope(`${targetYear}-6-1`)

  const birthYear = parseInt(solarDate.split('-')[0])
  const nominalAge = horoscope.age?.nominalAge ?? (targetYear - birthYear + 1)

  // ══════ 原局 ══════
  console.log('\n  ── 原局十二宫 ──')
  for (let i = 0; i < 12; i++) {
    const p = rawPalaces[i]
    const stars = [
      ...(p.majorStars ?? []).map((s: any) => s.name),
      ...(p.minorStars ?? []).map((s: any) => s.name),
    ].filter(Boolean)
    console.log(`    palaces[${String(i).padStart(2)}] = ${p.name}(${p.earthlyBranch}) 天干=${p.heavenlyStem}${stars.length > 0 ? ` 星:${stars.join(',')}` : ''}`)
  }

  // ══════ 大限 ══════
  console.log('\n  ── 大限数据 ──')
  const dec = horoscope.decadal
  const dxPalace = rawPalaces[dec.index]
  console.log(`    虚岁: ${nominalAge}`)
  console.log(`    horoscope.decadal.index = ${dec.index}`)
  console.log(`    大限命宫 = palaces[${dec.index}] = ${dxPalace.name}(${dxPalace.earthlyBranch})`)
  console.log(`    大限天干 = ${dec.heavenlyStem}`)
  console.log(`    大限地支 = ${dec.earthlyBranch}`)
  console.log(`    大限四化: 禄=${dec.mutagen[0]} 权=${dec.mutagen[1]} 科=${dec.mutagen[2]} 忌=${dec.mutagen[3]}`)

  // 验证四化表
  const sihua = getSihuaTable()[dec.heavenlyStem as keyof ReturnType<typeof getSihuaTable>]
  if (sihua) {
    const match = sihua.禄 === dec.mutagen[0] && sihua.权 === dec.mutagen[1] && sihua.科 === dec.mutagen[2] && sihua.忌 === dec.mutagen[3]
    console.log(`    四化表验证: ${match ? '✅ 与getSihuaTable一致' : '❌ 不一致'}`)
    if (!match) {
      console.log(`      getSihuaTable(${dec.heavenlyStem}): 禄=${sihua.禄} 权=${sihua.权} 科=${sihua.科} 忌=${sihua.忌}`)
    }
  }

  // 大限各宫名（从大限视角）
  console.log(`    大限宫名视角: ${JSON.stringify(dec.palaceNames)}`)

  // 大限命宫的 PALACE_NAMES 索引
  const dxPNI = PALACE_NAMES.indexOf(dxPalace.name as typeof PALACE_NAMES[number])

  // 从大限视角看各关键宫位
  console.log(`\n    大限关键宫位（PALACE_NAMES索引体系）:`)
  console.log(`      大限命宫 = ${dxPalace.name}(${dxPalace.earthlyBranch}) palaceIndex=${dxPNI}`)
  const dxGuan = PALACE_NAMES[(dxPNI + 4) % 12]
  const dxCai = PALACE_NAMES[(dxPNI + 8) % 12]
  const dxQian = PALACE_NAMES[(dxPNI + 6) % 12]
  console.log(`      大限官禄 = ${dxGuan} (PALACE_NAMES[${(dxPNI + 4) % 12}])`)
  console.log(`      大限财帛 = ${dxCai} (PALACE_NAMES[${(dxPNI + 8) % 12}])`)
  console.log(`      大限迁移 = ${dxQian} (PALACE_NAMES[${(dxPNI + 6) % 12}])`)

  // 大限各宫位对应原局宫位
  console.log(`\n    大限十二宫 → 原局对应:`)
  for (let i = 0; i < 12; i++) {
    const rawIdx = (dec.index + i) % 12
    const rp = rawPalaces[rawIdx]
    console.log(`      大限${PALACE_NAMES[i]} = palaces[${rawIdx}] ${rp.name}(${rp.earthlyBranch})`)
  }

  // ══════ 流年 ══════
  console.log('\n  ── 流年数据 ──')
  const year = horoscope.yearly
  const lnPalace = rawPalaces[year.index]
  console.log(`    horoscope.yearly.index = ${year.index}`)
  console.log(`    流年命宫 = palaces[${year.index}] = ${lnPalace.name}(${lnPalace.earthlyBranch})`)
  console.log(`    流年天干 = ${year.heavenlyStem}`)
  console.log(`    流年地支 = ${year.earthlyBranch}`)
  console.log(`    流年四化: 禄=${year.mutagen[0]} 权=${year.mutagen[1]} 科=${year.mutagen[2]} 忌=${year.mutagen[3]}`)

  // 验证流年四化
  const lnSihua = getSihuaTable()[year.heavenlyStem as keyof ReturnType<typeof getSihuaTable>]
  if (lnSihua) {
    const match = lnSihua.禄 === year.mutagen[0] && lnSihua.权 === year.mutagen[1] && lnSihua.科 === year.mutagen[2] && lnSihua.忌 === year.mutagen[3]
    console.log(`    四化表验证: ${match ? '✅ 与getSihuaTable一致' : '❌ 不一致'}`)
  }

  // 流年公式验证
  const formulaGan = GAN_TABLE[(targetYear - 4) % 10]
  const formulaZhi = DI_ZHI_ORDER[(targetYear - 4) % 12]
  console.log(`    公式: ${targetYear}年 = ${formulaGan}${formulaZhi}`)
  console.log(`    公式验证: 天干=${formulaGan === year.heavenlyStem ? '✅' : '❌'} 地支=${formulaZhi === year.earthlyBranch ? '✅' : '❌'}`)

  // 流年命宫在原局/大限中的位置
  const lnPNI = PALACE_NAMES.indexOf(lnPalace.name as typeof PALACE_NAMES[number])
  // 流年命宫在大限中的位置：从大限视角看
  const lnInDaXian = (year.index - dec.index + 12) % 12
  console.log(`\n    流年命宫定位:`)
  console.log(`      原局: ${lnPalace.name}(${lnPalace.earthlyBranch}) = PALACE_NAMES[${lnPNI}]`)
  console.log(`      大限视角: 大限${PALACE_NAMES[lnInDaXian]} (offset=${lnInDaXian})`)

  // ══════ 全部大限一览 ══════
  console.log('\n  ── 全部大限一览 ──')
  for (let age = 4; age <= 114; age += 10) {
    const yr = birthYear + age - 1
    try {
      const h = astrolabe.horoscope(`${yr}-6-1`)
      const d = h.decadal
      const mp = rawPalaces[d.index]
      const isCurrent = d.index === dec.index
      console.log(`      ${yr}年(虚${age}岁): palaces[${d.index}] ${mp.name}(${mp.earthlyBranch}) 天干=${d.heavenlyStem}${isCurrent ? ' ← 当前' : ''}`)
    } catch { /* ignore */ }
  }

  // ══════ B路: chartData 虚岁匹配验证 ══════
  console.log('\n  ── B路: chartData 虚岁匹配验证 ──')
  const chartPalaces = rawPalaces.map((p: any) => ({
    name: p.name,
    earthlyBranch: p.earthlyBranch,
    heavenlyStem: p.heavenlyStem,
    decadal: p.decadal ? {
      range: p.decadal.range,
      heavenlyStem: p.decadal.heavenlyStem,
      earthlyBranch: p.decadal.earthlyBranch,
    } : undefined,
  }))

  const mappings: any[] = []
  for (let i = 0; i < chartPalaces.length; i++) {
    const p = chartPalaces[i]
    const dec2 = p.decadal
    if (!dec2) continue
    const range = dec2.range as [number, number]
    if (range[0] <= 0) continue
    mappings.push({
      rawIdx: i,
      name: p.name,
      earthlyBranch: p.earthlyBranch,
      daXianGan: dec2.heavenlyStem ?? p.heavenlyStem,
      range,
    })
  }
  mappings.sort((a: any, b: any) => a.range[0] - b.range[0])

  const ageMatched = mappings.find((m: any) => m.range[0] <= nominalAge && m.range[1] >= nominalAge)
  if (ageMatched) {
    const nameMatch = dxPalace.name === ageMatched.name
    const zhiMatch = dxPalace.earthlyBranch === ageMatched.earthlyBranch
    const ganMatch = dec.heavenlyStem === ageMatched.daXianGan
    console.log(`    B路: palaces[${ageMatched.rawIdx}] ${ageMatched.name}(${ageMatched.earthlyBranch}) 天干=${ageMatched.daXianGan}`)
    console.log(`    A路 vs B路: 宫名=${nameMatch ? '✅' : '❌'} 地支=${zhiMatch ? '✅' : '❌'} 天干=${ganMatch ? '✅' : '❌'}`)
    if (!nameMatch || !zhiMatch || !ganMatch) {
      console.log(`    ⚠️ 不匹配! A路=${dxPalace.name}(${dxPalace.earthlyBranch})天干${dec.heavenlyStem} B路=${ageMatched.name}(${ageMatched.earthlyBranch})天干${ageMatched.daXianGan}`)
    }
  } else {
    console.log(`    ⚠️ B路无虚岁${nominalAge}匹配的大限!`)
  }

  console.log('')
}

// ═══════════════════════════════════════════════════════════
// 验证两个命盘
// ═══════════════════════════════════════════════════════════
verifyChart(
  '命盘1: 用户校验',
  '1982-9-24', 2, '男', 2024,
)

verifyChart(
  '命盘2: 1986-09-25 女 酉时(17-19点) → 2026年',
  '1986-9-25', 9, '女', 2026,
)

console.log('═══════════════════════════════════════════════════════')
console.log('验证完成')
