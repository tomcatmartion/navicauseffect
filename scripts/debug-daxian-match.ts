/**
 * 调试大限匹配 — 直接用 iztro 排盘验证
 * 用法: npx tsx scripts/debug-daxian-match.ts
 */
import { astro } from '../packages/iztro'

// 1982-05-05 18:00 男性
const targetYear = 2026
const astrolabe = astro.bySolar(1982, 5, 5, 18, 1)

// 从 iztro 获取 horoscope
const horoscope = astrolabe.horoscope(targetYear, 0)
console.log('=== horoscope.decadal ===')
console.log('heavenlyStem:', (horoscope.decadal as Record<string, unknown>)?.heavenlyStem)
console.log('earthlyBranch:', (horoscope.decadal as Record<string, unknown>)?.earthlyBranch)
console.log('palaceNames:', (horoscope.decadal as Record<string, unknown>)?.palaceNames)
console.log('mutagen:', (horoscope.decadal as Record<string, unknown>)?.mutagen)

// 从 palaces 获取每个宫位的 decadal 信息
console.log('\n=== palaces[].decadal ===')
const palaces = astrolabe.palaces as Array<Record<string, unknown>>
for (const p of palaces) {
  const dec = p.decadal as Record<string, unknown> | undefined
  if (dec) {
    const ages = p.ages as number[] | undefined
    console.log(`${p.name}: ages=${JSON.stringify(ages)}, dec.range=${JSON.stringify(dec.range)}, heavenlyStem=${dec.heavenlyStem}`)
  }
}

// 计算实岁
console.log('\n=== 年龄计算 ===')
console.log('实岁:', targetYear - 1982)
console.log('期望大限: 第5限 45-54岁')
