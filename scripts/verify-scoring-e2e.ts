/**
 * 大限/流年评分端到端验证
 *
 * 用 1982-09-24 男 timeIndex=2 (寅时) 验证：
 * 1. iztro 原始数据 → PALACE_NAMES 重排 → ScoringContext
 * 2. 大限 ScoringContext 四化标注是否正确
 * 3. 增量评分是否在正确的宫位上加减分
 * 4. 流年是否在大限基础上正确叠加
 *
 * 用法: npx tsx scripts/verify-scoring-e2e.ts
 */

import { bySolar } from 'iztro/lib/astro'
import { getSihuaTable } from '../src/core/sihua-calculator/tables'

// ═══════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════
const PALACE_NAMES = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'] as const
const DI_ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
type DiZhi = typeof DI_ZHI_ORDER[number]
type SihuaType = '化禄' | '化权' | '化科' | '化忌'

// ═══════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════
const solarDate = '1982-9-24'
const timeIndex = 2  // 寅时(3-5点)
const gender = '男'
const targetYear = 2024

console.log('═══════════════════════════════════════════════════════')
console.log(`端到端评分验证: ${solarDate} ${gender} timeIndex=${timeIndex}`)
console.log(`目标年: ${targetYear}`)
console.log('═══════════════════════════════════════════════════════')

// ═══════════════════════════════════════════════════════════
// Step 1: iztro 排盘 + horoscope
// ═══════════════════════════════════════════════════════════
const astrolabe = bySolar(solarDate, timeIndex, gender, true) as any
const rawPalaces = astrolabe.palaces ?? []
const horoscope = astrolabe.horoscope(`${targetYear}-6-1`)

const birthYear = parseInt(solarDate.split('-')[0])
const birthGan = (astrolabe.rawDates?.chineseDate?.yearly?.[0] ?? '壬') as string

// ═══════════════════════════════════════════════════════════
// Step 2: 模拟 iztro-reader 重排（地支顺序 → PALACE_NAMES 顺序）
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 2: iztro → PALACE_NAMES 重排 ══')

// 收集所有星曜（包括四化标注）
interface StarInfo { name: string; sihua?: string; sihuaSource?: string }
interface PalaceInfo {
  name: string
  diZhi: string
  tianGan: string
  stars: StarInfo[]
  majorStarNames: string[]
  hasLuCun: boolean
  iztroIdx: number
}

// 按地支建索引
const rawByDiZhi: Record<string, any> = {}
for (let i = 0; i < rawPalaces.length; i++) {
  rawByDiZhi[rawPalaces[i].earthlyBranch] = rawPalaces[i]
}

// 按 PALACE_NAMES 顺序重排
const reorderedPalaces: PalaceInfo[] = PALACE_NAMES.map((palaceName, pni) => {
  const raw = rawPalaces.find((p: any) => p.name === palaceName)
  if (!raw) return { name: palaceName, diZhi: '子', tianGan: '甲', stars: [], majorStarNames: [], hasLuCun: false, iztroIdx: -1 }

  const iztroIdx = rawPalaces.indexOf(raw)
  const allStars: StarInfo[] = []

  // 收集所有星曜
  for (const s of [...(raw.majorStars ?? []), ...(raw.minorStars ?? []), ...(raw.adjectiveStars ?? [])]) {
    if (!s || !s.name) continue
    const star: StarInfo = { name: s.name }
    if (s.mutagen) star.sihua = s.mutagen
    if (s.mutagen === '禄' || s.mutagen === '权' || s.mutagen === '科' || s.mutagen === '忌') {
      star.sihua = `化${s.mutagen}`
      star.sihuaSource = '原局'
    }
    allStars.push(star)
  }

  // 检查禄存
  const hasLuCun = allStars.some(s => s.name === '禄存')

  return {
    name: palaceName,
    diZhi: raw.earthlyBranch,
    tianGan: raw.heavenlyStem,
    stars: allStars,
    majorStarNames: (raw.majorStars ?? []).map((s: any) => s.name).filter(Boolean),
    hasLuCun,
    iztroIdx,
  }
})

// 输出重排结果
for (let i = 0; i < 12; i++) {
  const p = reorderedPalaces[i]
  const sihuaStr = p.stars.filter(s => s.sihua).map(s => `${s.name}${s.sihua}`).join(', ')
  console.log(`  [${String(i).padStart(2)}] ${p.name}(${p.diZhi}) 天干=${p.tianGan}${iztro => ''} ← iztro[${p.iztroIdx}]${sihuaStr ? ` 四化:${sihuaStr}` : ''}${p.hasLuCun ? ' 禄存' : ''} 星:${p.stars.map(s => s.name).join(',')}`)
}

// ═══════════════════════════════════════════════════════════
// Step 3: 大限 ScoringContext 四化标注验证
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 3: 大限 ScoringContext 四化标注 ══')

