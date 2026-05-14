/**
 * 从 sysfiles/sysalldoc 的 KB MD 生成 / 更新 hybrid 数据 JSON（首版：太岁入卦表 → extra-stars.json）
 *
 * 用法：pnpm exec tsx scripts/sysalldoc-to-hybrid-json.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const KB_MD = path.join(ROOT, 'sysfiles/sysalldoc/KB_太岁入卦星曜直查表.md')
const OUT = path.join(ROOT, 'src/lib/ziwei/hybrid/data/extra-stars.json')

/** 极简 MD 表格行解析：| 子 | 咸池 | … | */
function parseMdTable(md: string): Record<string, Array<{ star: string; label: string }>> {
  const out: Record<string, Array<{ star: string; label: string }>> = {}
  const lines = md.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed
      .split('|')
      .map(c => c.trim())
      .filter(Boolean)
    if (cells.length < 2) continue
    const zhi = cells[0]
    if (!/^子|丑|寅|卯|辰|巳|午|未|申|酉|戌|亥$/.test(zhi)) continue
    const star = cells[1]
    if (!star || star === '地支' || star === '星曜') continue
    const label = cells[2] || '入卦'
    if (!out[zhi]) out[zhi] = []
    out[zhi].push({ star, label })
  }
  return out
}

function main() {
  if (!fs.existsSync(KB_MD)) {
    console.warn('[sysalldoc-to-hybrid-json] 跳过：未找到', KB_MD)
    process.exit(0)
  }
  const md = fs.readFileSync(KB_MD, 'utf8')
  const parsed = parseMdTable(md)
  if (Object.keys(parsed).length === 0) {
    console.warn('[sysalldoc-to-hybrid-json] 未解析到表格行，保留现有 JSON')
    process.exit(0)
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(parsed, null, 2), 'utf8')
  console.log('已写入', OUT)
}

main()
