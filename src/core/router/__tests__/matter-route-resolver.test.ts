import { describe, it, expect } from 'vitest'
import { routeMatter } from '../decision-tree'
import { resolveMatterRoute } from '../matter-route-resolver'

describe('matter-route-resolver', () => {
  it('求健康默认兼看命宫（condition true）', () => {
    const route = routeMatter('求健康', {})
    expect(route.primaryPalace).toBe('疾厄')
    expect(route.secondaryPalaces).toContain('命宫')
  })

  it('从对话提取求财投资路由到福德', () => {
    const route = resolveMatterRoute('求财', '我想做股票期货投资赚钱')
    expect(route.primaryPalace).toBe('福德')
    expect(route.routingAnswers.wealth_1).toBe('invest')
  })

  it('求名技艺路由官禄 + 须看科星落位', () => {
    const route = resolveMatterRoute('求名', '靠专业技能成名')
    expect(route.primaryPalace).toBe('官禄')
    expect(route.routingAnswers.fame_1).toBe('skill')
    expect(route.specialConditions.some(c => c.includes('科星'))).toBe(true)
  })

  it('求名网络传播兼看迁移与太阳落位', () => {
    const route = resolveMatterRoute('求名', '做直播自媒体涨粉')
    expect(route.routingAnswers.fame_2).toBe('online')
    expect(route.secondaryPalaces).toContain('迁移')
    expect(route.specialConditions.some(c => c.includes('太阳'))).toBe(true)
  })

  it('partnerBirthYear 映射为 wealth_3b 并触发互动', () => {
    const route = resolveMatterRoute('求财', undefined, { wealth_3: 'partner', wealth_3a: 'lead' }, {
      partnerBirthYear: 1985,
    })
    expect(route.routingAnswers.wealth_3b).toBe('has')
    expect(route.needInteraction).toBe(true)
  })
})
