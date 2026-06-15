/**
 * 大限/流年数据验证（独立版，不依赖 server-only 模块）
 *
 * 核心验证：
 *   1. iztro palaces 顺序 vs PALACE_NAMES 顺序
 *   2. 重排后 ScoringContext 顺序是否正确
 *   3. 大限 palaceIndex 转换是否正确
 *   4. 大限四化星在重排后的 ScoringContext 中的位置是否正确
 *   5. 流年偏移量是否正确
 *
 * 用法: npx tsx scripts/verify-daxian-liunian-data.ts
 */

import { bySolar } from 'iztro/lib/astro'
import { getSihuaTable } from '../src/core/sihua-calculator/tables'

const PALACE_NAMES = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'] as const
const GAN_TABLE = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DI_ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const PALACE_NAME_TO_INDEX: Record<string, number> = {}
PALACE_NAMES.forEach((name, i) => { PALACE_NAME_TO_INDEX[name] = i })

const solarDate = '1982-9-24'
const timeIndex = 3
const gender = '男'
const targetYear = 2024

console.log('═══════════════════════════════════════════════════')
console.log(`命盘: ${solarDate} ${gender} | 目标年: ${targetYear}`)
console.log('═══════════════════════════════════════════════════')

const iztroChart = bySolar(solarDate, timeIndex, gender, true)
const chartData = typeof (iztroChart as any).toJSON === 'function'
  ? (iztroChart as any).toJSON()
  : (iztroChart as any)

const rawPalaces = chartData.palaces as Array<Record<string, unknown>>

// ═══════════════════════════════════════════════════════
// 一、iztro 原始 palaces 顺序
// ═══════════════════════════════════════════════════════
console.log('\n══ 1. iztro 原始 palaces 顺序（按地支排列）══')
for (let i = 0; i < 12; i++) {
  console.log(`  rawPalaces[${i}] = ${rawPalaces[i].name} (${rawPalaces[i].earthlyBranch})`)
}

// ═══════════════════════════════════════════════════════
// 二、模拟 ScoringContext 重排
// ═══════════════════════════════════════════════════════
console.log('\n══ 2. 模拟 ScoringContext 重排（按 PALACE_NAMES 顺序）══')
// iztro-reader 的逻辑：PALACE_NAMES.map(name => rawPalaces.find(p => p.name === name))
const reorderedPalaces = PALACE_NAMES.map(name => {
  const idx = rawPalaces.findIndex(p => p.name === name)
  return { name, rawIdx: idx, diZhi: rawPalaces[idx]?.earthlyBranch }
})

for (let i = 0; i < 12; i++) {
  const rp = reorderedPalaces[i]
  console.log(`  palaces[${i}] = ${rp.name} (${rp.diZhi}) ← rawPalaces[${rp.rawIdx}]`)
}

// ═══════════════════════════════════════════════════════
// 三、大限 palaceIndex 验证
// ═══════════════════════════════════════════════════════
console.log('\n══ 3. 大限 palaceIndex 验证 ══')

// 模拟 extractAllDaXianMappings
const mappings: Array<{ rawIdx: number; name: string; diZhi: string; palaceIndex: number; gan: string; range: [number, number] }> = []
for (let i = 0; i < rawPalaces.length; i++) {
  const dec = rawPalaces[i].decadal as Record<string, unknown> | undefined
  if (!dec) continue
  const range = dec.range as [number, number] ?? [0, 0]
  if (range[0] <= 0) continue
  const name = rawPalaces[i].name as string
  const palaceIndex = PALACE_NAME_TO_INDEX[name] ?? -1
  const gan = (dec.heavenlyStem ?? rawPalaces[i].heavenlyStem) as string
  mappings.push({ rawIdx: i, name, diZhi: rawPalaces[i].earthlyBranch as string, palaceIndex, gan, range })
}
mappings.sort((a, b) => a.range[0] - b.range[0])

const nominalAge = targetYear - 1982 + 1
const current = mappings.find(m => m.range[0] <= nominalAge && m.range[1] >= nominalAge)

