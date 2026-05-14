/**
 * 生成 1982-09-24 寅时（timeIndex=2）男命：iztro 与 Hybrid 读盘/Stage1 对比清单（Markdown）
 * 运行：pnpm exec vitest run src/lib/ziwei/hybrid/__tests__/chart-1982-comparison-dump.test.ts
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { astro } from 'iztro'
import { PALACE_NAMES } from '@/core/types'
import { readChartFromData } from '@/core/data-reader/iztro-reader'
import { serializeAstrolabeForReading } from '@/lib/ziwei/serialize-chart-for-reading'
import { executeStage1 } from '@/core/stages/stage1-palace-scoring'
import { classifyStar } from '@/core/data-reader/star-classifier'

const TIME_INDEX = 2

/** iztro 星曜 mutagen 多为「禄/权/科/忌」，与「化*」统一为短名便于对比 */
function normSihuaToken(m: string): string {
  const t = (m ?? '').trim().replace(/^化/, '')
  return ['禄', '权', '科', '忌'].includes(t) ? t : (m ?? '').trim()
}

function isSihuaMutagen(m: string | undefined): boolean {
  if (!m?.trim()) return false
  const t = normSihuaToken(m)
  return ['禄', '权', '科', '忌'].includes(t)
}

/** 与 `readChartFromData` 一致：仅 minor+adjective 中可被归入六吉/六煞/禄存/丙丁的星名集合 */
function hybridTrackedAuxFromIztroMinorAdj(p: {
  minorStars?: Array<{ name: string }>
  adjectiveStars?: Array<{ name: string }>
}): Set<string> {
  const s = new Set<string>()
  for (const x of [...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
    switch (classifyStar(x.name)) {
      case 'auspicious':
      case 'inauspicious':
      case 'minor':
        s.add(x.name)
        break
      case 'lucun':
        s.add('禄存')
        break
      default:
        break
    }
  }
  return s
}

function iztroOtherStarsInMinorAdj(p: {
  minorStars?: Array<{ name: string }>
  adjectiveStars?: Array<{ name: string }>
}): string[] {
  const out: string[] = []
  for (const x of [...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
    if (classifyStar(x.name) === 'other') out.push(x.name)
  }
  return [...new Set(out)].sort()
}

function starLine(
  stars: Array<{ name?: string; mutagen?: string; brightness?: string }> | undefined,
): string {
  if (!stars?.length) return '—'
  return stars
    .map(s => {
      const m = s.mutagen && String(s.mutagen).length ? `（${s.mutagen}）` : ''
      const b = s.brightness && String(s.brightness).length ? `[${s.brightness}]` : ''
      return `${s.name ?? ''}${b}${m}`
    })
    .join('；')
}

/** 主星：只比「星名 + 生年四化」，不比亮度字面（庙→极旺 为映射差异） */
function majorLogicKey(
  majors: Array<{ name?: string; mutagen?: string }> | undefined,
): string {
  if (!majors?.length) return ''
  return [...majors]
    .map(s => `${s.name ?? ''}|${(s.mutagen ?? '').trim()}`)
    .sort()
    .join(';')
}

function majorLogicKeyNorm(majors: Array<{ star: string; mutagen?: string }>): string {
  if (!majors.length) return ''
  return [...majors]
    .map(s => `${s.star}|${(s.mutagen ?? '').trim()}`)
    .sort()
    .join(';')
}

function auxNameSetFromNorm(np: {
  auspiciousStars: string[]
  inauspiciousStars: string[]
  hasLuCun: boolean
  minorStars: string[]
}): Set<string> {
  const s = new Set<string>()
  for (const x of np.auspiciousStars) s.add(x)
  for (const x of np.inauspiciousStars) s.add(x)
  for (const x of np.minorStars) s.add(x)
  if (np.hasLuCun) s.add('禄存')
  return s
}

function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

describe('1982 命盘对比清单生成', () => {
  it('写入 planfiles/chart-1982-hybrid-iztro-comparison.md', () => {
    const a = astro.bySolar('1982-9-24', TIME_INDEX, '男', true, 'zh-CN')
    const chart = serializeAstrolabeForReading(a, {
      year: 1982,
      month: 9,
      day: 24,
      hour: TIME_INDEX,
      gender: 'MALE',
      solar: true,
    })
    const norm = readChartFromData(chart)
    const s1 = executeStage1({ chartData: chart })
    const { mergedSihua } = s1

    const lines: string[] = []
    lines.push('# 阳历 1982-09-24 晨 4 点（寅时）男命 — iztro 与 Hybrid 取值对比清单')
    lines.push('')
    lines.push('> 说明：`timeIndex = 2` 对应 iztro `TIME_RANGE[2]`（03:00～05:00，寅时）。')
    lines.push('> **iztro**：`astro.bySolar` 原盘。**Hybrid**：序列化 → `readChartFromData` → `executeStage1`（四化）。')
    lines.push(
      '> **四化称谓**：本命第二层为 **太岁宫宫干四化**（太岁宫在生年地支，该宫宫干由五虎遁定，再取该干之天干四化）。**遁干四化**专指依**五虎遁所得天干**再论四化之法（与太岁宫宫干常为同一干，但以五虎遁立名）；**太岁入卦**所用者为**太岁宫宫干四化**（以太岁宫立名），二者不可混称。本清单仅本命盘，`mergedSihua.entries` 第二套来源为太岁宫宫干四化。',
    )
    lines.push('> **主星「逻辑一致」**：只比星名 + mutagen；亮度为 iztro「庙/旺」与 Hybrid「极旺/旺」映射，表中仍列全文。')
    lines.push(
      '> **辅星「集合一致」**：Hybrid 侧为六吉+六煞+禄存+丙丁；iztro 侧取同盘 `minorStars+adjectiveStars` 经 `classifyStar` 归入上述四类后的**期望集合**（与 `readChartFromData` 一致）。',
    )
    lines.push(
      '> **未展示**：`classifyStar` 为 `other` 的星（如八座、三台、天德等）在 Hybrid 标准化盘中**故意省略**，见下文「二补充」。',
    )
    lines.push('')

    lines.push('## 一、全局信息')
    lines.push('')
    lines.push('| 项目 | iztro | Hybrid（readChartFromData） | 一致 |')
    lines.push('|------|-------|------------------------------|------|')
    const globalRows: Array<[string, string, string]> = [
      ['阳历', String(a.solarDate ?? ''), norm.solarDate],
      ['性别', String(a.gender ?? ''), norm.gender],
      ['五行局', String(a.fiveElementsClass ?? ''), norm.fiveElementsClass],
      ['命主星 soul', String(a.soul ?? ''), norm.soulStar],
      ['身主星 body', String(a.body ?? ''), norm.bodyStar],
      ['命宫地支', String(a.earthlyBranchOfSoulPalace ?? ''), norm.mingGongZhi],
      ['身宫地支', String(a.earthlyBranchOfBodyPalace ?? ''), norm.shenGongZhi],
      ['生年天干（由阳历年推）', '—', norm.birthGan],
      ['生年地支（由阳历年推）', '—', norm.birthZhi],
      ['太岁宫地支（=生年地支）', '—', norm.taiSuiZhi],
      ['骨架号 skeletonId', '—', norm.skeletonId],
    ]
    for (const [k, iz, hy] of globalRows) {
      const ok = iz === '—' || iz === hy ? '✓' : '✗'
      lines.push(`| ${k} | ${iz} | ${hy} | ${ok} |`)
    }
    lines.push('')

    lines.push('## 二、十二宫')
    lines.push('')
    lines.push(
      '| 宫名 | 地支 iz | 地支 Hy | 天干 iz | 天干 Hy | 主星 iz（全文） | 主星 Hy（全文） | 主星逻辑一致 | 辅星 iz | 辅星 Hy | 辅星收录一致 |',
    )
    lines.push('|------|---------|---------|---------|---------|----------------|----------------|--------------|---------|---------|--------------|')

    let allPalaceOk = true
    for (const pname of PALACE_NAMES) {
      const ip = a.palaces.find((p: { name: string }) => p.name === pname) as {
        name: string
        earthlyBranch?: string
        heavenlyStem?: string
        majorStars?: Array<{ name: string; mutagen?: string; brightness?: string }>
        minorStars?: Array<{ name: string }>
        adjectiveStars?: Array<{ name: string }>
      }
      const np = norm.palaces.find(p => p.name === pname)
      expect(np).toBeDefined()

      const izBranch = String(ip?.earthlyBranch ?? '')
      const hyBranch = np!.diZhi
      const izStem = String(ip?.heavenlyStem ?? '')
      const hyStem = np!.tianGan

      const izMajFull = starLine(ip?.majorStars)
      const hyMajFull = np!.majorStars
        .map(s => `${s.star}${s.brightness ? `[${s.brightness}]` : ''}${s.mutagen ? `（${s.mutagen}）` : ''}`)
        .join('；') || '—'

      const majLogicOk =
        majorLogicKey(ip?.majorStars) === majorLogicKeyNorm(np!.majorStars)

      const izAuxFull = starLine([...(ip?.minorStars ?? []), ...(ip?.adjectiveStars ?? [])])
      const hyAuxFull = starLine([
        ...np!.auspiciousStars.map(n => ({ name: n })),
        ...np!.inauspiciousStars.map(n => ({ name: n })),
        ...(np!.hasLuCun ? [{ name: '禄存' }] : []),
        ...np!.minorStars.map(n => ({ name: n })),
      ])

      const expectedAux = hybridTrackedAuxFromIztroMinorAdj(ip)
      const auxOk = setEq(expectedAux, auxNameSetFromNorm(np!))

      const rowOk = izBranch === hyBranch && izStem === hyStem && majLogicOk && auxOk
      if (!rowOk) allPalaceOk = false

      lines.push(
        `| ${pname} | ${izBranch} | ${hyBranch} | ${izStem} | ${hyStem} | ${izMajFull} | ${hyMajFull} | ${majLogicOk ? '✓' : '✗'} | ${izAuxFull} | ${hyAuxFull} | ${auxOk ? '✓' : '✗'} |`,
      )
    }
    lines.push('')
    lines.push(`**十二宫（地支+天干+主星逻辑+辅星收录）全部一致**：${allPalaceOk ? '是' : '否'}`)
    lines.push('')

    lines.push('## 二补充：iztro 副曜中 Hybrid 不收录（`classifyStar` → other）')
    lines.push('')
    for (const pname of PALACE_NAMES) {
      const ip = a.palaces.find((p: { name: string }) => p.name === pname) as {
        minorStars?: Array<{ name: string }>
        adjectiveStars?: Array<{ name: string }>
      }
      const other = iztroOtherStarsInMinorAdj(ip)
      if (other.length) lines.push(`- **${pname}**：${other.join('、')}`)
    }
    lines.push('')

    const izSihuaKeys = new Set<string>()
    for (const p of a.palaces as Array<{
      name: string
      majorStars?: Array<{ name: string; mutagen?: string }>
      minorStars?: Array<{ name: string; mutagen?: string }>
      adjectiveStars?: Array<{ name: string; mutagen?: string }>
    }>) {
      for (const s of [...(p.majorStars ?? []), ...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
        if (!isSihuaMutagen(s.mutagen)) continue
        izSihuaKeys.add(`${p.name}|${s.name}|${normSihuaToken(s.mutagen!)}`)
      }
    }
    const hySihuaKeys = new Set<string>()
    for (const p of norm.palaces) {
      for (const ann of p.sihuaAnnotations) {
        if (!isSihuaMutagen(ann.type)) continue
        hySihuaKeys.add(`${p.name}|${ann.star}|${normSihuaToken(ann.type)}`)
      }
    }
    const sihuaPalaceStarOk = setEq(izSihuaKeys, hySihuaKeys)

    lines.push('## 三、四化')
    lines.push('')
    lines.push('### 3.1 iztro 盘面 mutagen（各宫星曜字段，含「禄/权/科/忌」）')
    lines.push('')
    const iztroMut: string[] = []
    for (const p of a.palaces as Array<{
      name: string
      majorStars?: Array<{ name: string; mutagen?: string }>
      minorStars?: Array<{ name: string; mutagen?: string }>
      adjectiveStars?: Array<{ name: string; mutagen?: string }>
    }>) {
      for (const s of [...(p.majorStars ?? []), ...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]) {
        const m = s.mutagen?.trim()
        if (m && isSihuaMutagen(m)) {
          iztroMut.push(`${p.name}：${s.name}（${m}）`)
        }
      }
    }
    lines.push(iztroMut.length ? iztroMut.map(x => `- ${x}`).join('\n') : '- （无）')
    lines.push('')
    lines.push('### 3.1b 各宫星曜四化：iztro 集合 vs Hybrid `sihuaAnnotations`（星名+化类，归一后）')
    lines.push('')
    lines.push(`**一致**：${sihuaPalaceStarOk ? '是' : '否'}`)
    lines.push('')
    if (!sihuaPalaceStarOk) {
      const onlyIz = [...izSihuaKeys].filter(k => !hySihuaKeys.has(k)).sort()
      const onlyHy = [...hySihuaKeys].filter(k => !izSihuaKeys.has(k)).sort()
      if (onlyIz.length) {
        lines.push('**仅在 iztro**：')
        lines.push('')
        for (const x of onlyIz) lines.push(`- ${x}`)
        lines.push('')
      }
      if (onlyHy.length) {
        lines.push('**仅在 Hybrid**：')
        lines.push('')
        for (const x of onlyHy) lines.push(`- ${x}`)
        lines.push('')
      }
    }

    lines.push('### 3.2 Hybrid — `mergedSihua`（Stage1）')
    lines.push('')
    lines.push('**生年四化**')
    lines.push('')
    lines.push('| 禄 | 权 | 科 | 忌 |')
    lines.push(`| ${mergedSihua.shengNian.禄} | ${mergedSihua.shengNian.权} | ${mergedSihua.shengNian.科} | ${mergedSihua.shengNian.忌} |`)
    lines.push('')
    lines.push('**太岁宫宫干四化**（宫干由生年干查五虎遁、取太岁宫地支列；再按该干查天干四化表）')
    lines.push('')
    lines.push('| 禄 | 权 | 科 | 忌 |')
    lines.push(`| ${mergedSihua.dunGan.禄} | ${mergedSihua.dunGan.权} | ${mergedSihua.dunGan.科} | ${mergedSihua.dunGan.忌} |`)
    lines.push('')
    lines.push('**展开 `entries`（全部）**')
    lines.push('')
    for (const e of mergedSihua.entries) {
      lines.push(`- ${e.type} **${e.star}**（${e.source}）`)
    }
    lines.push('')
    if (mergedSihua.specialOverlaps.length) {
      lines.push('**`specialOverlaps`**')
      lines.push('')
      for (const o of mergedSihua.specialOverlaps) {
        lines.push(`- ${o.type}：${o.star}`)
      }
      lines.push('')
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const outPath = path.resolve(__dirname, '../../../../../planfiles/chart-1982-hybrid-iztro-comparison.md')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8')

    expect(allPalaceOk).toBe(true)
    expect(sihuaPalaceStarOk).toBe(true)
  })
})
