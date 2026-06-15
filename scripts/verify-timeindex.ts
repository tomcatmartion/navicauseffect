/**
 * 测试不同 timeIndex 对 1982-9-24 命盘大限的影响
 *
 * 用法: npx tsx scripts/verify-timeindex.ts
 */

import { bySolar } from 'iztro/lib/astro'

const TIME_NAMES = ['子时(23-1)', '丑时(1-3)', '寅时(3-5)', '卯时(5-7)', '辰时(7-9)', '巳时(9-11)', '午时(11-13)', '未时(13-15)', '申时(15-17)', '酉时(17-19)', '戌时(19-21)', '亥时(21-23)', '子时早(0-1)']

const targetYear = 2024
const birthYear = 1982

console.log('═══════════════════════════════════════════════════════')
console.log(`1982-9-24 男 | 2024年 各时辰命盘对比`)
console.log('═══════════════════════════════════════════════════════')

for (let ti = 0; ti <= 12; ti++) {
  try {
    const a = bySolar('1982-9-24', ti, '男', true) as any
    const p = a.palaces ?? []

    // 找命宫位置
    const mingIdx = p.findIndex((pp: any) => pp.name === '命宫')
    const mingZhi = p[mingIdx]?.earthlyBranch

    // 找官禄位置
    const guanIdx = p.findIndex((pp: any) => pp.name === '官禄')
    const guanZhi = p[guanIdx]?.earthlyBranch

    // 找仆役位置
    const puIdx = p.findIndex((pp: any) => pp.name === '仆役')
    const puZhi = p[puIdx]?.earthlyBranch

    // 大限 (虚岁43 = 2024-1982+1)
    const h = a.horoscope('2024-6-1')
    const d = h.decadal
    const dxPalace = p[d.index]
    const nominalAge = h.age?.nominalAge ?? '?'

    console.log(`  ti=${String(ti).padStart(2)} ${TIME_NAMES[ti]}: 命宫=${mingZhi} 官禄=${guanZhi} 仆役=${puZhi} | 大限=palaces[${d.index}]${dxPalace.name}(${dxPalace.earthlyBranch}) 天干=${d.heavenlyStem} 虚岁=${nominalAge}`)
  } catch (e: any) {
    console.log(`  ti=${String(ti).padStart(2)} ${TIME_NAMES[ti]}: ERROR ${e.message}`)
  }
}

console.log('\n═══════════════════════════════════════════════════════')
