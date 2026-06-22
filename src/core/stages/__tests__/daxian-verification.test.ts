/**
 * 完整 IR 数据 dump — 1982-05-05 18:00 男命
 * 供人工排查数据全面性和准确性
 */
import { describe, it, expect } from 'vitest'
import { astro } from 'iztro'
import {
  serializeAstrolabeForReading,
  serializeHoroscopeForReading,
} from '@/lib/ziwei/serialize-chart-for-reading'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { executeStage2 } from '@/core/stages/stage2-personality'
import { buildChartSnapshot } from '@/core/llm-wrapper/prompt-builder'

describe('完整 IR 数据 dump — 1982-05-05 18:00 男', () => {
  const timeIndex = 9 // 酉时 17–19
  const targetYear = 2026

  // 1. iztro 排盘
  const astrolabe = astro.bySolar('1982-05-05', timeIndex, '男', true)
  const horoscope = astrolabe.horoscope(new Date(targetYear, 4, 5), timeIndex)
  const chartData = serializeAstrolabeForReading(
    astrolabe as unknown as Record<string, unknown>,
    { year: 1982, month: 5, day: 5, hour: 18, gender: '男', solar: true },
    {
      horoscope: serializeHoroscopeForReading(horoscope, targetYear),
      referenceYear: targetYear,
    },
  )

  // 2. 执行 Stage1 + Stage2
  const cd = chartData as unknown as Record<string, unknown>
  const stage1 = executeStage1({ chartData: cd })
  const stage2 = executeStage2({ stage1, question: '性格' })

  it('dump 全部数据', () => {
    console.log('\n')
    console.log('='.repeat(80))
    console.log('  完整 IR 数据 dump — 阳历 1982-05-05 18:00 男命')
    console.log('='.repeat(80))

    // ══════════════════════════════════════════════════════════════════
    // A. 基础信息
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【A. 基础信息】')
    console.log('  solarDate:', (cd as Record<string, unknown>).solarDate)
    console.log('  gender:', (cd as Record<string, unknown>).gender)
    console.log('  fiveElementsClass:', (cd as Record<string, unknown>).fiveElementsClass)
    console.log('  soul:', (cd as Record<string, unknown>).soul)
    console.log('  body:', (cd as Record<string, unknown>).body)
    console.log('  zodiac:', (cd as Record<string, unknown>).zodiac)
    console.log('  chineseDate:', (cd as Record<string, unknown>).chineseDate)
    console.log('  birthGan:', (cd as Record<string, unknown>).birthGan)
    console.log('  taiSuiZhi:', (cd as Record<string, unknown>).taiSuiZhi)
    console.log('  scoringCtx.birthGan:', stage1.scoringCtx.birthGan)
    console.log('  scoringCtx.taiSuiZhi:', stage1.scoringCtx.taiSuiZhi)
    console.log('  scoringCtx.shenGongIndex:', stage1.scoringCtx.shenGongIndex)
    console.log('  hasParentInfo:', stage1.hasParentInfo)

    // ══════════════════════════════════════════════════════════════════
    // B. 原局十二宫 — iztro 原始数据（palaces）
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【B. 原局十二宫 — iztro 原始数据】')
    const palaces = (cd as Record<string, unknown>).palaces as Array<Record<string, unknown>>
    for (const p of palaces) {
      const name = p.name
      const diZhi = p.earthlyBranch
      const isBody = p.isBodyPalace
      const majorStars = (p.majorStars as Array<Record<string, unknown>>)?.map(s => {
        const mutagen = s.mutagen ? `[${s.mutagen}]` : ''
        return `${s.name}(${s.brightness})${mutagen}`
      }).join('、') || '空'
      const minorStars = (p.minorStars as Array<Record<string, unknown>>)?.map(s => s.name).join('、') || ''
      const adjStars = (p.adjectiveStars as Array<Record<string, unknown>>)?.map(s => s.name).join('、') || ''
      const extra = [minorStars, adjStars].filter(Boolean).join('、')
      const dec = p.decadal as { range?: [number, number]; heavenlyStem?: string } | undefined
      const decLine = dec?.range ? ` | 大限${dec.range[0]}-${dec.range[1]}岁 宫干${dec.heavenlyStem}` : ''
      const bodyMark = isBody ? ' [身宫]' : ''
      console.log(`  ${String(name).padEnd(4)}(${diZhi}): ${majorStars}${extra ? '；' + extra : ''}${bodyMark}${decLine}`)
    }

    // ══════════════════════════════════════════════════════════════════
    // C. 原局十二宫评分（Stage1 输出）
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【C. 原局十二宫评分（Stage1 输出）】')
    for (const p of stage1.palaceScores) {
      const stars = p.majorStars.map(s => `${s.star}(${s.brightness})${(s as { sihua?: string }).sihua ? `[${(s as { sihua?: string }).sihua}]` : ''}`).join(' ')
      const patterns = p.patterns.map(pt => `${pt.name}(${pt.level})×${pt.multiplier}`).join('、') || '无'
      const flanking = (p.flankingPairs ?? []).map(fp =>
        `${fp.displayName}[${fp.pairType}] ${fp.leftLabel}↔${fp.rightLabel} 衰减×${fp.decay.toFixed(2)}${fp.sameSourceLabel ? ' 同源' : ' 异源'}`
      ).join('；') || '无'
      console.log(`  ${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} | ${p.tone} | 主星: ${stars || '空'}`)
      console.log(`    格局: ${patterns} | 夹宫: ${flanking}`)
    }

    // ══════════════════════════════════════════════════════════════════
    // D. 原局四化
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【D. 原局四化】')
    const ms = stage1.mergedSihua
    console.log('  生年四化:', JSON.stringify(ms.shengNian))
    console.log('  太岁宫宫干四化:', JSON.stringify(ms.dunGan))
    console.log('  四化条目:')
    for (const e of ms.entries) {
      console.log(`    ${e.type}${e.star}（来源：${e.source}）`)
    }
    console.log('  特殊叠加:')
    for (const o of ms.specialOverlaps) {
      console.log(`    ${o.type}: ${o.star}`)
    }
    console.log('  四化落宫标注:')
    for (const a of ms.palaceAnnotations) {
      if (a.annotations.length > 0) {
        const ann = a.annotations.map(x => `${x.type}${x.star}(${x.source})`).join('、')
        console.log(`    ${a.palaceName}(${a.diZhi}): ${ann}`)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // E. 格局
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【E. 格局】')
    for (const p of stage1.allPatterns) {
      console.log(`  ${p.name} | 级别: ${p.level} | 乘数: ${p.multiplier} | 范围: ${(p as { scope?: string }).scope ?? '-'} | 锚定宫: ${(p as { anchorPalace?: string }).anchorPalace ?? '-'}`)
    }
    if (stage1.allPatterns.length === 0) console.log('  无')

    // ══════════════════════════════════════════════════════════════════
    // F. 全量大限评分
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【F. 全量大限评分】')
    console.log(`  大限总数: ${stage1.allDaXianSummary?.length ?? 0}`)
    console.log(`  当前大限: ${stage1.currentDaXian ? `第${stage1.currentDaXian.index}大限（${stage1.currentDaXian.ageRange}）` : '未识别'}`)

    if (stage1.allDaXianSummary) {
      for (const d of stage1.allDaXianSummary) {
        const marker = d.isCurrent ? ' ★当前' : ''
        console.log(`\n  ── 第${d.index}大限 ${d.ageRange}岁 | 宫干${d.daXianGan} | 命宫→${d.mingPalaceName}${marker} ──`)
        console.log(`    四化: ${d.sihuaStars.join('、')}`)
        console.log(`    格局: ${d.topPatterns.join('、') || '无'}`)
        if (d.palaceScores.length) {
          for (const p of d.palaceScores) {
            console.log(`    ${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} | ${p.tone}`)
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // G. 当前大限详情
    // ══════════════════════════════════════════════════════════════════
    if (stage1.currentDaXian) {
      const c = stage1.currentDaXian
      console.log('\n【G. 当前大限详情】')
      console.log(`  第${c.index}大限（${c.ageRange}）`)
      console.log(`  宫干: ${c.daXianGan}`)
      console.log(`  大限命宫: ${c.mingPalaceName}`)
      console.log(`  四化: ${c.sihuaPositions.join('、')}`)
      console.log(`  定性: ${c.tone}`)
      console.log(`  十二宫评分:`)
      const sorted = [...c.palaceScores].sort((a, b) => b.finalScore - a.finalScore)
      for (const p of sorted) {
        console.log(`    ${p.palace}(${p.diZhi}): ${p.finalScore.toFixed(1)} | ${p.tone}`)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // H. Stage2 性格分析
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【H. Stage2 性格分析】')
    console.log('  命宫标签:', JSON.stringify(stage2.mingGongTags, null, 2))
    console.log('  身宫标签:', JSON.stringify(stage2.shenGongTags, null, 2))
    console.log('  太岁宫标签:', JSON.stringify(stage2.taiSuiTags, null, 2))
    console.log('  整体基调:', stage2.overallTone)
    console.log('  命宫全息底色:', JSON.stringify(stage2.mingGongHolographic, null, 2))
    if (stage2.personalityTriad) {
      console.log('  性格三宫合成:', stage2.personalityTriad.synthesis)
      console.log('  命宫层:', JSON.stringify(stage2.personalityTriad.mingLayer, null, 2))
      console.log('  身宫层:', JSON.stringify(stage2.personalityTriad.shenLayer, null, 2))
      console.log('  太岁宫层:', JSON.stringify(stage2.personalityTriad.taiSuiLayer, null, 2))
    }

    // ══════════════════════════════════════════════════════════════════
    // I. 知识片段
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【I. 知识片段（Stage1 + Stage2 合计）】')
    const allSnippets = [...stage1.knowledgeSnippets, ...stage2.knowledgeSnippets]
    for (const s of allSnippets) {
      console.log(`  [${s.source}] ${s.key}: ${s.content.slice(0, 120)}${s.content.length > 120 ? '...' : ''}`)
    }
    console.log(`  知识片段总数: ${allSnippets.length}`)

    // J 节：buildIRContext 未导出，跳过（数据已在 C-G 节完整展示）

    // ══════════════════════════════════════════════════════════════════
    // K. 命盘快照
    // ══════════════════════════════════════════════════════════════════
    console.log('\n【K. 命盘快照（buildChartSnapshot 输出）】')
    const snapshot = buildChartSnapshot(cd as Parameters<typeof buildChartSnapshot>[0], {
      birthGan: stage1.scoringCtx.birthGan,
      taiSuiZhi: stage1.scoringCtx.taiSuiZhi,
    })
    console.log(snapshot)

    console.log('\n' + '='.repeat(80))
    console.log('  DUMP 结束')
    console.log('='.repeat(80) + '\n')

    // 基本断言确保数据不为空
    expect(stage1.palaceScores).toHaveLength(12)
    expect(stage1.allDaXianSummary!.length).toBeGreaterThan(0)
    expect(stage1.currentDaXian).toBeDefined()
    expect(stage1.mergedSihua.entries.length).toBeGreaterThan(0)
    expect(stage1.knowledgeSnippets.length).toBeGreaterThan(0)
    expect(stage2.mingGongTags.summary).toBeTruthy()
  })
})
