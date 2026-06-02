import { describe, it, expect } from 'vitest'
import { detectMatterIntent } from '../decision-tree'

describe('detectMatterIntent + intentPriorities', () => {
  it('多关键词命中时按 router.json 优先级取最高', () => {
    // 求职(100) > 求财(90)
    expect(detectMatterIntent('想换工作顺便多赚点钱')).toBe('求职')
  })

  it('合伙/合作类优先互动关系或求财（互动 85 < 求财 90 时取求财）', () => {
    expect(detectMatterIntent('和朋友合伙做生意赚钱')).toBe('求财')
  })

  it('纯互动关键词应识别为互动关系', () => {
    expect(detectMatterIntent('我和他的相处模式怎么样')).toBe('互动关系')
  })

  it('爱侣关键词仍优先求爱', () => {
    expect(detectMatterIntent('我和男朋友相处有问题')).toBe('求爱')
  })
})
