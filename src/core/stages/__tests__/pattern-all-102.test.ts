/**
 * 验证所有102种格局是否都能在代码中被正确加载
 */

import { describe, test, expect } from 'vitest'
import {
  greatAuspiciousPatterns,
  mediumAuspiciousPatterns,
  smallAuspiciousPatterns,
  smallInauspiciousPatterns,
  mediumInauspiciousPatterns,
  greatInauspiciousPatterns,
} from '@/core/energy-evaluator/patterns'

const allPatterns = [
  ...greatAuspiciousPatterns,
  ...mediumAuspiciousPatterns,
  ...smallAuspiciousPatterns,
  ...smallInauspiciousPatterns,
  ...mediumInauspiciousPatterns,
  ...greatInauspiciousPatterns,
]

// JSON中的102种格局列表 + 用户要求补充的10条 = 112条
const expectedPatterns = [
  '君臣庆会', '紫府同宫终身福厚', '紫微居午位至公卿', '腰金衣紫', '限至腾达',
  '官封三代', '驰名食禄', '阳梁昌禄', '英星入庙晋官加爵', '紫杀带化权',
  '雄宿朝垣', '绝处逢生', '贪武同行', '横发', '武破白手', '石中隐玉',
  '巨机公卿', '巨火羊终身不懈', '日月夹财', '马头带剑(日月)', '水澄桂萼',
  '月朗天门', '月朗天门奇格', '机智灵活', '威仪俱足', '日月反背', '日月并明',
  '丁火辛勤', '日丽中天', '出世荣华', '加官进爵', '火贪横发', '通权变而多谋',
  '府相遇禄', '武府财臣', '寿星入庙(机梁同)', '官资清显格', '机梁羊机谋致胜',
  '位至公卿', '天同化权反贵', '异路功名', '三奇嘉会', '脱俗之僧', '积富之人',
  '礼乐并施', '日出扶桑', '马头带剑(杀破狼)', '寿星入庙(杀破狼)', '机梁嘉会善谈兵',
  '紫杀虚权', '悭吝之人', '败伦乱俗', '机月淫贫格', '泛水桃花', '风流彩杖',
  '梁宿太阴飘荡格', '浪荡多淫', '折足马', '孤君在野', '桃花犯主', '破祖离宗',
  '因财持刀', '寡宿', '巨机破荡2', '十恶格', '人离财散', '贫士格', '火贪横破',
  '机梁羊刑克见孤', '半空折翅', '君臣不义', '刑囚夹印', '绝处逢死', '路上埋尸',
  '丧命天折', '财与囚仇', '自缢投河', '因财被劫', '限至投河', '武破离宗',
  '巨机破荡1', '巨火羊终身缢死', '众水东流格', '离正位而颠倒粉身碎骨格',
  '府相朝垣', '禄合鸳鸯', '双禄朝垣', '辅弼拱命', '昌曲夹命', '左右夹命',
  '羊陀夹命', '火铃夹命', '空劫夹命', '刑忌夹印', '马落空亡', '梁马飘荡',
  '命无正曜', '极居卯酉', '巨机化酉', '日月藏辉', '昌曲化忌', '铃昌陀武',
  // 用户要求补充的10条格局
  '七杀朝斗', '七杀仰斗', '机月同梁', '禄马交驰', '天乙拱命',
  '科权禄夹命', '日月照壁', '善荫朝纲', '紫府朝垣', '廉贞清白',
]

describe('所有112种格局完整性验证', () => {
  test('代码中应包含112种格局', () => {
    expect(allPatterns.length).toBe(112)
  })

  test('每种格局都应有唯一的名称', () => {
    const names = allPatterns.map((p) => p.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(112)
  })

  test('代码中的格局名称应与JSON完全一致', () => {
    const codeNames = allPatterns.map((p) => p.name).sort()
    const jsonNames = [...expectedPatterns].sort()
    expect(codeNames).toEqual(jsonNames)
  })

  test('每种格局都应有有效的evaluate函数', () => {
    for (const p of allPatterns) {
      expect(typeof p.evaluate).toBe('function')
    }
  })

  test('每种格局都应有有效的级别', () => {
    const validLevels = ['大吉', '中吉', '小吉', '小凶', '中凶', '大凶']
    for (const p of allPatterns) {
      expect(validLevels).toContain(p.level)
    }
  })

  test('按级别统计格局数量', () => {
    const byLevel: Record<string, number> = {}
    for (const p of allPatterns) {
      byLevel[p.level] = (byLevel[p.level] ?? 0) + 1
    }
    console.log('格局级别分布:', byLevel)
    expect(byLevel['大吉']).toBe(9)
    expect(byLevel['中吉']).toBe(49)
    expect(byLevel['小吉']).toBe(7)
    expect(byLevel['小凶']).toBe(10)
    expect(byLevel['中凶']).toBe(18)
    expect(byLevel['大凶']).toBe(19)
  })
})
