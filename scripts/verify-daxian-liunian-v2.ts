/**
 * 大限/流年数据验证 v2 — 使用 iztro horoscope() 权威数据源
 *
 * 对比两路数据：
 *   A路：iztro astrolabe.horoscope() 直接输出（权威）
 *   B路：chartData → extractAllDaXianMappings + findCurrentDaXianFromChart（我们代码）
 *
 * 用法: npx tsx scripts/verify-daxian-liunian-v2.ts
 */

import { bySolar } from 'iztro/lib/astro'

// ═══════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════
const solarDate = '1982-9-24'
const timeIndex = 3  // 寅时
const gender = '男'
const targetYear = 2024
const horoscopeDate = '2024-6-1' // iztro horoscope 查询日期

console.log('═══════════════════════════════════════════════════════')
console.log(`命盘: ${solarDate} ${gender} timeIndex=${timeIndex}`)
console.log(`目标年: ${targetYear} | horoscope查询日期: ${horoscopeDate}`)
console.log('═══════════════════════════════════════════════════════')

// ═══════════════════════════════════════════════════════════
// A路：iztro horoscope() 权威数据
// ═══════════════════════════════════════════════════════════
console.log('\n══ A路: iztro horoscope() 权威数据 ══')

const astrolabe = bySolar(solarDate, timeIndex, gender, true) as any
const horoscope = astrolabe.horoscope(horoscopeDate)

// A1: 原局 palaces 顺序
console.log('\n  ── A1: iztro 原局 palaces 顺序 ──')
const rawPalaces = astrolabe.palaces ?? astrolabe.toJSON?.()?.palaces ?? []
for (let i = 0; i < 12; i++) {
  const p = rawPalaces[i]
  console.log(`    palaces[${i}] = ${p.name} (${p.earthlyBranch}) 天干=${p.heavenlyStem}`)
}

// A2: decadal 数据
console.log('\n  ── A2: 大限 horoscope.decadal ──')
const dec = horoscope.decadal
console.log(`    index = ${dec.index}`)
console.log(`    heavenlyStem = ${dec.heavenlyStem}`)
console.log(`    earthlyBranch = ${dec.earthlyBranch}`)
console.log(`    palaceNames = ${JSON.stringify(dec.palaceNames)}`)
console.log(`    mutagen = ${JSON.stringify(dec.mutagen)}`)

// 用 dec.index 直接在 palaces 中找大限命宫
const dxMingPalace = rawPalaces[dec.index]
console.log(`    大限命宫 = palaces[${dec.index}] = ${dxMingPalace.name} (${dxMingPalace.earthlyBranch})`)
console.log(`    大限天干 = ${dec.heavenlyStem}`)
console.log(`    大限四化 = 禄:${dec.mutagen[0]} 权:${dec.mutagen[1]} 科:${dec.mutagen[2]} 忌:${dec.mutagen[3]}`)

// A3: yearly 数据
console.log('\n  ── A3: 流年 horoscope.yearly ──')
const year = horoscope.yearly
console.log(`    index = ${year.index}`)
console.log(`    heavenlyStem = ${year.heavenlyStem}`)
console.log(`    earthlyBranch = ${year.earthlyBranch}`)
console.log(`    palaceNames = ${JSON.stringify(year.palaceNames)}`)
console.log(`    mutagen = ${JSON.stringify(year.mutagen)}`)

const lnMingPalace = rawPalaces[year.index]
console.log(`    流年命宫 = palaces[${year.index}] = ${lnMingPalace.name} (${lnMingPalace.earthlyBranch})`)
console.log(`    流年天干 = ${year.heavenlyStem}`)
console.log(`    流年四化 = 禄:${year.mutagen[0]} 权:${year.mutagen[1]} 科:${year.mutagen[2]} 忌:${year.mutagen[3]}`)

// A4: age 数据
console.log('\n  ── A4: 虚岁 ──')
const age = horoscope.age
console.log(`    nominalAge = ${age.nominalAge}`)
console.log(`    index = ${age.index}`)

// ═══════════════════════════════════════════════════════════
// B路：chartData 序列化 → extractAllDaXianMappings 逻辑模拟
// ═══════════════════════════════════════════════════════════
console.log('\n══ B路: chartData 序列化后的大限映射 ══')

// 模拟 serialize-chart-for-reading 的 mapPalace 输出
// chartData.palaces 保持 iztro 原始顺序（地支排列）
const chartPalaces = rawPalaces.map((p: any) => ({
  name: p.name,
  earthlyBranch: p.earthlyBranch,
  heavenlyStem: p.heavenlyStem,
  majorStars: (p.majorStars ?? []).map((s: any) => ({ name: s.name })),
  decadal: p.decadal ? {
    range: p.decadal.range,
    heavenlyStem: p.decadal.heavenlyStem,
    earthlyBranch: p.decadal.earthlyBranch,
  } : undefined,
}))

const PALACE_NAMES = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'] as const
const PALACE_NAME_TO_INDEX: Record<string, number> = {}
PALACE_NAMES.forEach((name, i) => { PALACE_NAME_TO_INDEX[name] = i })

// 模拟 extractAllDaXianMappings
const mappings: Array<{
  rawIdx: number
  name: string
  earthlyBranch: string
  palaceIndex: number
  daXianGan: string
  range: [number, number]
}> = []

for (let i = 0; i < chartPalaces.length; i++) {
  const p = chartPalaces[i]
  const dec = p.decadal
  if (!dec) continue
  const range = dec.range as [number, number]
  if (range[0] <= 0) continue
  mappings.push({
    rawIdx: i,
    name: p.name,
    earthlyBranch: p.earthlyBranch,
    palaceIndex: PALACE_NAME_TO_INDEX[p.name] ?? -1,
    daXianGan: (dec.heavenlyStem ?? p.heavenlyStem) as string,
    range,
  })
}
mappings.sort((a, b) => a.range[0] - b.range[0])