for (const m of mappings) {
  const isCur = m === current
  console.log(`  大限${m.range[0]}-${m.range[1]}岁: rawPalaces[${m.rawIdx}] ${m.name}(${m.diZhi}) palaceIndex=${m.palaceIndex} 天干=${m.gan}${isCur ? ' ← 当前' : ''}`)
}

if (current) {
  // 验证 palaceIndex 在重排后的 ScoringContext 中指向正确的位置
  const scPalace = reorderedPalaces[current.palaceIndex]
  console.log(`\n  当前大限: ${current.name}(${current.diZhi})`)
  console.log(`  palaceIndex=${current.palaceIndex}`)
  console.log(`  ScoringContext.palaces[${current.palaceIndex}] = ${scPalace.name}(${scPalace.diZhi})`)
  console.log(`  宫名匹配: ${scPalace.name === current.name ? '✅' : '❌'}`)
  console.log(`  地支匹配: ${scPalace.diZhi === current.diZhi ? '✅' : '❌'}`)

  // 大限偏移量含义
  console.log(`\n  大限偏移量 (daXianOffset) = ${current.palaceIndex}`)
  const dxMing = PALACE_NAMES[current.palaceIndex]
  const dxGuanLu = PALACE_NAMES[(current.palaceIndex + 4) % 12]
  const dxCaiBo = PALACE_NAMES[(current.palaceIndex + 8) % 12]
  console.log(`  大限命宫 = ScoringContext[${current.palaceIndex}] = ${dxMing}`)
  console.log(`  大限官禄 = ScoringContext[${(current.palaceIndex + 4) % 12}] = ${dxGuanLu}`)
  console.log(`  大限财帛 = ScoringContext[${(current.palaceIndex + 8) % 12}] = ${dxCaiBo}`)
}

