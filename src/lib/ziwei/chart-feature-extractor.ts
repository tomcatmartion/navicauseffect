/**
 * 命盘特征提取器（Chart Feature Extractor）
 *
 * 核心功能：根据命盘数据和求测领域，生成确定性的查询任务清单
 * 使用固定的三方四正映射表，确保紫微斗数核心原则正确执行
 */
import 'server-only'
import type { QueryTask, Domain } from '@/skills/types'

// ═══════════════════════════════════════════════════════════════════
// 十二宫三方四正关系表（固定映射）
// 本表根据紫微斗数核心原则制定，不可随意修改
// ═══════════════════════════════════════════════════════════════════
const PALACE_RELATIONS: Record<string, {
  opposite: string    // 对宫
  tripleHarmony: string[]  // 三合宫
}> = {
  '命宫':   { opposite: '迁移宫', tripleHarmony: ['兄弟宫', '官禄宫'] },
  '兄弟宫': { opposite: '仆役宫', tripleHarmony: ['命宫',   '疾厄宫'] },
  '夫妻宫': { opposite: '官禄宫', tripleHarmony: ['子女宫', '父母宫'] },
  '子女宫': { opposite: '父母宫', tripleHarmony: ['夫妻宫', '福德宫'] },
  '财帛宫': { opposite: '田宅宫', tripleHarmony: ['子女宫', '福德宫'] },
  '疾厄宫': { opposite: '仆役宫', tripleHarmony: ['兄弟宫', '迁移宫'] },
  '迁移宫': { opposite: '命宫',   tripleHarmony: ['疾厄宫', '仆役宫'] },
  '仆役宫': { opposite: '兄弟宫', tripleHarmony: ['疾厄宫', '迁移宫'] },
  '官禄宫': { opposite: '夫妻宫', tripleHarmony: ['命宫',   '财帛宫'] },
  '田宅宫': { opposite: '财帛宫', tripleHarmony: ['福德宫', '父母宫'] },
  '福德宫': { opposite: '疾厄宫', tripleHarmony: ['财帛宫', '田宅宫'] },
  '父母宫': { opposite: '子女宫', tripleHarmony: ['夫妻宫', '田宅宫'] },
}

// ═══════════════════════════════════════════════════════════════════
// 领域 → 核心宫位
// ═══════════════════════════════════════════════════════════════════
const DOMAIN_CORE_PALACES: Record<string, string[]> = {
  '财运':    ['财帛宫', '官禄宫', '福德宫', '田宅宫'],
  '事业':    ['官禄宫', '命宫', '迁移宫'],
  '感情':    ['夫妻宫', '命宫', '福德宫'],
  '健康':    ['疾厄宫', '命宫'],
  '六亲':    ['迁移宫', '父母宫', '兄弟宫', '仆役宫'],
  '子女':    ['子女宫', '命宫'],
  '学业':    ['官禄宫', '命宫', '父母宫'],
  '出行':    ['迁移宫', '疾厄宫'],
  '人生境遇': ['命宫', '福德宫', '官禄宫', '迁移宫'],
}

// ═══════════════════════════════════════════════════════════════════
// 只有财运、感情、健康需要展开完整三方四正
// 其他领域只展开对宫（避免查询过多）
// ═══════════════════════════════════════════════════════════════════
const FULL_TRIPLE_DOMAINS = new Set(['财运', '感情', '健康'])

// ═══════════════════════════════════════════════════════════════════
// 十四主星名称
// ═══════════════════════════════════════════════════════════════════
const MAJOR_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
  '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'
]

// ═══════════════════════════════════════════════════════════════════
// 四化名称
// ═══════════════════════════════════════════════════════════════════
const SIHUA_NAMES = ['化禄', '化权', '化科', '化忌']

// ═══════════════════════════════════════════════════════════════════
// iztro 命盘数据结构（简化版）
// ═══════════════════════════════════════════════════════════════════
interface IztroPalace {
  name: string
  majorStars: Array<{ name: string; mutagen?: string; type?: string }>
  minorStars?: Array<{ name: string; mutagen?: string }>
}

interface IztroChartData {
  palaces?: IztroPalace[]
  name?: string
  gender?: string
  soul?: string
  body?: string
  fiveElementsClass?: string
  [key: string]: unknown
}

// ═══════════════════════════════════════════════════════════════════
// 核心函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 展开核心宫位到完整的三方四正
 * @param corePalaces 核心宫位数组
 * @param domain 领域
 * @returns 完整宫位数组
 */
function expandToSanFang(corePalaces: string[], domain: string): string[] {
  const result = new Set<string>()
  const fullTriple = FULL_TRIPLE_DOMAINS.has(domain)

  for (const palace of corePalaces) {
    result.add(palace)  // 本宫

    const rel = PALACE_RELATIONS[palace]
    if (!rel) continue

    result.add(rel.opposite)  // 对宫（必加）

    if (fullTriple) {
      // 只有财运、感情、健康才展开三合宫
      rel.tripleHarmony.forEach(p => result.add(p))
    }
  }

  return [...result]
}

/**
 * 从命盘 JSON 中查找指定宫位
 */
function findPalaceInChart(
  chartData: IztroChartData,
  palaceName: string
): IztroPalace | null {
  const palaces = chartData.palaces
  if (!palaces) return null
  return palaces.find(p => p.name === palaceName) ?? null
}

