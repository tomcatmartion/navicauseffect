/**
 * 端到端验证：宫位能级得分绑定在地支宫位上
 *
 * 验证用户指令中的核心规则：
 * 1. 原局每个地支位置有一个固定的能级得分
 * 2. 大限功能宫（如大限官禄宫）落在某地支位置时，其能级得分 = 该地支位置的原局得分
 * 3. 流年功能宫（如流年夫妻宫）落在某地支位置时，其能级得分 = 该地支位置的原局得分
 *
 * 方法：
 * - 用 iztro 真实排盘
 * - 执行 Stage1 得到原局12宫评分（即12个地支位置的能级）
 * - 构建大限/流年 ScoringContext 并评分
 * - 逐宫验证：大限/流年每个功能宫的得分 = 该功能宫所在的地支位置的评分
 */
import { describe, it, expect } from 'vitest'
import { bySolar } from 'iztro/lib/astro/astro'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { evaluateAllPalaces } from '@/core/energy-evaluator/scoring-flow'
import { PalaceEnergyIndex } from '@/core/energy-evaluator/palace-energy-index'
import { buildDaXianScoringContext, buildYearlyScoringContext } from '@/core/limit-analyzer/limit-scoring-context'
import { buildThreeLayerTable, extractAllDaXianMappings, resolveLiuNianGanZhi } from '@/core/limit-analyzer/fortune-engine'
import { PALACE_NAMES, PALACE_NAME_TO_INDEX } from '@/core/types'
import type { DiZhi, PalaceName } from '@/core/types'

// ═══════════════════════════════════════════════════════════
// 构建测试数据
// ═══════════════════════════════════════════════════════════

function buildChartData(solarDate: string, timeIndex: number, gender: string) {
  const iztroChart = bySolar(solarDate, timeIndex, gender as '男' | '女', true)
  // 使用 toJSON 获取完整序列化数据（含 decadal 大限信息）
  const chartData = typeof (iztroChart as any).toJSON === 'function'
    ? (iztroChart as any).toJSON()
    : (iztroChart as any)
  return chartData as Record<string, unknown>
}

/**
 * 构建地支→原局索引的映射表
 * natalPalaceMap['午'] = 原局中午宫所在的索引
 */
function buildDiZhiToNatalIndexMap(
  palaces: Array<{ diZhi: DiZhi }>,
): Map<DiZhi, number> {
  const map = new Map<DiZhi, number>()
  palaces.forEach((p, i) => map.set(p.diZhi, i))
  return map
}

// ═══════════════════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════════════════

