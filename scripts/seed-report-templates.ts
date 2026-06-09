import { PrismaClient, TemplateType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始插入报告模板种子数据...')

  // ========== 体验区（基础模板，低价单人报告） ==========

  const basicTemplates = [
    {
      name: '天赋觉醒计划',
      slug: 'talent-awakening',
      description: '发掘你的潜在天赋和独特才华，找到最适合的发展方向。约8000字深度分析，涵盖天赋特质、潜能开发、职业方向。',
      type: TemplateType.BASIC,
      tags: ['热门', '推荐', '8千字'],
      sortOrder: 1,
      pointCost: 88,
    },
    {
      name: '爱情图鉴',
      slug: 'love-atlas',
      description: '解读你的感情宿命，分析姻缘运势和感情走向。约7000字浪漫画像，涵盖桃花分析、正缘特征、感情建议。',
      type: TemplateType.BASIC,
      tags: ['热门', '7千字'],
      sortOrder: 2,
      pointCost: 88,
    },
    {
      name: '人生K线图',
      slug: 'life-kline',
      description: '流年运势图表分析，预判未来趋势与关键转折点。约9000字趋势研判，涵盖十年大运、流年走势、关键节点。',
      type: TemplateType.BASIC,
      tags: ['数据可视化', '9千字'],
      sortOrder: 3,
      pointCost: 88,
    },
  ]

  // ========== 会员区（高级模板，含子报告） ==========

  const advancedTemplates = [
    {
      name: '命书·人生命理通鉴',
      slug: 'life-full-analysis',
      description: '全方位解读你的命盘，约3万字完整人生分析。涵盖性格内观、事业、财富、感情、健康五大维度。',
      type: TemplateType.ADVANCED,
      tags: ['热门', '推荐', '3万字', '含5份子报告'],
      sortOrder: 4,
      pointCost: 380,
    },
    {
      name: '运书·年度运势',
      slug: 'annual-fortune',
      description: '年度运势详细分析，约2万字四季运势解读。涵盖心灵成长、事业、财富、感情、健康五大维度的年度展望。',
      type: TemplateType.ADVANCED,
      tags: ['限时', '2万字', '含5份子报告'],
      sortOrder: 5,
      pointCost: 380,
    },
    {
      name: '缘书·双人合盘报告',
      slug: 'compatibility-report',
      description: '两人命盘深度比对，约1万字关系分析。涵盖婚姻、爱情、事业合作、商业合伙、友情五大维度。',
      type: TemplateType.ADVANCED,
      tags: ['热门', '双人', '1万字', '含5份子报告'],
      sortOrder: 6,
      pointCost: 180,
    },
    {
      name: '好运锦囊',
      slug: 'lucky-tips',
      description: '专属开运方案，助你趋吉避凶。涵盖幸运色、幸运数字、开运方位、贵人属相等实用建议。',
      type: TemplateType.ADVANCED,
      tags: ['实用'],
      sortOrder: 7,
      pointCost: 66,
    },
    {
      name: '学业主题',
      slug: 'academic',
      description: '基于命理的学业分析，涵盖学习能力、考试运势、专业选择、进修方向等学业相关指导。',
      type: TemplateType.ADVANCED,
      tags: ['学术'],
      sortOrder: 8,
      pointCost: 100,
    },
    {
      name: '前世今生',
      slug: 'past-life',
      description: '回溯前世渊源，解读今生际遇的深层缘由。灵魂探索与生命课题的神秘之旅。',
      type: TemplateType.ADVANCED,
      tags: ['神秘'],
      sortOrder: 9,
      pointCost: 66,
    },
  ]

  // 子报告定义
  const childDefinitions: Record<string, Array<{ name: string; slug: string; pointCost: number }>> = {
    'life-full-analysis': [
      { name: '性格内观', slug: 'personality', pointCost: 66 },
      { name: '事业分析', slug: 'career', pointCost: 88 },
      { name: '财富分析', slug: 'wealth', pointCost: 88 },
      { name: '感情分析', slug: 'love', pointCost: 88 },
      { name: '健康分析', slug: 'health', pointCost: 66 },
    ],
    'annual-fortune': [
      { name: '心灵成长', slug: 'spiritual', pointCost: 66 },
      { name: '事业运势', slug: 'career-fortune', pointCost: 88 },
      { name: '财富运势', slug: 'wealth-fortune', pointCost: 88 },
      { name: '感情运势', slug: 'love-fortune', pointCost: 88 },
      { name: '健康运势', slug: 'health-fortune', pointCost: 66 },
    ],
    'compatibility-report': [
      { name: '婚姻合盘', slug: 'marriage', pointCost: 160 },
      { name: '爱情合盘', slug: 'romance', pointCost: 160 },
      { name: '事业合作', slug: 'business', pointCost: 160 },
      { name: '商业合伙', slug: 'partnership', pointCost: 160 },
      { name: '友情合盘', slug: 'friendship', pointCost: 160 },
    ],
  }

  // 插入基础模板
  for (const t of basicTemplates) {
    await prisma.reportTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        type: t.type,
        tags: t.tags,
        sortOrder: t.sortOrder,
        pointCost: t.pointCost,
      },
      create: t,
    })
    console.log(`  ✅ ${t.name} (${t.type}, ${t.pointCost}星币)`)
  }

  // 插入高级模板（含子模板）
  for (const t of advancedTemplates) {
    const parent = await prisma.reportTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        type: t.type,
        tags: t.tags,
        sortOrder: t.sortOrder,
        pointCost: t.pointCost,
      },
      create: t,
    })
    console.log(`  ✅ ${t.name} (${t.type}, ${t.pointCost}星币)`)

    // 创建子模板
    const children = childDefinitions[t.slug]
    if (children) {
      for (const child of children) {
        const childSlug = `${t.slug}-${child.slug}`
        await prisma.reportTemplate.upsert({
          where: { slug: childSlug },
          update: {
            name: child.name,
            pointCost: child.pointCost,
            parentId: parent.id,
          },
          create: {
            name: child.name,
            slug: childSlug,
            description: `${t.name} - ${child.name}`,
            type: TemplateType.ADVANCED,
            tags: ['子报告'],
            sortOrder: 0,
            pointCost: child.pointCost,
            parentId: parent.id,
          },
        })
        console.log(`    └─ ${child.name} (${child.pointCost}星币)`)
      }
    }
  }

  // 删除旧的不再使用的模板（不含 past-life，新模板复用了此 slug）
  const slugsToRemove = ['talent', 'love', 'kline', 'annual', 'luck', 'naming', 'compatibility']
  for (const slug of slugsToRemove) {
    const existing = await prisma.reportTemplate.findUnique({ where: { slug } })
    if (existing) {
      // 先删除以此模板为parentId的子模板
      await prisma.reportTemplate.deleteMany({ where: { parentId: existing.id } })
      await prisma.reportTemplate.delete({ where: { id: existing.id } })
      console.log(`  🗑️ 删除旧模板: ${slug}`)
    }
  }

  // 创建测试兑换码
  const existingCode = await prisma.redeemCode.findUnique({ where: { code: 'WELCOME100' } })
  if (!existingCode) {
    await prisma.redeemCode.create({
      data: {
        code: 'WELCOME100',
        pointValue: 100,
        maxUses: 1000,
        expiresAt: new Date('2027-12-31'),
      },
    })
    console.log('  ✅ 测试兑换码: WELCOME100 (100星币)')
  }

  console.log('\n种子数据插入完成！')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