const dec = horoscope.decadal
const dxPalaceIztroIdx = dec.index  // iztro 顺序的索引
const dxPalaceName = rawPalaces[dxPalaceIztroIdx].name
const dxPalaceIndex = PALACE_NAMES.indexOf(dxPalaceName as any)  // PALACE_NAMES 索引

console.log(`  大限天干: ${dec.heavenlyStem}`)
console.log(`  大限四化: ${dec.mutagen.map((s: string, i: number) => `${['禄','权','科','忌'][i]}=${s}`).join(', ')}`)
console.log(`  大限命宫: iztro[${dxPalaceIztroIdx}]=${dxPalaceName} → PALACE_NAMES[${dxPalaceIndex}]`)

// 模拟 buildDaXianScoringContext 的四化标注
const daXianSihuaTypes: SihuaType[] = ['化禄', '化权', '化科', '化忌']
const daXianSihuaAnnotations: Array<{ star: string; type: SihuaType; palaces: string[] }> = []

for (let i = 0; i < dec.mutagen.length && i < 4; i++) {
  const starName = dec.mutagen[i]
  const sihuaType = daXianSihuaTypes[i]
  const foundPalaces: string[] = []

  for (let pi = 0; pi < 12; pi++) {
    const p = reorderedPalaces[pi]
    if (p.stars.some(s => s.name === starName)) {
      foundPalaces.push(`[${pi}]${p.name}(${p.diZhi})`)
    }
  }
  daXianSihuaAnnotations.push({ star: starName, type: sihuaType, palaces: foundPalaces })
  console.log(`    ${sihuaType}=${starName} → 落在: ${foundPalaces.join(', ')}`)
}

// 检查是否有四化星不在任何宫位中
for (const ann of daXianSihuaAnnotations) {
  if (ann.palaces.length === 0) {
    console.log(`    ⚠️ ${ann.type}=${ann.star} 未找到所在宫位!`)
  }
}

// ═══════════════════════════════════════════════════════════
// Step 4: 验证增量评分的三方四正搜索范围
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 4: 增量评分三方四正验证 ══')

// 对于大限命宫（PALACE_NAMES[dxPalaceIndex]），验证它的三方四正
const dxOffset = dxPalaceIndex
console.log(`\n  大限命宫 = PALACE_NAMES[${dxOffset}] = ${PALACE_NAMES[dxOffset]}`)
console.log(`  大限三方四正（从原局 PALACE_NAMES 视角）:`)

const dxOpposite = (dxOffset + 6) % 12
const dxTrine1 = (dxOffset + 4) % 12
const dxTrine2 = (dxOffset + 8) % 12

console.log(`    本宫[${dxOffset}] = ${PALACE_NAMES[dxOffset]}(${reorderedPalaces[dxOffset].diZhi})`)
console.log(`    对宫[${dxOpposite}] = ${PALACE_NAMES[dxOpposite]}(${reorderedPalaces[dxOpposite].diZhi})`)
console.log(`    三合1[${dxTrine1}] = ${PALACE_NAMES[dxTrine1]}(${reorderedPalaces[dxTrine1].diZhi})`)
console.log(`    三合2[${dxTrine2}] = ${PALACE_NAMES[dxTrine2]}(${reorderedPalaces[dxTrine2].diZhi})`)

