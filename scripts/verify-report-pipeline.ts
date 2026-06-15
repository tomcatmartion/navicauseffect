/**
 * 验证报告紫微管道 — 排盘 + Stage1/2/3 + IR 拼装（不调 AI）
 * 确认改造后报告生成基于紫微命盘而非八字
 */
import { buildReportContext } from '../src/core/report/report-pipeline'

const identity = {
  name: '李某',
  gender: 'FEMALE' as const,
  birthday: '1992-08-15 16:00',
  birthCity: '北京',
  region: '北京',
  bazi: '壬申 戊申 丁卯 戊申',
}

const templates = ['talent-awakening', 'love-atlas', 'life-full-analysis', 'past-life', 'lucky-tips']

console.log('═══ 报告紫微管道验证 ═══')
console.log(`命主：${identity.name}（${identity.gender === 'MALE' ? '男' : '女'}）${identity.birthday} ${identity.birthCity}`)
console.log('')

for (const slug of templates) {
  try {
    const ir = buildReportContext(identity, slug)
    console.log(`▶ 模板 ${slug}`)
    console.log(`  排盘：${ir.chartSnapshot.solarDate} | 生年${ir.chartSnapshot.birthGanZhi} | ${ir.chartSnapshot.zodiac} | 五行局${ir.chartSnapshot.fiveElementsClass}`)
    console.log(`  命宫主星：${ir.chartSnapshot.mingGong.majorStars.join('、') || '空宫'}`)
    console.log(`  性格基调：${ir.personality?.overallTone?.slice(0, 50) ?? '（无）'}`)
    console.log(`  事项分析：${ir.matters.length} 项${ir.matters.length ? ' → ' + ir.matters.map(m => `${m.matterType}(主宫${m.primaryPalace},${m.primaryScore.toFixed(1)}分)`).join('；') : '（纯宫位模板）'}`)
    console.log(`  当前大限：${ir.timeContext.currentDaXian ? `第${ir.timeContext.currentDaXian.index}大限 ${ir.timeContext.currentDaXian.ageRange}岁 命宫${ir.timeContext.currentDaXian.mingPalaceName}` : '无'} | 流年${ir.timeContext.liuNianGan}干`)
    console.log(`  重点：${ir.focusPalaces.slice(0, 60)}...`)
    console.log('')
  } catch (e) {
    console.log(`✗ 模板 ${slug} 失败: ${e instanceof Error ? e.message : e}`)
    console.log('')
  }
}

// 验证无八字术语污染（IR 不应含十神/大运等八字概念）
console.log('═══ 八字污染检查 ═══')
const ir = buildReportContext(identity, 'life-full-analysis')
const irText = JSON.stringify(ir)
const baziTerms = ['十神', '比肩', '劫财', '食神', '伤官', '偏财', '正财', '偏印', '正印', '大运', '用神', '喜忌', '日主']
const polluted = baziTerms.filter(t => irText.includes(t))
console.log(polluted.length ? `✗ IR 仍含八字术语：${polluted.join('、')}` : '✓ IR 无八字术语污染')
console.log(`  （注：baziAux 字段保留八字字符串仅作辅助参考，prompt 中明确禁止用八字理论）`)
