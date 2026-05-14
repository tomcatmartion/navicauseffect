/**
 * M7: LLM 表达层 — IR Schema 定义
 *
 * IR（中间表示）是计算层输出给 LLM 的标准化 JSON 结构。
 * LLM 只消费 IR，不修改 IR 内容。
 */

import type { IR, IRStage1, IRStage2, IRStage3or4 } from '../types'

/** IR 类型守卫 */
export function isIRStage1(ir: IR): ir is IRStage1 {
  return ir.stage === 1
}

export function isIRStage2(ir: IR): ir is IRStage2 {
  return ir.stage === 2
}

export function isIRStage3or4(ir: IR): ir is IRStage3or4 {
  return ir.stage === 3 || ir.stage === 4
}
