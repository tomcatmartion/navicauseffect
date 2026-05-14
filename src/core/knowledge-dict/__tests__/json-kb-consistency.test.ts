import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getStarAttributes, getPalaceMeanings, getTaiSuiTables, getAstroRules } from '../loader'

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

    // 验证每颗星都有完整字段
    for (const [name, attr] of Object.entries(data)) {
      expect(attr.element, `${name} 缺少 element`).toBeTruthy()
      expect(attr.coreTrait, `${name} 缺少 coreTrait`).toBeTruthy()
      expect(attr.positiveTrait, `${name} 缺少 positiveTrait`).toBeTruthy()
      expect(attr.negativeTrait, `${name} 缺少 negativeTrait`).toBeTruthy()
      expect(attr.specialNote, `${name} 缺少 specialNote`).toBeTruthy()
    }
  })

  it('palace_meanings.json 应包含12宫', () => {
    const data = getPalaceMeanings()
    const palaces = Object.keys(data)
    expect(palaces).toHaveLength(12)
    expect(palaces).toContain('命宫')
    expect(palaces).toContain('父母')
    expect(palaces).toContain('福德')
    expect(palaces).toContain('田宅')
    expect(palaces).toContain('官禄')
    expect(palaces).toContain('仆役')
    expect(palaces).toContain('迁移')
    expect(palaces).toContain('疾厄')
    expect(palaces).toContain('财帛')
    expect(palaces).toContain('子女')
    expect(palaces).toContain('夫妻')
    expect(palaces).toContain('兄弟')

    // 验证每宫都有完整字段
    for (const [name, meaning] of Object.entries(data)) {
      expect(meaning.meaning, `${name} 缺少 meaning`).toBeTruthy()
      expect(meaning.domains, `${name} 缺少 domains`).toBeInstanceOf(Array)
      expect(meaning.domains.length, `${name} domains 为空`).toBeGreaterThan(0)
      expect(meaning.modernContext, `${name} 缺少 modernContext`).toBeTruthy()
    }
  })

  it('tai_sui_rua_gua_tables.json 应包含完整查表', () => {
    const tables = getTaiSuiTables()

    // 生年四化：10个天干
    expect(Object.keys(tables.shengNianSihua)).toHaveLength(10)
    expect(tables.shengNianSihua['甲']).toEqual({ lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' })
    expect(tables.shengNianSihua['癸']).toEqual({ lu: '破军', quan: '巨门', ke: '太阳', ji: '贪狼' })

    // 禄存羊陀：10个天干
    expect(Object.keys(tables.luCunYangTuo)).toHaveLength(10)
    expect(tables.luCunYangTuo['甲']).toEqual({ luCun: '寅', qingYang: '卯', tuoLuo: '丑' })

    // 天魁天钺：10个天干
    expect(Object.keys(tables.tianKuiYue)).toHaveLength(10)
    expect(tables.tianKuiYue['甲']).toEqual({ tianKui: '丑', tianYue: '未' })

    // 红鸾天喜：12个地支
    expect(Object.keys(tables.hongLuanTianXi)).toHaveLength(12)
    expect(tables.hongLuanTianXi['子']).toEqual({ hongLuan: '卯', tianXi: '酉' })

    // 五虎遁：10个天干，每个12个干支
    expect(Object.keys(tables.wuHuDunGan)).toHaveLength(10)
    expect(tables.wuHuDunGan['甲']).toHaveLength(12)
    expect(tables.wuHuDunGan['甲'][0]).toBe('丙寅')
  })

  it('astro_rules.json 应包含完整规则', () => {
    const rules = getAstroRules()

    expect(rules.auspiciousStars).toHaveLength(6)
    expect(rules.inauspiciousStars).toHaveLength(6)

    expect(rules.subdueLevels.strong).toContain('紫微')
    expect(rules.subdueLevels.strong).toContain('天府')
    expect(rules.subdueLevels.medium).toContain('太阳')
    expect(rules.subdueLevels.weak).toContain('天机')

    expect(rules.fixedDecay.opposite).toBe(0.8)
    expect(rules.fixedDecay.trine).toBe(0.7)

    expect(rules.auspiciousScore).toBe(0.5)
    expect(rules.inauspiciousScore).toBe(-0.5)
  })

  it('JSON 文件应与 KB 知识库内容一致（紫微示例）', () => {
    const data = getStarAttributes()
    const ziwei = data['紫微']

    // 对比 KB_星曜赋性与事项分类知识库.md 中的紫微描述
    expect(ziwei.element).toBe('阴土')
    expect(ziwei.coreTrait).toContain('至尊帝座')
    expect(ziwei.positiveTrait).toContain('领袖群伦')
    expect(ziwei.negativeTrait).toContain('孤君独断')
    expect(ziwei.specialNote).toContain('化权')
  })

  it('JSON 文件应与 KB 知识库内容一致（命宫示例）', () => {
    const data = getPalaceMeanings()
    const ming = data['命宫']

    // 对比 KB_事项宫位知识库.md 中的命宫描述
    expect(ming.meaning).toContain('终身显现')
    expect(ming.domains).toContain('外在表现')
    expect(ming.modernContext).toContain('个人品牌')
  })

  it('热加载机制应正常工作', () => {
    // 第一次加载
    const data1 = getStarAttributes()
    expect(data1['紫微'].element).toBe('阴土')

    // 修改文件
    const filePath = path.join(DATA_DIR, 'star_attributes.json')
    const original = fs.readFileSync(filePath, 'utf-8')
    const modified = original.replace('阴土', '阴土-test')
    fs.writeFileSync(filePath, modified)

    // 第二次加载应返回新数据
    const data2 = getStarAttributes()
    expect(data2['紫微'].element).toBe('阴土-test')

    // 恢复原始文件
    fs.writeFileSync(filePath, original)

    // 第三次加载应返回原始数据
    const data3 = getStarAttributes()
    expect(data3['紫微'].element).toBe('阴土')
  })
})
