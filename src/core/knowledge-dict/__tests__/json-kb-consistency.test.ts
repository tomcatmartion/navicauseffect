import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getStarAttributes, getPalaceMeanings, getTaiSuiTables, getScoringParams, getLimitDirection, getPersonalityTriad, getSihuaTriggerRules } from '../loader'

const DATA_DIR = path.join(process.cwd(), 'data')

describe('JSON 与 KB 知识库一致性核验', () => {
  it('star_system.json 应包含14颗主星及辅星', () => {
    const data = getStarAttributes()
    const stars = Object.keys(data)
    // 合并后的 star_system.json 包含14主星+六吉星+六煞星+其他辅星
    expect(stars.length).toBeGreaterThanOrEqual(14)
    // 必须包含14主星
    const majorStars = ['紫微', '天府', '天机', '天同', '太阳', '太阴', '武曲', '天相', '天梁', '廉贞', '贪狼', '巨门', '七杀', '破军']
    for (const star of majorStars) {
      expect(stars).toContain(star)
    }

    // 验证每颗星都有核心字段（四化星可能没有element，但必须有coreTrait/positiveTrait/negativeTrait）
    for (const [name, attr] of Object.entries(data)) {
      // element 对四化星是可选的
      if (attr.element !== undefined) {
        expect(attr.element, `${name} 缺少 element`).toBeTruthy()
      }
      expect(attr.positiveTrait, `${name} 缺少 positiveTrait`).toBeTruthy()
      expect(attr.negativeTrait, `${name} 缺少 negativeTrait`).toBeTruthy()
    }
  })

  it('palace_system.json 应包含12宫位', () => {
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

  it('scoring.json 应包含完整评分参数', () => {
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
    expect(params.luCunDelta['旺']).toBe(0.5)
    expect(params.luCunDelta['平']).toBe(0.3)
    expect(params.luCunDelta['陷']).toBe(0.1)

    // 夹宫衰减矩阵
    expect(params.jiagongDecayMatrix).toBeDefined()
    expect(params.jiagongDecayMatrix['本宫旺']).toBeDefined()
    expect(params.jiagongDecayMatrix['本宫旺']['夹宫旺']).toBe(0.9)

    // 夹宫有效组合
    expect(params.jiagongValidPairs).toBeDefined()
    expect(params.jiagongValidPairs.pairs.length).toBeGreaterThan(0)
  })

  it('limit_direction.json 应包含完整限运配置', () => {
    const cfg = getLimitDirection()
    expect(cfg.version).toBeTruthy()
    expect(Object.keys(cfg.matterTypeMappings)).toHaveLength(6)
    expect(cfg.timeAnalysis.directionJudgment.matrix['吉◇吉']).toBeDefined()
    expect(cfg.innateLevelMap.levels['实旺']).toBeDefined()
    expect(cfg.daXianQualitative.levels['顺畅期']).toBeDefined()
    expect(cfg.liuNianTimeWindow.windows['推进窗口']).toBeDefined()
    expect(cfg.compositeScoring.formula['命宫调节系数']).toBeDefined()
    expect(cfg.causalChainTemplates?.['吉吉']).toBeTruthy()
    expect(cfg.matrixStressValues?.['凶凶']).toBe(5)
    expect(cfg.resilienceThresholds?.crisis).toBe(3)
    expect(cfg.luluJiFlowTemplates?.pattern).toContain('{{primary}}')
  })

  it('personality_triad.json 应包含三宫性格规则', () => {
    const cfg = getPersonalityTriad()
    expect(cfg.version).toBeTruthy()
    expect(cfg.layers['命宫']).toBeDefined()
    expect(cfg.layers['身宫']).toBeDefined()
    expect(cfg.layers['太岁宫']).toBeDefined()
    expect(cfg.temperament_base.rules.length).toBeGreaterThanOrEqual(5)
    expect(cfg.star_yin_yang.阳星.length).toBeGreaterThan(0)
    expect(cfg.synthesis_priority.template).toContain('{命宫描述}')
  })

  it('router.json 应包含 6 事项分支且问答链可达 result', () => {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'router.json'), 'utf-8')
    const tree = JSON.parse(raw) as {
      branches: Record<
        string,
        {
          pre_analysis?: { type: string; source: string }
          firstQuestion: string
          questions: Record<string, { options: Array<{ next: string }> }>
          resolver: Record<string, unknown>
        }
      >
      intentDetection: Array<{ keywords: string[]; type: string }>
      intentPriorities?: Record<string, number>
    }

    const matterTypes = ['求学', '求爱', '求财', '求职', '求健康', '求名']
    expect(Object.keys(tree.branches).sort()).toEqual([...matterTypes].sort())

    const validPalaces = [
      '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母',
    ]

    for (const matterType of matterTypes) {
      const branch = tree.branches[matterType]
      expect(branch.pre_analysis?.type, matterType).toBe('personality')
      expect(branch.pre_analysis?.source, matterType).toBe('personality_triad.json')
      expect(branch.resolver, matterType).toBeDefined()

      const questions = branch.questions
      const visited = new Set<string>()
      let cursor: string | 'result' = branch.firstQuestion
      while (cursor !== 'result') {
        expect(questions[cursor], `${matterType} 缺失问题 ${cursor}`).toBeDefined()
        if (visited.has(cursor)) break
        visited.add(cursor)
        const firstOpt = questions[cursor].options[0]
        cursor = firstOpt.next as string | 'result'
      }

      const resolverJson = JSON.stringify(branch.resolver)
      for (const palace of validPalaces) {
        if (resolverJson.includes(`"${palace}"`)) {
          expect(validPalaces, `${matterType} resolver 含未知宫位 ${palace}`).toContain(palace)
        }
      }
    }

    const intentTypes = tree.intentDetection.map(r => r.type)
    expect(intentTypes).toContain('性格分析')
    expect(intentTypes).toContain('互动关系')
    expect(intentTypes).toContain('综合')
    expect(tree.intentPriorities?.['求职']).toBe(100)
    expect(tree.intentPriorities?.['互动关系']).toBeGreaterThan(0)
  })

  it('innateLevelMap 分数区间不应重叠', () => {
    const levels = getLimitDirection().innateLevelMap.levels
    const ranges = Object.values(levels).map(l => l.scoreRange)
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const [a0, a1] = ranges[i]
        const [b0, b1] = ranges[j]
        const overlap = a0 <= b1 && b0 <= a1
        expect(overlap, `区间重叠: ${ranges[i]} vs ${ranges[j]}`).toBe(false)
      }
    }
  })

  it('sihua_trigger_rules.json 应包含引动效果模板与空间权重', () => {
    const raw = getSihuaTriggerRules() as Record<string, unknown>
    const rules = (raw['rules'] ?? raw) as Record<string, unknown>
    const templates = rules['引动效果模板'] as Record<string, Record<string, string>>
    const assessment = rules['影响评估'] as Record<string, unknown>
    const weights = assessment?.['效果权重'] as Record<string, number>
    expect(templates).toBeTruthy()
    expect(weights).toBeTruthy()
    const types = ['禄', '权', '科', '忌'] as const
    const relations = ['本宫', '对宫', '三合', '双夹'] as const
    for (const type of types) {
      expect(templates[type], `缺少 ${type} 模板`).toBeTruthy()
      for (const relation of relations) {
        expect(templates[type][relation], `${type}/${relation} 模板缺失`).toBeTruthy()
      }
    }
    for (const relation of relations) {
      expect(typeof weights[relation]).toBe('number')
    }
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