/**
 * 检测命盘中的格局
 * TODO: 根据 iztro 实际 JSON 结构完善格局检测
 */
function detectPatternsFromChart(chartData: IztroChartData): string[] {
  const patterns: string[] = []
  const palaces = chartData.palaces ?? []

  for (const palace of palaces) {
    const starNames = palace.majorStars?.map(s => s.name) ?? []

    // 禄马交驰格：禄存+天马同宫
    if (starNames.includes('禄存') && starNames.includes('天马')) {
      patterns.push('禄马交驰格')
    }

    // 紫微七杀格：紫微+七杀同宫
    if (starNames.includes('紫微') && starNames.includes('七杀')) {
      patterns.push('紫微七杀格')
    }

    // 机月同梁格（简化判断）
    const hasAllFour = ['天机', '太阴', '天同', '天梁'].every(s => {
      return palaces.some(p => p.majorStars?.some(ms => ms.name === s))
    })
    if (hasAllFour) {
      patterns.push('机月同梁格')
    }
  }

  return [...new Set(patterns)]
}

// ═══════════════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 生成确定性查询任务清单
 *
 * 核心算法：
 * 1. 根据领域确定核心宫位
 * 2. 核心宫位展开三方四正（财运/感情/健康展开完整，其他只展开对宫）
 * 3. 命宫始终加入
 * 4. 遍历每个宫位，提取星曜+四化
 * 5. 检测格局
 *
 * @param chartData iztro 命盘 JSON 数据
 * @param domain 求测领域
 * @returns QueryTask[] 查询任务清单
 */
export function extractQueryTasks(
  chartData: IztroChartData,
  domain: string
): QueryTask[] {
  const tasks: QueryTask[] = []
  const addedKeys = new Set<string>()

  function addTask(task: QueryTask): void {
    const key = `${task.category}:${task.name}:${task.subKey ?? ''}`
    if (!addedKeys.has(key)) {
      addedKeys.add(key)
      tasks.push(task)
    }
  }

  // 1. 核心宫位 + 三方四正展开
  const corePalaces = DOMAIN_CORE_PALACES[domain] ?? ['命宫']

  // 命宫始终加入
  const allPalaces = [...new Set(['命宫', ...expandToSanFang(corePalaces, domain)])]

  // 2. 遍历所有宫位
  for (const palaceName of allPalaces) {
    // 宫位本身的知识（含领域规则）
    addTask({ category: 'palaces', name: palaceName, subKey: domain })

    const palace = findPalaceInChart(chartData, palaceName)
    if (!palace) continue

    // 3. 提取主星及其四化
    const majorStars = palace.majorStars ?? []

    for (const star of majorStars) {
      const starName = star.name

      // 星曜基本性质（每个星只查一次）
      addTask({ category: 'stars', name: starName })

      // 星曜在该宫的专项
      addTask({ category: 'stars', name: starName, subKey: palaceName })

      // 四化信息
      if (star.mutagen && SIHUA_NAMES.includes(star.mutagen)) {
        // 该星曜的四化解释
        addTask({ category: 'stars', name: starName, subKey: star.mutagen })

        // 该四化入该宫
        addTask({ category: 'sihua', name: star.mutagen, subKey: palaceName })
      }
    }

    // 4. 检查辅星中的四化
    const minorStars = palace.minorStars ?? []
    for (const star of minorStars) {
      if (star.mutagen && SIHUA_NAMES.includes(star.mutagen)) {
        addTask({ category: 'sihua', name: star.mutagen, subKey: palaceName })
      }
    }
  }

  // 5. 检测格局
  const detectedPatterns = detectPatternsFromChart(chartData)
  for (const pattern of detectedPatterns) {
    addTask({ category: 'patterns', name: pattern })
  }

  return tasks
}

/**
 * 格式化查询任务清单（用于日志输出）
 */
export function formatTaskListForLog(tasks: QueryTask[]): string {
  if (tasks.length === 0) return '（无查询任务）'

  return tasks.map((t, i) =>
    `  ${i + 1}. [${t.category}] ${t.name}${t.subKey ? `（${t.subKey}）` : ''}`
  ).join('\n')
}

/**
 * 领域识别（简单关键词匹配）
 */
export function detectDomain(question: string, lastDomain?: string): string {
  const keywords: Record<string, string[]> = {
    '财运': ['财', '钱', '收入', '投资', '理财', '破财', '赚', '薪资', '工资', '生意'],
    '事业': ['事业', '工作', '职业', '升职', '创业', '跳槽', '职场', '上司', '同事', '生意'],
    '感情': ['感情', '婚姻', '恋爱', '配偶', '桃花', '结婚', '离婚', '男友', '女友', '单身', '姻缘'],
    '健康': ['健康', '身体', '疾病', '手术', '生病', '体质', '养生'],
    '六亲': ['父母', '兄弟', '朋友', '上司', '贵人', '小人', '合伙人', '姐妹'],
    '子女': ['子女', '孩子', '生育', '儿子', '女儿', '亲子'],
    '学业': ['学业', '考试', '学历', '留学', '读书', '学习', '成绩', '考研'],
    '出行': ['出行', '出国', '迁居', '旅行', '移民', '旅游', '搬家', '外出'],
  }

  for (const [domain, kws] of Object.entries(keywords)) {
    if (kws.some(kw => question.includes(kw))) {
      return domain
    }
  }

  return lastDomain ?? '人生境遇'
}
