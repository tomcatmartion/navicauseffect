import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getStarAttributes, getPalaceMeanings, getTaiSuiTables, getScoringParams } from '../loader'

const DATA_DIR = path.join(process.cwd(), 'data')

describe('JSON 与 KB 知识库一致性核验', () => {
  it('star_attributes.json 应包含14颗主星', () => {
    const data = getStarAttributes()
    const stars = Object.keys(data)
    expect(stars).toHaveLength(14)
    expect(stars).toContain('紫微')
    expect(stars).toContain('天府')
    expect(stars).toContain('天机')
    expect(stars).toContain('天同')
    expect(stars).toContain('太阳')
    expect(stars).toContain('太阴')
    expect(stars).toContain('武曲')
    expect(stars).toContain('天相')
    expect(stars).toContain('天梁')
    expect(stars).toContain('廉贞')
    expect(stars).toContain('贪狼')
    expect(stars).toContain('巨门')
    expect(stars).toContain('七杀')
    expect(stars).toContain('破军')

    // 验证每颗星都有核心字段（yinYang/category 为可选）
    for (const [name, attr] of Object.entries(data)) {
      expect(attr.element, `${name} 缺少 element`).toBeTruthy()
      expect(attr.positiveTrait, `${name} 缺少 positiveTrait`).toBeTruthy()
      expect(attr.negativeTrait, `${name} 缺少 negativeTrait`).toBeTruthy()
    }
  })

  it('palace_meanings.json 应包含12宫位', () => {
    const data = getPalaceMeanings()
    const palaces = Object.keys(data)
    expect(palaces).toHaveLength(12)
    expect(palaces).toContain('命宫')
    expect(palaces).toContain('兄弟')
    expect(palaces).toContain('夫妻')
    expect(palaces).toContain('子女')
    expect(palaces).toContain('财帛')
    expect(palaces).toContain('疾厄')
    expect(palaces).toContain('迁移')
    expect(palaces).toContain('仆役')
    expect(palaces).toContain('官禄')
    expect(palaces).toContain('田宅')
    expect(palaces).toContain('福德')
    expect(palaces).toContain('父母')
  })

  it('tai_sui_rua_gua_tables.json 应包含完整查表', () => {
    const tables = getTaiSuiTables()

    // 生年四化表
    expect(Object.keys(tables.shengNianSihua)).toHaveLength(10)
    expect(tables.shengNianSihua['甲']).toBeDefined()

    // 五虎遁干表
    expect(Object.keys(tables.wuHuDunGan)).toHaveLength(10)
    expect(tables.wuHuDunGan['甲']).toHaveLength(12)
    expect(tables.wuHuDunGan['甲'][0]).toBe('丙寅')
  })

  it('scoring_params.json 应包含完整评分参数', () => {
    const params = getScoringParams()

    // 吉星/煞星列表
    expect(params.jiStarNames).toHaveLength(6)
    expect(params.shaStarNames).toHaveLength(6)

    // 制煞等级
    expect(params.subdueLevel.strong).toContain('紫微')
    expect(params.subdueLevel.strong).toContain('天府')
    expect(params.subdueLevel.medium).toContain('太阳')
    expect(params.subdueLevel.weak).toContain('天机')

    // 固定衰减
    expect(params.fixedDecay.opposite).toBe(0.8)
    expect(params.fixedDecay.trine).toBe(0.7)

    // 加减分分值
    expect(params.jiStarScore).toBe(0.5)
    expect(params.shaStarScore).toBe(-0.5)

    // 禄存调整
    expect(params.luCunDelta['旺']).toBe(0.3)
    expect(params.luCunDelta['平']).toBe(0)
    expect(params.luCunDelta['陷']).toBe(-0.3)

    // 夹宫衰减矩阵
    expect(params.jiagongDecayMatrix).toBeDefined()
    expect(params.jiagongDecayMatrix['本宫旺']).toBeDefined()
    expect(params.jiagongDecayMatrix['本宫旺']['夹宫旺']).toBe(0.9)

    // 夹宫有效组合
    expect(params.jiagongValidPairs).toBeDefined()
    expect(params.jiagongValidPairs.pairs.length).toBeGreaterThan(0)
  })

  it('所有 JSON 文件应可解析', () => {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
      expect(() => JSON.parse(content), `${file} 解析失败`).not.toThrow()
    }
  })
})