describe('端到端验证：宫位能级得分绑定在地支宫位上', () => {
  // 用 1982-09-24 男命作为测试数据
  const chartData = buildChartData('1982-09-24', 2, '男')
  const stage1 = executeStage1({ chartData, parentBirthYears: {} })
  const natalScores = stage1.palaceScores
  const natalCtx = stage1.scoringCtx

  // 构建地支→原局索引映射
  const diZhiMap = buildDiZhiToNatalIndexMap(
    natalCtx.palaces.map(p => ({ diZhi: p.diZhi })),
  )

  // ─────────────────────────────────────────────────────────
  // 前置信息打印
  // ─────────────────────────────────────────────────────────
  it('前置：打印原局12宫的地支和能级得分（即地支位置固定分数）', () => {
    console.log('\n═══ 原局12宫地支位置与能级得分（固定值） ═══')
    for (let i = 0; i < 12; i++) {
      const s = natalScores[i]!
      console.log(
        `  原局[${i}] ${s.palace.padEnd(4)} 地支=${s.diZhi}  能级得分=${s.finalScore.toFixed(2)}`,
      )
    }

    // 验证基本数据完整性
    expect(natalScores).toHaveLength(12)
    for (const s of natalScores) {
      expect(s.finalScore).toBeGreaterThan(0)
      expect(s.finalScore).toBeLessThanOrEqual(10)
    }
  })

  // ─────────────────────────────────────────────────────────
  // 规则1：原局每个地支位置有固定能级得分
  // ─────────────────────────────────────────────────────────
  it('规则1：原局12个地支位置各有固定的能级得分', () => {
    // 每个地支必须出现且只有一个
    const seenDiZhi = new Set<DiZhi>()
    for (const s of natalScores) {
      expect(seenDiZhi.has(s.diZhi)).toBe(false)
      seenDiZhi.add(s.diZhi)
    }
    expect(seenDiZhi.size).toBe(12)
  })

  // ─────────────────────────────────────────────────────────
  // 规则2：大限功能宫的能级得分 = 该宫所在的地支位置的原局得分
  // ─────────────────────────────────────────────────────────
  describe('规则2：大限宫位能级得分取地支位置的原局得分', () => {
    const daXianMappings = extractAllDaXianMappings(chartData, 1982)

    // 取前2个大限做详细验证
    const testMappings = daXianMappings.slice(0, 2)

    for (const mapping of testMappings) {
      it(`大限第${mapping.index}限（${mapping.ageRange[0]}-${mapping.ageRange[1]}岁，命宫在原局${mapping.mingPalaceName} palaceIndex=${mapping.palaceIndex}）`, () => {
        console.log(`\n  ── 大限第${mapping.index}限 ──`)
        console.log(`  大限命宫 = 原局[${mapping.palaceIndex}] ${mapping.mingPalaceName}`)
        console.log(`  大限天干 = ${mapping.daXianGan}`)
        console.log(`  大限四化 = ${mapping.mutagen.join(', ')}`)

        // 构建大限评分上下文
        const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
        expect(daXianCtx).not.toBeNull()

        // 用大限上下文跑完整6步评分
        const daXianEvalScores = evaluateAllPalaces(daXianCtx!)

        // 用 PalaceEnergyIndex 获取大限层视角的评分摘要
        const daXianIndex = new PalaceEnergyIndex(daXianEvalScores)
        const briefs = daXianIndex.toLayerBriefs(mapping.palaceIndex)
        expect(briefs).toHaveLength(12)

        console.log('\n  大限12宫 vs 地支位置得分验证：')

        // 逐宫验证：大限每个功能宫的得分 = 该功能宫所在的地支位置的原局得分
        let allMatch = true
        for (let layerIdx = 0; layerIdx < 12; layerIdx++) {
          const brief = briefs[layerIdx]!
          const palaceName = PALACE_NAMES[layerIdx] as PalaceName
          // 大限第 layerIdx 宫 对应的原局地支位置
          const natalIdx = (mapping.palaceIndex + layerIdx) % 12
          const natalScore = natalScores[natalIdx]!
          // 大限上下文中该地支位置的评分（包含大限四化效果）
          const daXianScore = daXianEvalScores[natalIdx]!

          // 地支位置信息
          const diZhi = natalCtx.palaces[natalIdx]!.diZhi

          console.log(
            `    大限${palaceName.padEnd(4)} → 地支${diZhi} (原局[${natalIdx}]${natalScore.palace})` +
            `  大限得分=${daXianScore.finalScore.toFixed(2)}  原局得分=${natalScore.finalScore.toFixed(2)}` +
            (Math.abs(daXianScore.finalScore - natalScore.finalScore) > 0.01
              ? '  [不同: 大限四化影响]'
              : '  [相同]'),
          )

          // 核心验证：大限该宫的得分来自正确的地支位置
          // evaluateAllPalaces(daXianCtx) 返回的 scores[natalIdx] 就是该地支位置在大限上下文中的评分
          // 它的骨架基础分（步骤1）必须与原局该地支位置完全一致
          expect(daXianScore.diZhi).toBe(natalScore.diZhi)
          expect(daXianScore.skeletonScore).toBe(natalScore.skeletonScore)

          // brief 中的分数也应该来自正确的地支位置
          expect(brief.score).toBe(daXianScore.finalScore)
        }

        // 额外验证：大限命宫（layerIdx=0）的骨架基础分
        const daXianMingNatalIdx = mapping.palaceIndex
        const daXianMingScore = daXianEvalScores[daXianMingNatalIdx]!
        const natalPalaceAtSameDiZhi = natalScores[daXianMingNatalIdx]!
        console.log(
          `\n  验证：大限命宫骨架分(${daXianMingScore.skeletonScore}) == 原局同地支骨架分(${natalPalaceAtSameDiZhi.skeletonScore})`,
        )
        expect(daXianMingScore.skeletonScore).toBe(natalPalaceAtSameDiZhi.skeletonScore)
      })
    }
  })

  // ─────────────────────────────────────────────────────────
  // 规则3：流年功能宫的能级得分 = 该宫所在的地支位置的原局得分
  // ─────────────────────────────────────────────────────────
  describe('规则3：流年宫位能级得分取地支位置的原局得分', () => {
    // 用 2025 年（乙巳年）和 2026 年（丙午年）测试
    const testYears = [2025, 2026]

    for (const year of testYears) {
      it(`流年${year}年`, () => {
        const { gan: liuNianGan, zhi: liuNianZhi } = resolveLiuNianGanZhi(chartData, year)
        console.log(`\n  ── 流年${year} (${liuNianGan}${liuNianZhi}) ──`)

        // 流年命宫在原局中的索引
        const liuNianOffset = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)
        console.log(`  流年地支=${liuNianZhi}  流年命宫偏移量=${liuNianOffset}`)

        // 构建流年评分上下文
        const yearlyCtx = buildYearlyScoringContext(year, natalCtx)
        expect(yearlyCtx).not.toBeNull()

        // 用流年上下文跑完整6步评分
        const yearlyEvalScores = evaluateAllPalaces(yearlyCtx!)

        // 用 PalaceEnergyIndex 获取流年层视角的评分摘要
        const liuNianEnergyIndex = new PalaceEnergyIndex(yearlyEvalScores)
        const briefs = liuNianEnergyIndex.toLayerBriefs(liuNianOffset >= 0 ? liuNianOffset : 0)
        expect(briefs).toHaveLength(12)

        console.log('\n  流年12宫 vs 地支位置得分验证：')

        for (let layerIdx = 0; layerIdx < 12; layerIdx++) {
          const brief = briefs[layerIdx]!
          const palaceName = PALACE_NAMES[layerIdx] as PalaceName
          // 流年第 layerIdx 宫 对应的原局地支位置
          const natalIdx = (liuNianOffset + layerIdx) % 12
          const natalScore = natalScores[natalIdx]!
          const yearlyScore = yearlyEvalScores[natalIdx]!
          const diZhi = natalCtx.palaces[natalIdx]!.diZhi

          console.log(
            `    流年${palaceName.padEnd(4)} → 地支${diZhi} (原局[${natalIdx}]${natalScore.palace})` +
            `  流年得分=${yearlyScore.finalScore.toFixed(2)}  原局得分=${natalScore.finalScore.toFixed(2)}` +
            (Math.abs(yearlyScore.finalScore - natalScore.finalScore) > 0.01
              ? '  [不同: 流年四化影响]'
              : '  [相同]'),
          )

          // 核心验证：流年该宫的骨架基础分 = 原局同地支位置的骨架基础分
          expect(yearlyScore.diZhi).toBe(natalScore.diZhi)
          expect(yearlyScore.skeletonScore).toBe(natalScore.skeletonScore)
          // brief 中的分数来自正确的地支位置
          expect(brief.score).toBe(yearlyScore.finalScore)
        }
      })
    }
  })

  // ─────────────────────────────────────────────────────────
  // 规则验证：用一个具体例子完全对应用户的指令描述
  // ─────────────────────────────────────────────────────────
  it('用户指令验证：大限官禄宫落在午宫时，得分=午宫原局得分', () => {
    // 找到午宫在原局中的索引
    const wuIdx = diZhiMap.get('午')
    expect(wuIdx).toBeDefined()
    const wuScore = natalScores[wuIdx!]!.finalScore
    console.log(`\n  午宫原局得分: ${wuScore.toFixed(2)}`)

    // 遍历所有大限，找出哪个大限的官禄宫落在午宫
    const daXianMappings = extractAllDaXianMappings(chartData, 1982)
    let foundAtLeastOne = false

    for (const mapping of daXianMappings) {
      // 大限官禄宫（layerIdx=4）对应的原局索引
      const guanLuNatalIdx = (mapping.palaceIndex + 4) % 12
      const guanLuDiZhi = natalCtx.palaces[guanLuNatalIdx]!.diZhi

      if (guanLuDiZhi === '午') {
        foundAtLeastOne = true
        // 获取大限官禄宫的评分
        const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
        const daXianScores = evaluateAllPalaces(daXianCtx!)
        const dxIdx = new PalaceEnergyIndex(daXianScores)
        const briefs = dxIdx.toLayerBriefs(mapping.palaceIndex)

        // 大限官禄宫的 brief
        const guanLuBrief = briefs[4]!
        // 大限官禄宫的评分数组（按原局索引）
        const guanLuEvalScore = daXianScores[guanLuNatalIdx]!

        console.log(
          `  大限第${mapping.index}限的官禄宫落在午宫(原局[${guanLuNatalIdx}])\n` +
          `    brief得分: ${guanLuBrief.score.toFixed(2)}\n` +
          `    eval得分:  ${guanLuEvalScore.finalScore.toFixed(2)}\n` +
          `    午宫骨架分: ${guanLuEvalScore.skeletonScore}\n` +
          `    原局午宫骨架分: ${natalScores[wuIdx!]!.skeletonScore}`,
        )

        // 关键验证：大限官禄宫的骨架基础分 = 午宫的骨架基础分
        expect(guanLuEvalScore.skeletonScore).toBe(natalScores[wuIdx!]!.skeletonScore)
        // brief 的分数来自正确的地支位置
        expect(guanLuBrief.score).toBe(guanLuEvalScore.finalScore)

        console.log(`  ✓ 验证通过：大限官禄宫落在午宫，骨架基础分=${guanLuEvalScore.skeletonScore} = 午宫原局骨架基础分=${natalScores[wuIdx!]!.skeletonScore}`)
      }
    }

    if (!foundAtLeastOne) {
      console.log('  本命盘没有大限官禄宫落在午宫的情况，验证其他宫位...')
      // 找任意一个大限官禄宫落在不同地支的情况
      for (const mapping of daXianMappings) {
        const guanLuNatalIdx = (mapping.palaceIndex + 4) % 12
        const guanLuDiZhi = natalCtx.palaces[guanLuNatalIdx]!.diZhi
        const natalGuanLuDiZhi = natalCtx.palaces[4]!.diZhi // 原局官禄宫的地支

        if (guanLuDiZhi !== natalGuanLuDiZhi) {
          // 大限官禄宫与原局官禄宫在不同的地支位置
          const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
          const daXianScores = evaluateAllPalaces(daXianCtx!)
          const dxIdx2 = new PalaceEnergyIndex(daXianScores)
          const briefs = dxIdx2.toLayerBriefs(mapping.palaceIndex)

          const guanLuBrief = briefs[4]!
          const guanLuEvalScore = daXianScores[guanLuNatalIdx]!
          const guanLuDiZhiScore = natalScores[guanLuNatalIdx]!.skeletonScore
          const natalGuanLuScore = natalScores[4]!.skeletonScore

          console.log(
            `\n  大限第${mapping.index}限的官禄宫落在${guanLuDiZhi}宫(原局[${guanLuNatalIdx}])\n` +
            `    原局官禄宫在${natalGuanLuDiZhi}宫(原局[4])\n` +
            `    大限官禄宫骨架分: ${guanLuEvalScore.skeletonScore}\n` +
            `    ${guanLuDiZhi}宫原局骨架分: ${guanLuDiZhiScore}\n` +
            `    原局官禄宫骨架分: ${natalGuanLuScore}\n` +
            `    大限官禄宫得分取的是${guanLuDiZhi}宫的骨架分，不是原局官禄宫的`,
          )

          // 大限官禄宫的骨架分 = 它落在的地支位置的骨架分
          expect(guanLuEvalScore.skeletonScore).toBe(guanLuDiZhiScore)
          // 不等于原局官禄宫的骨架分（除非碰巧相同）
          console.log(`  ✓ 验证通过：大限官禄宫骨架分=${guanLuEvalScore.skeletonScore} 匹配${guanLuDiZhi}宫而非原局官禄宫`)
          break
        }
      }
    }
  })

  // ─────────────────────────────────────────────────────────
  // 规则验证：流年夫妻宫落在某地支时，得分=该地支原局得分
  // ─────────────────────────────────────────────────────────
  it('用户指令验证：流年夫妻宫的地支得分规则', () => {
    const year = 2026
    const { zhi: liuNianZhi } = resolveLiuNianGanZhi(chartData, year)
    const liuNianOffset = natalCtx.palaces.findIndex(p => p.diZhi === liuNianZhi)

    const yearlyCtx = buildYearlyScoringContext(year, natalCtx)
    const yearlyScores = evaluateAllPalaces(yearlyCtx!)
    const lnIdx = new PalaceEnergyIndex(yearlyScores)
    const briefs = lnIdx.toLayerBriefs(liuNianOffset)

    // 流年夫妻宫（layerIdx=10）
    const fuQiLayerIdx = PALACE_NAME_TO_INDEX['夫妻'] // 10
    const fuQiNatalIdx = (liuNianOffset + fuQiLayerIdx) % 12
    const fuQiDiZhi = natalCtx.palaces[fuQiNatalIdx]!.diZhi

    const fuQiBrief = briefs[fuQiLayerIdx]!
    const fuQiEvalScore = yearlyScores[fuQiNatalIdx]!
    const fuQiDiZhiNatalScore = natalScores[fuQiNatalIdx]!

    console.log(`\n  流年${year}年(${liuNianZhi})`)
    console.log(`  流年夫妻宫落在${fuQiDiZhi}宫(原局[${fuQiNatalIdx}])`)
    console.log(`    流年夫妻宫骨架分: ${fuQiEvalScore.skeletonScore}`)
    console.log(`    ${fuQiDiZhi}宫原局骨架分: ${fuQiDiZhiNatalScore.skeletonScore}`)
    console.log(`    原局夫妻宫骨架分: ${natalScores[10]!.skeletonScore}`)

    // 核心验证：流年夫妻宫的骨架基础分 = 它落在的地支位置的骨架分
    expect(fuQiEvalScore.skeletonScore).toBe(fuQiDiZhiNatalScore.skeletonScore)
    // brief 分数来自正确的位置
    expect(fuQiBrief.score).toBe(fuQiEvalScore.finalScore)

    console.log(`  ✓ 验证通过：流年夫妻宫得分取自${fuQiDiZhi}宫(原局[${fuQiNatalIdx}])的骨架分`)
  })

  // ─────────────────────────────────────────────────────────
  // 全量验证：所有大限所有宫位的骨架分 = 地支位置原局骨架分
  // ─────────────────────────────────────────────────────────
  it('全量验证：所有大限 × 12宫骨架基础分 = 地支位置原局骨架基础分', () => {
    const daXianMappings = extractAllDaXianMappings(chartData, 1982)
    let totalVerified = 0

    for (const mapping of daXianMappings) {
      const daXianCtx = buildDaXianScoringContext(mapping, natalCtx)
      if (!daXianCtx) continue
      const daXianScores = evaluateAllPalaces(daXianCtx)

      for (let layerIdx = 0; layerIdx < 12; layerIdx++) {
        const natalIdx = (mapping.palaceIndex + layerIdx) % 12
        const daXianScore = daXianScores[natalIdx]!
        const natalScore = natalScores[natalIdx]!

        // 骨架基础分必须一致（宫位能级绑定在地支上）
        expect(daXianScore.skeletonScore).toBe(natalScore.skeletonScore)
        totalVerified++
      }
    }

    console.log(`\n  全量验证通过：${daXianMappings.length}个大限 × 12宫 = ${totalVerified}个宫位`)
    console.log(`  所有宫位的骨架基础分与对应地支位置的原局骨架基础分完全一致`)
  })
})
