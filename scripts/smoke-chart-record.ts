/**
 * 命盘保存 + 合盘 端到端冒烟（服务层直连，绕过 NextAuth）
 * 运行: npx tsx scripts/smoke-chart-record.ts
 */
import { prisma } from '../src/lib/db'

async function main() {
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } })
  if (!admin) { console.log('✗ 无 admin'); return }

  // 清理可能的残留
  await prisma.compatibilityAnalysis.deleteMany({ where: { userId: admin.id } })
  const existing = await prisma.chartRecord.deleteMany({
    where: { userId: admin.id, name: { contains: '测试' } },
  })

  // 创建测试 identity
  const identity = await prisma.identity.create({
    data: {
      userId: admin.id,
      name: '测试李某',
      gender: 'FEMALE',
      birthday: '1992-08-15 12:00',
      birthCity: '北京',
      region: '北京',
      relation: 'SELF',
      isActive: false,
    },
  })
  console.log('✓ 命主：', identity.name, identity.id)

  const { saveChart, getChartRecord, listChartRecords, deleteChartRecord, getChartSnapshot } =
    await import('../src/core/chart/chart-record-service')
  const { executeStage4Full } = await import('../src/core/stages/stage4-full-compatibility')

  // 1. saveChart
  console.log('\n1. saveChart（排盘+持久化）...')
  const t0 = Date.now()
  const chart = await saveChart({
    userId: admin.id,
    identityId: identity.id,
    name: '测试李某-午时-北京',
    birthInfo: { gender: 'FEMALE', birthday: '1992-08-15 12:00', birthCity: '北京' },
    source: 'MANUAL',
  })
  console.log('  ✓ 耗时 ' + ((Date.now() - t0) / 1000).toFixed(2) + 's')
  console.log('  主星：', chart.summary?.mingGongMajorStars)
  console.log('  生年：', chart.summary?.birthGanZhi)
  console.log('  五行局：', chart.summary?.fiveElementsClass)

  // 2. 详情
  console.log('\n2. getChartRecord...')
  const detail = await getChartRecord(chart.id, admin.id)
  const snap = detail?.chartSnapshot as Record<string, unknown> | undefined
  console.log('  iztroVersion：', snap?.iztroVersion)
  console.log('  stage1 palaceScores 数：', (snap?.stage1 as { palaceScores?: unknown[] })?.palaceScores?.length)
  console.log('  stage2 personalityTriad：', !!((snap?.stage2 as { personalityTriad?: unknown })?.personalityTriad))
  console.log('  reading palaces 数：', (snap?.reading as { palaces?: unknown[] })?.palaces?.length)

  // 3. 列表
  console.log('\n3. listChartRecords...')
  const list = await listChartRecords(admin.id)
  console.log('  命盘数：', list.length)

  // 4. 幂等
  console.log('\n4. 幂等测试...')
  const dup = await saveChart({
    userId: admin.id,
    identityId: identity.id,
    name: '测试-同指纹',
    birthInfo: { gender: 'FEMALE', birthday: '1992-08-15 12:00', birthCity: '北京' },
  })
  console.log('  同 id：', dup.id === chart.id ? '✓' : '✗')

  // 5. 合盘
  console.log('\n5. 合盘计算...')
  const partner = await saveChart({
    userId: admin.id,
    identityId: identity.id,
    name: '测试王某-子时-上海',
    birthInfo: { gender: 'MALE', birthday: '1988-03-20 23:30', birthCity: '上海' },
  })
  console.log('  对方盘 id：', partner.id)

  const selfSnap = await getChartSnapshot(chart.id, admin.id)
  const partnerSnap = await getChartSnapshot(partner.id, admin.id)
  if (selfSnap && partnerSnap) {
    const result = executeStage4Full({ selfChart: selfSnap, partnerChart: partnerSnap })
    console.log('  ✓ 合盘计算完成')
    console.log('  综合：', result.dimensionScores.overall,
      '情感', result.dimensionScores.emotion,
      '事业', result.dimensionScores.career,
      '财运', result.dimensionScores.wealth)
    console.log('  四化交叉：', result.crossSihua.length, '星曜互动：', result.starInteraction.length)
    console.log('  关键亮点（前2）：', result.highlights.slice(0, 2))
    console.log('  风险提示（前2）：', result.risks.slice(0, 2))
  }

  // 清理
  console.log('\n清理...')
  await prisma.compatibilityAnalysis.deleteMany({ where: { userId: admin.id } })
  await deleteChartRecord(chart.id, admin.id)
  await deleteChartRecord(partner.id, admin.id)
  await prisma.identity.delete({ where: { id: identity.id } })
  console.log('  ✓ 清理完成')

  console.log('\n✓✓✓ 服务层端到端验证通过')
}

main().catch((e) => {
  console.error('异常:', e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