const nominalAge = targetYear - 1982 + 1
console.log(`  虚岁 = ${nominalAge}`)

console.log('\n  所有大限映射：')
for (const m of mappings) {
  const isCur = m.range[0] <= nominalAge && m.range[1] >= nominalAge
  console.log(`    大限${m.range[0]}-${m.range[1]}岁: palaces[${m.rawIdx}] ${m.name}(${m.earthlyBranch}) palaceIndex=${m.palaceIndex} 天干=${m.daXianGan}${isCur ? ' ← 虚岁匹配' : ''}`)
}

const ageMatched = mappings.find(m => m.range[0] <= nominalAge && m.range[1] >= nominalAge)
console.log(`\n  B路虚岁匹配结果: ${ageMatched ? `${ageMatched.name}(${ageMatched.earthlyBranch}) 天干=${ageMatched.daXianGan}` : '无匹配'}`)

// ═══════════════════════════════════════════════════════════
// C路：horoscope snapshot 路径
// ═══════════════════════════════════════════════════════════
console.log('\n══ C路: horoscope snapshot 路径 (模拟 findCurrentDaXianFromChart) ══')

const decadalIndex = dec.index
const decadalGan = dec.heavenlyStem
const decadalMutagen = dec.mutagen
// findCurrentDaXianFromChart 用 chartPalaces[decadalIndex] 取宫名
const snapshotPalaceName = chartPalaces[decadalIndex]?.name
const snapshotPalaceIndex = PALACE_NAME_TO_INDEX[snapshotPalaceName] ?? decadalIndex

console.log(`  horoscope.decadal.index = ${decadalIndex}`)
console.log(`  chartPalaces[${decadalIndex}].name = ${snapshotPalaceName}`)
console.log(`  palaceIndex (PALACE_NAMES) = ${snapshotPalaceIndex}`)
console.log(`  天干 = ${decadalGan}`)
console.log(`  四化 = ${JSON.stringify(decadalMutagen)}`)

// ═══════════════════════════════════════════════════════════
// 对比总结
// ═══════════════════════════════════════════════════════════
console.log('\n══ 对比总结 ══')
console.log('')
console.log('  A路 (iztro horoscope 权威):')
console.log(`    大限命宫 = ${dxMingPalace.name} (${dxMingPalace.earthlyBranch}) 天干=${dec.heavenlyStem}`)
console.log(`    流年命宫 = ${lnMingPalace.name} (${lnMingPalace.earthlyBranch}) 天干=${year.heavenlyStem}`)
console.log('')
console.log('  B路 (chartData 虚岁匹配):')
console.log(`    大限命宫 = ${ageMatched ? `${ageMatched.name} (${ageMatched.earthlyBranch}) 天干=${ageMatched.daXianGan}` : '无匹配'}`)
console.log('')
console.log('  C路 (horoscope snapshot):')
console.log(`    大限命宫 = ${snapshotPalaceName} (${chartPalaces[decadalIndex]?.earthlyBranch}) 天干=${decadalGan}`)
console.log('')

// 匹配检查
if (ageMatched) {
  const aName = dxMingPalace.name
  const aZhi = dxMingPalace.earthlyBranch
  const aGan = dec.heavenlyStem
  const bName = ageMatched.name
  const bZhi = ageMatched.earthlyBranch
  const bGan = ageMatched.daXianGan

  const nameMatch = aName === bName
  const zhiMatch = aZhi === bZhi
  const ganMatch = aGan === bGan

  console.log(`  A路 vs B路 匹配: 宫名=${nameMatch ? '✅' : '❌'} 地支=${zhiMatch ? '✅' : '❌'} 天干=${ganMatch ? '✅' : '❌'}`)

  if (!nameMatch || !zhiMatch || !ganMatch) {
    console.log(`    ⚠️  A路=${aName}(${aZhi})天干${aGan}  B路=${bName}(${bZhi})天干${bGan}`)
  }
}

// 流年验证
const GAN_TABLE = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DI_ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const formulaGan = GAN_TABLE[(targetYear - 4) % 10]
const formulaZhi = DI_ZHI_ORDER[(targetYear - 4) % 12]
console.log('')
console.log(`  流年公式: ${targetYear}年 = ${formulaGan}${formulaZhi}`)
console.log(`  A路流年: 天干=${year.heavenlyStem} 地支=${year.earthlyBranch} 命宫=${lnMingPalace.name}(${lnMingPalace.earthlyBranch})`)
console.log(`  公式 vs A路: 天干=${formulaGan === year.heavenlyStem ? '✅' : '❌'} 地支=${formulaZhi === year.earthlyBranch ? '✅' : '❌'}`)

// ═══════════════════════════════════════════════════════════
// 全部大限的 horoscope 验证（遍历不同年份）
// ═══════════════════════════════════════════════════════════
console.log('\n══ 全部大限一览（iztro horoscope 遍历） ══')
const birthYear = 1982
for (let age = 4; age <= 114; age += 10) {
  const yr = birthYear + age - 1
  try {
    const h = astrolabe.horoscope(`${yr}-6-1`)
    const d = h.decadal
    const mp = rawPalaces[d.index]
    console.log(`    ${yr}年(虚${age}岁): palaces[${d.index}] ${mp.name}(${mp.earthlyBranch}) 天干=${d.heavenlyStem}`)
  } catch (e: any) {
    // 忽略
  }
}

console.log('\n═══════════════════════════════════════════════════════')
console.log('验证完成')