// 检查这些宫位中有哪些大限四化星
console.log(`\n  大限命宫三方四正中的大限四化贡献:`)
for (const [label, idx, decay] of [['本宫', dxOffset, 1.0], ['对宫', dxOpposite, 0.8], ['三合1', dxTrine1, 0.7], ['三合2', dxTrine2, 0.7]] as const) {
  const p = reorderedPalaces[idx]
  for (const ann of daXianSihuaAnnotations) {
    if (p.stars.some(s => s.name === ann.star)) {
      const base = ann.type === '化禄' ? 0.5 : (ann.type === '化权' ? 0.4 : (ann.type === '化科' ? 0.3 : -0.5))
      const effective = base * decay
      console.log(`    ${label}[${idx}]${PALACE_NAMES[idx]}: ${ann.star}${ann.type} → ${base > 0 ? '+' : ''}${base} × ${decay} = ${effective > 0 ? '+' : ''}${effective.toFixed(2)}`)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Step 5: 逐宫检查哪些宫位会受到大限四化影响
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 5: 逐宫大限四化影响 ══')

for (let pi = 0; pi < 12; pi++) {
  const opp = (pi + 6) % 12
  const tri1 = (pi + 4) % 12
  const tri2 = (pi + 8) % 12
  const checkIdxs = [
    { idx: pi, label: '本宫', decay: 1.0 },
    { idx: opp, label: '对宫', decay: 0.8 },
    { idx: tri1, label: '三合1', decay: 0.7 },
    { idx: tri2, label: '三合2', decay: 0.7 },
  ]

  let bonusTotal = 0
  let penaltyTotal = 0
  const details: string[] = []

  for (const { idx, label, decay } of checkIdxs) {
    const p = reorderedPalaces[idx]
    for (const ann of daXianSihuaAnnotations) {
      if (p.stars.some(s => s.name === ann.star)) {
        const base = ann.type === '化禄' ? 0.5 : (ann.type === '化权' ? 0.4 : (ann.type === '化科' ? 0.3 : -0.5))
        const effective = base * decay
        if (base > 0) bonusTotal += effective
        else penaltyTotal += effective  // penaltyTotal 是负数
        details.push(`${label}:${ann.star}${ann.type}(${effective.toFixed(2)})`)
      }
    }
  }

  if (details.length > 0) {
    console.log(`  [${String(pi).padStart(2)}] ${PALACE_NAMES[pi]}(${reorderedPalaces[pi].diZhi}): bonus=${bonusTotal.toFixed(2)} penalty=${penaltyTotal.toFixed(2)} rawDelta=${(bonusTotal + penaltyTotal).toFixed(2)} ← ${details.join(', ')}`)
  }
}

// ═══════════════════════════════════════════════════════════
// Step 6: 流年四化验证
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 6: 流年数据验证 ══')

const year = horoscope.yearly
const lnPalaceIztroIdx = year.index
const lnPalaceName = rawPalaces[lnPalaceIztroIdx].name
const lnPalaceIndex = PALACE_NAMES.indexOf(lnPalaceName as any)

console.log(`  流年天干: ${year.heavenlyStem}`)
console.log(`  流年地支: ${year.earthlyBranch}`)
console.log(`  流年四化: ${year.mutagen.map((s: string, i: number) => `${['禄','权','科','忌'][i]}=${s}`).join(', ')}`)
console.log(`  流年命宫: iztro[${lnPalaceIztroIdx}]=${lnPalaceName} → PALACE_NAMES[${lnPalaceIndex}]`)

// 流年四化落宫
const lnSihuaAnnotations: Array<{ star: string; type: SihuaType; palaces: string[] }> = []
for (let i = 0; i < year.mutagen.length && i < 4; i++) {
  const starName = year.mutagen[i]
  const sihuaType = daXianSihuaTypes[i]
  const foundPalaces: string[] = []
  for (let pi = 0; pi < 12; pi++) {
    const p = reorderedPalaces[pi]
    if (p.stars.some(s => s.name === starName)) {
      foundPalaces.push(`[${pi}]${p.name}(${p.diZhi})`)
    }
  }
  lnSihuaAnnotations.push({ star: starName, type: sihuaType, palaces: foundPalaces })
  console.log(`    ${sihuaType}=${starName} → 落在: ${foundPalaces.join(', ') || '⚠️ 未找到'}`)
}

// ═══════════════════════════════════════════════════════════
// Step 7: 关键宫位三层定位验证
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 7: 关键宫位三层定位 ══')

// 以官禄宫为例
const guanLuIdx = 4  // PALACE_NAMES 中官禄的索引
console.log(`  原局官禄宫 = PALACE_NAMES[${guanLuIdx}] = ${reorderedPalaces[guanLuIdx].name}(${reorderedPalaces[guanLuIdx].diZhi})`)

// 大限视角的官禄
const dxGuanLu = (dxPalaceIndex + 4) % 12
console.log(`  大限命宫 offset=${dxPalaceIndex} → 大限官禄 = PALACE_NAMES[${dxGuanLu}] = ${PALACE_NAMES[dxGuanLu]}(${reorderedPalaces[dxGuanLu].diZhi})`)

// 流年视角的官禄
const lnOffset = lnPalaceIndex
const lnGuanLu = (lnPalaceIndex + 4) % 12
console.log(`  流年命宫 offset=${lnOffset} → 流年官禄 = PALACE_NAMES[${lnGuanLu}] = ${PALACE_NAMES[lnGuanLu]}(${reorderedPalaces[lnGuanLu].diZhi})`)

// ═══════════════════════════════════════════════════════════
// Step 8: 检查原局四化 vs 大限四化是否有重叠星曜
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 8: 原局四化 vs 大限四化重叠检查 ══')

// 原局四化（壬年）
const natalSihuaMap = getSihuaTable()[birthGan as keyof ReturnType<typeof getSihuaTable>]
if (natalSihuaMap) {
  console.log(`  原局天干=${birthGan} 四化: 禄=${natalSihuaMap.禄} 权=${natalSihuaMap.权} 科=${natalSihuaMap.科} 忌=${natalSihuaMap.忌}`)
  const natalStars = [natalSihuaMap.禄, natalSihuaMap.权, natalSihuaMap.科, natalSihuaMap.忌]
  const dxStars = dec.mutagen as string[]

  for (let i = 0; i < 4; i++) {
    if (natalStars.includes(dxStars[i])) {
      console.log(`    ⚠️ ${dxStars[i]}(${['禄','权','科','忌'][i]}) 同时出现在原局和大限四化中`)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Step 9: 检查 buildDaXianScoringContext 的关键行为
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 9: buildDaXianScoringContext 关键行为验证 ══')

// buildDaXianScoringContext 会:
// 1. 复制 natalCtx 的 palaces（PALACE_NAMES 顺序）
// 2. 遍历 mapping.mutagen 的4个四化星名
// 3. 在所有 palace.stars 中找到同名星，标注 sihua + sihuaSource='大限'
// 4. 条件: !star.sihua → 只标注没有四化的星

// 关键问题: 如果一个星曜已经有原局四化（sihuaSource='原局'），大限四化不会标注!
console.log('  buildDaXianScoringContext 的 !star.sihua 条件:')
for (const ann of daXianSihuaAnnotations) {
  // 找这个星在原局中是否已有四化
  for (let pi = 0; pi < 12; pi++) {
    const p = reorderedPalaces[pi]
    const star = p.stars.find(s => s.name === ann.star)
    if (star) {
      if (star.sihua) {
        console.log(`    ⚠️ ${ann.star} 已有原局四化(${star.sihua}) → 大限${ann.type}将被跳过!`)
      } else {
        console.log(`    ✅ ${ann.star} 无原局四化 → 大限${ann.type}可正常标注`)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Step 10: 数据一致性最终确认
// ═══════════════════════════════════════════════════════════
console.log('\n══ Step 10: 数据一致性最终确认 ══')

let allPass = true

// 10.1: 大限天干与四化表一致
const dxSihua = getSihuaTable()[dec.heavenlyStem as keyof ReturnType<typeof getSihuaTable>]
if (dxSihua) {
  const match = dxSihua.禄 === dec.mutagen[0] && dxSihua.权 === dec.mutagen[1] && dxSihua.科 === dec.mutagen[2] && dxSihua.忌 === dec.mutagen[3]
  console.log(`  10.1 大限四化与getSihuaTable: ${match ? '✅' : '❌'}`)
  if (!match) allPass = false
}

// 10.2: 流年天干与公式一致
const formulaGan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'][(targetYear - 4) % 10]
const formulaZhi = DI_ZHI_ORDER[(targetYear - 4) % 12]
console.log(`  10.2 流年天干公式: ${formulaGan === year.heavenlyStem ? '✅' : '❌'} (${formulaGan} vs ${year.heavenlyStem})`)
if (formulaGan !== year.heavenlyStem) allPass = false

console.log(`  10.3 流年地支公式: ${formulaZhi === year.earthlyBranch ? '✅' : '❌'} (${formulaZhi} vs ${year.earthlyBranch})`)
if (formulaZhi !== year.earthlyBranch) allPass = false

// 10.4: 大限命宫位置（PALACE_NAMES 索引）
const dxExpectedName = rawPalaces[dec.index].name
const dxExpectedPNI = PALACE_NAMES.indexOf(dxExpectedName as any)
console.log(`  10.4 大限命宫索引转换: iztro[${dec.index}]=${dxExpectedName} → PALACE_NAMES[${dxExpectedPNI}] ${dxExpectedPNI === dxPalaceIndex ? '✅' : '❌'}`)
if (dxExpectedPNI !== dxPalaceIndex) allPass = false

// 10.5: 流年命宫位置
const lnExpectedName = rawPalaces[year.index].name
const lnExpectedPNI = PALACE_NAMES.indexOf(lnExpectedName as any)
console.log(`  10.5 流年命宫索引转换: iztro[${year.index}]=${lnExpectedName} → PALACE_NAMES[${lnExpectedPNI}] ${lnExpectedPNI === lnPalaceIndex ? '✅' : '❌'}`)
if (lnExpectedPNI !== lnPalaceIndex) allPass = false

// 10.6: 大限四化星全部找到落宫
const allDxFound = daXianSihuaAnnotations.every(a => a.palaces.length > 0)
console.log(`  10.6 大限四化全部找到落宫: ${allDxFound ? '✅' : '❌'}`)
if (!allDxFound) allPass = false

// 10.7: 流年四化星全部找到落宫
const allLnFound = lnSihuaAnnotations.every(a => a.palaces.length > 0)
console.log(`  10.7 流年四化全部找到落宫: ${allLnFound ? '✅' : '❌'}`)
if (!allLnFound) allPass = false

console.log(`\n  ══ 最终结论: ${allPass ? '✅ 全部通过，数据通路正确' : '❌ 存在问题，需排查'} ══`)

console.log('\n═══════════════════════════════════════════════════════')
console.log('验证完成')
