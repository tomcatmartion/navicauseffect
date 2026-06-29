/**
 * Seed ReportTemplate.promptConfig 字段
 *
 * 把 src/core/report/report-generator.ts 中 TEMPLATE_INSTRUCTIONS 的 8 个模板章节要求
 * 写入数据库 ReportTemplate.promptConfig 字段，让运营可通过数据库动态调整模板指令。
 *
 * 使用：
 *   pnpm tsx scripts/seed-template-prompt-config.ts
 *
 * 注意：子报告（带 parentId）也会被处理，但其 slug 不在 TEMPLATE_INSTRUCTIONS 中，
 * 跳过即可（子报告使用主模板的指令或留空由 generateReportContent 兜底）。
 */
import { PrismaClient } from '@prisma/client'
import { TEMPLATE_INSTRUCTIONS } from '../src/core/report/template-instructions'

const prisma = new PrismaClient()

async function main() {
  console.log('开始 Seed ReportTemplate.promptConfig...')

  const allTemplates = await prisma.reportTemplate.findMany({
    select: { id: true, slug: true, name: true, parentId: true, promptConfig: true },
  })
  console.log(`找到 ${allTemplates.length} 个模板`)

  let updated = 0
  let skipped = 0

  for (const t of allTemplates) {
    const instruction = TEMPLATE_INSTRUCTIONS[t.slug]
    if (!instruction) {
      console.log(`  ⏭️  跳过 ${t.slug}（无对应指令，可能是子报告）`)
      skipped++
      continue
    }

    // 幂等：若已是相同内容则跳过
    if (t.promptConfig === instruction) {
      console.log(`  ✓ ${t.slug} 已是最新，跳过`)
      continue
    }

    await prisma.reportTemplate.update({
      where: { id: t.id },
      data: { promptConfig: instruction },
    })
    console.log(`  ✅ ${t.slug} 写入 promptConfig（${instruction.length} 字符）`)
    updated++
  }

  console.log(`\n完成：更新 ${updated} 个，跳过 ${skipped} 个，总计 ${allTemplates.length} 个`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
