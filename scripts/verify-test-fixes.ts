/**
 * 验证测试清单修复 —— 意图识别集成测试
 * 对照 20260611 测试文档的 P1（创业归类）与 P7（新排盘识别）
 */
import { detectMatterIntent } from '../src/core/router/decision-tree'
import { classify } from '../src/core/intent/classifier'
import type { IntentContext } from '../src/core/intent/types'

const emptyCtx: IntentContext = {
  currentMatterKey: null,
  currentQueryYear: null,
  knownMatterKeys: [],
  recentMessages: [],
  initialized: true,
}

interface Case {
  label: string
  input: string
  kind: 'intent' | 'classify'
  expect: string
  /** 反向断言：实际值不应等于此值（用于验证不误伤） */
  expectNot?: string
}
const cases: Case[] = [
  // —— P1：创业独立事项 ——
  { label: 'P1 创业', input: '今年创业如何', kind: 'intent', expect: '创业' },
  { label: 'P1 开店', input: '我想开店创业', kind: 'intent', expect: '创业' },
  { label: 'P1 自己干', input: '自己干怎么样', kind: 'intent', expect: '创业' },
  { label: 'P1 开公司', input: '准备开公司', kind: 'intent', expect: '创业' },
  // —— P1：不与求财/求职冲突 ——
  { label: 'P1 做生意→求财', input: '和朋友合伙做生意赚钱', kind: 'intent', expect: '求财' },
  { label: 'P1 事业→求职', input: '我事业怎么样', kind: 'intent', expect: '求职' },
  { label: 'P1 跳槽→求职', input: '我想跳槽', kind: 'intent', expect: '求职' },
  { label: 'P1 工作→求职', input: '最近工作不顺', kind: 'intent', expect: '求职' },
  // —— P7：新排盘意图（避免误判流年）——
  { label: 'P7 2001女孩', input: '你有一个2001年的女孩', kind: 'classify', expect: 'NEW_CHART' },
  { label: 'P7 1990的人', input: '帮我看个1990年的人', kind: 'classify', expect: 'NEW_CHART' },
  { label: 'P7 换命主', input: '换个命主看看', kind: 'classify', expect: 'NEW_CHART' },
  // —— 正常事项不被误判为新排盘 ——
  { label: '正常 财运', input: '我今年财运怎么样', kind: 'classify', expect: 'NEW_MATTER' },
  { label: '正常 事业', input: '我的事业发展如何', kind: 'classify', expect: 'NEW_MATTER' },
  // —— P7 反例：正则收紧后不误伤含「重新/新+人」的正常表达 ——
  { label: 'P7反例 重新认识人', input: '我想重新认识一些人扩大社交圈', kind: 'classify', expect: 'CHITCHAT', expectNot: 'NEW_CHART' },
  { label: 'P7反例 新年新气象', input: '新年新气象，希望人际关系更好', kind: 'classify', expect: 'CHITCHAT', expectNot: 'NEW_CHART' },
  { label: 'P7反例 重新做人', input: '我想重新做人改变自己', kind: 'classify', expect: 'CHITCHAT', expectNot: 'NEW_CHART' },
]

let pass = 0
let fail = 0
for (const c of cases) {
  let actual = ''
  if (c.kind === 'intent') {
    actual = detectMatterIntent(c.input) ?? '(null)'
  } else {
    actual = classify(c.input, emptyCtx).action
  }
  const ok = actual === c.expect
  const notOk = c.expectNot ? actual !== c.expectNot : true
  const finalOk = ok && notOk
  console.log(`${finalOk ? '✓' : '✗'} [${c.label}] "${c.input}" → ${actual}${finalOk ? '' : ` (期望 ${c.expect}${c.expectNot ? ` 且非 ${c.expectNot}` : ''})`}`)
  finalOk ? pass++ : fail++
}
console.log(`\n结果：${pass} 通过 / ${fail} 失败 / 共 ${cases.length} 项`)
if (fail > 0) process.exit(1)