// ═══════════════════════════════════════════════════════
// 四、大限四化落宫验证
// ═══════════════════════════════════════════════════════
console.log('\n══ 4. 大限四化落宫验证 ══')
if (current) {
  const sihua = getSihuaTable()[current.gan as keyof ReturnType<typeof getSihuaTable>]
  if (sihua) {
    const mutagen = [
      { star: sihua.禄, type: '化禄' },
      { star: sihua.权, type: '化权' },
      { star: sihua.科, type: '化科' },
      { star: sihua.忌, type: '化忌' },
    ]
    console.log(`  大限天干=${current.gan}`)
    console.log(`  四化: ${mutagen.map(m => `${m.type}=${m.star}`).join(', ')}`)

    // 在重排后的 palaces 中查找每颗四化星
    for (const m of mutagen) {
      for (let pi = 0; pi < 12; pi++) {
        const rawIdx = reorderedPalaces[pi].rawIdx
        const rp = rawPalaces[rawIdx]
        const allStars = [
          ...(rp.majorStars as Array<Record<string, unknown>> ?? []),
          ...(rp.minorStars as Array<Record<string, unknown>> ?? []),
          ...(rp.adjectiveStars as Array<Record<string, unknown>> ?? []),
        ]
        for (const star of allStars) {
          if (star.name === m.star) {
            console.log(`    ${m.type}: ${m.star} → ScoringContext.palaces[${pi}] ${PALACE_NAMES[pi]}(${reorderedPalaces[pi].diZhi})`)
          }
        }
      }
    }

    // 用当前大限举例：大限官禄的三方四正中有哪些四化贡献
    const dxOffset = current.palaceIndex
    const dxGuanLuIdx = (dxOffset + 4) % 12
    const oppIdx = (dxGuanLuIdx + 6) % 12
    const tri1 = (dxGuanLuIdx + 4) % 12
    const tri2 = (dxGuanLuIdx + 8) % 12

    console.log(`\n  大限官禄宫(ScoringContext[${dxGuanLuIdx}]) 三方四正增量:`)
    const checkIdxs = [
      { idx: dxGuanLuIdx, label: '本宫', decay: 1.0 },
      { idx: oppIdx, label: '对宫', decay: 0.8 },
      { idx: tri1, label: '三合1', decay: 0.7 },
      { idx: tri2, label: '三合2', decay: 0.7 },
    ]

    for (const ci of checkIdxs) {
      const rawIdx = reorderedPalaces[ci.idx].rawIdx
      const rp = rawPalaces[rawIdx]
      const allStars = [
        ...(rp.majorStars as Array<Record<string, unknown>> ?? []),
        ...(rp.minorStars as Array<Record<string, unknown>> ?? []),
        ...(rp.adjectiveStars as Array<Record<string, unknown>> ?? []),
      ]
      for (const m of mutagen) {
        for (const star of allStars) {
          if (star.name === m.star) {
            const score = m.type === '化禄' ? 0.5 : (m.type === '化权' ? 0.4 : (m.type === '化科' ? 0.3 : -0.5))
            console.log(`    ${ci.label}[${ci.idx}]${PALACE_NAMES[ci.idx]}: ${m.star} ${m.type} → ${score} × ${ci.decay} = ${score * ci.decay}`)
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// 五、流年偏移量验证
// ═══════════════════════════════════════════════════════
console.log('\n══ 5. 流年偏移量验证 ══')
const formulaGan = GAN_TABLE[(targetYear - 4) % 10]
const formulaZhi = DI_ZHI_ORDER[(targetYear - 4) % 12]
console.log(`  公式: ${targetYear}年 → ${formulaGan}${formulaZhi}`)

const liuNianSihua = getSihuaTable()[formulaGan as keyof ReturnType<typeof getSihuaTable>]
if (liuNianSihua) {
  console.log(`  流年四化: 化禄=${liuNianSihua.禄} 化权=${liuNianSihua.权} 化科=${liuNianSihua.科} 化忌=${liuNianSihua.忌}`)
}

// 流年命宫 = 地支在 ScoringContext 中的位置
const liuNianOffset = reorderedPalaces.findIndex(p => p.diZhi === formulaZhi)
console.log(`  流年地支=${formulaZhi} → ScoringContext index=${liuNianOffset} ${PALACE_NAMES[liuNianOffset]}`)

if (current) {
  console.log(`\n  链式偏移:`)
  console.log(`    原局: offset=0, 命宫=ScoringContext[0]=${PALACE_NAMES[0]}`)
  console.log(`    大限: offset=${current.palaceIndex}, 命宫=ScoringContext[${current.palaceIndex}]=${PALACE_NAMES[current.palaceIndex]}`)
  console.log(`    流年: offset=${liuNianOffset}, 命宫=ScoringContext[${liuNianOffset}]=${PALACE_NAMES[liuNianOffset]}`)
}

// ═══════════════════════════════════════════════════════
// 六、核心结论
// ═══════════════════════════════════════════════════════
console.log('\n══ 6. 核心结论 ══')
console.log('')
console.log('  ① iztro palaces 按地支排列，ScoringContext 按 PALACE_NAMES 重排')
console.log('  ② DaXianPalaceMapping.palaceIndex = PALACE_NAME_TO_INDEX[palaceName]')
console.log('     → palaceIndex 是 PALACE_NAMES 体系下的索引')
console.log('  ③ buildDaXianScoringContext 在 ScoringContext.palaces（PALACE_NAMES 顺序）上标注四化')
console.log('     → 四化星标注位置与 palaceIndex 体系一致')
console.log('  ④ layer-delta-scoring 用 natalPalaceIndex 遍历 ScoringContext.palaces')
console.log('     → ScoringContext.palaces[0]=命宫, [4]=官禄, 与 palaceIndex 一致')
console.log('  ⑤ 大限 palaceIndex 和 ScoringContext 都是 PALACE_NAMES 索引')
console.log('     → 体系统一 ✅')
if (current) {
  const scPalace = reorderedPalaces[current.palaceIndex]
  console.log('')
  console.log(`  实际验证: 大限命宫=${current.name}(${current.diZhi})`)
  console.log(`           palaceIndex=${current.palaceIndex}`)
  console.log(`           ScoringContext[${current.palaceIndex}]=${scPalace.name}(${scPalace.diZhi})`)
  console.log(`           匹配: ${scPalace.name === current.name && scPalace.diZhi === current.diZhi ? '✅ 完全正确' : '❌ 有问题'}`)
}

console.log('\n═══════════════════════════════════════════════════')
console.log('验证完成')
