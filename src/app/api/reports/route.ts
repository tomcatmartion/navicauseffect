import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateReportContent } from '@/core/report/report-generator'
import { buildReportContext } from '@/core/report/report-pipeline'

// GET /api/reports — 获取当前用户的报告列表（按命主分组）
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(req.url)
    const identityId = searchParams.get('identityId')

    const where: Record<string, unknown> = {
      userId,
      parentReportId: null, // 只查主报告
    }
    if (identityId) {
      where.identityId = identityId
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        template: {
          select: { id: true, name: true, slug: true, type: true },
        },
        identity: {
          select: { id: true, name: true, gender: true },
        },
        children: {
          include: {
            template: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 按命主分组
    const grouped: Record<string, {
      identity: { id: string; name: string; gender: string }
      reports: typeof reports
    }> = {}

    for (const report of reports) {
      const iId = report.identityId
      if (!grouped[iId]) {
        grouped[iId] = {
          identity: report.identity,
          reports: [],
        }
      }
      grouped[iId].reports.push(report)
    }

    return NextResponse.json({
      reports,
      grouped,
    })
  } catch (error) {
    console.error('获取报告列表失败:', error)
    return NextResponse.json(
      { error: '获取报告列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/reports — 创建新报告（同步生成内容）
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()
    const { templateId, identityId, extraInfo } = body

    if (!templateId || !identityId) {
      return NextResponse.json(
        { error: '缺少 templateId 或 identityId' },
        { status: 400 }
      )
    }

    // 验证命主归属
    const identity = await prisma.identity.findFirst({
      where: { id: identityId, userId: session.user.id },
    })
    if (!identity) {
      return NextResponse.json(
        { error: '命主不存在或无权操作' },
        { status: 403 }
      )
    }

    // 获取模板（含子模板）
    const template = await prisma.reportTemplate.findUnique({
      where: { id: templateId },
      include: { children: { where: { isActive: true } } },
    })
    if (!template) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      )
    }

    // ── 步骤 1：计算会员折扣后价格并扣费 ──
    if (template.pointCost > 0) {
      // 查询会员状态以计算折扣
      const userWithMembership = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { membership: true },
      })

      // 会员折扣：年度7折、季度8折、月度9折
      const plan = userWithMembership?.membership?.plan
      let discountRate = 1.0
      let discountLabel = ''
      if (plan === 'YEARLY') { discountRate = 0.7; discountLabel = '(年度会员7折)' }
      else if (plan === 'QUARTERLY') { discountRate = 0.8; discountLabel = '(季度会员8折)' }
      else if (plan === 'MONTHLY') { discountRate = 0.9; discountLabel = '(月度会员9折)' }

      const actualCost = Math.ceil(template.pointCost * discountRate)

      if (!userWithMembership || userWithMembership.totalPoints < actualCost) {
        return NextResponse.json(
          { error: '星币不足', required: actualCost, current: userWithMembership?.totalPoints ?? 0, originalCost: template.pointCost, discount: discountLabel || undefined },
          { status: 402 }
        )
      }

      // 事务：扣除星币 + 记录流水
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.user.id },
          data: { totalPoints: { decrement: actualCost } },
        }),
        prisma.pointRecord.create({
          data: {
            userId: session.user.id,
            points: -actualCost,
            source: 'CONSUME',
            detail: `生成报告: ${template.name}${discountLabel}`,
          },
        }),
      ])
    }

    // ── 步骤 2：创建报告记录（PENDING） ──
    const report = await prisma.report.create({
      data: {
        userId: session.user.id,
        identityId,
        templateId,
        status: 'GENERATING',
        progress: 10,
      },
    })

    // 创建子报告记录
    const childTemplateList = template.children
    if (childTemplateList.length > 0) {
      await prisma.report.createMany({
        data: childTemplateList.map((child: { id: string }) => ({
          userId: session.user.id,
          identityId,
          templateId: child.id,
          parentReportId: report.id,
          status: 'PENDING' as const,
          progress: 0,
        })),
      })
    }

    // ── 步骤 3：构建紫微 IR（排盘 + Stage1/2/3 硬计算结论） ──
    let ir: ReturnType<typeof buildReportContext>
    try {
      ir = buildReportContext(
        {
          name: identity.name,
          gender: identity.gender,
          birthday: identity.birthday,
          birthCity: identity.birthCity,
          region: identity.region,
          bazi: identity.bazi,
        },
        template.slug,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : '排盘失败'
      await prisma.report.update({
        where: { id: report.id },
        data: { status: 'FAILED', errorMessage: `紫微排盘失败：${msg}` },
      })
      return NextResponse.json({ error: `紫微排盘失败：${msg}` }, { status: 400 })
    }

    // ── 步骤 3b：AI 基于紫微 IR 生成报告（纯紫微理论） ──
    const genResult = await generateReportContent({
      ir,
      templateSlug: template.slug,
      templateName: template.name,
      extraInfo,
    })

    // ── 步骤 4：更新报告状态 ──
    const updatedReport = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: genResult.status,
        progress: genResult.status === 'COMPLETED' ? 100 : 0,
        content: genResult.content || null,
        errorMessage: genResult.errorMessage || null,
      },
      include: {
        template: { select: { id: true, name: true, slug: true, type: true } },
        identity: { select: { id: true, name: true, gender: true } },
        children: {
          include: {
            template: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    })

    // ── 步骤 5：如果主报告成功且有子报告，同步生成子报告 ──
    if (genResult.status === 'COMPLETED' && childTemplateList.length > 0) {
      // 不阻塞响应，用 Promise.allSettled 并行生成所有子报告
      const childPromises = childTemplateList.map(async (child: { id: string; name: string; slug: string }) => {
        // 先查找对应子报告
        const childReport = await prisma.report.findFirst({
          where: { parentReportId: report.id, templateId: child.id },
        })
        if (!childReport) return

        // 更新子报告状态为生成中
        try {
          await prisma.report.update({
            where: { id: childReport.id },
            data: { status: 'GENERATING', progress: 10 },
          })
        } catch (err) {
          console.error(`[子报告] 更新状态失败: ${child.name}`, err)
        }

        // 子报告：构建紫微 IR（复用命主排盘，按子模板主题映射事项）
        let childIr: ReturnType<typeof buildReportContext>
        try {
          childIr = buildReportContext(
            {
              name: identity.name,
              gender: identity.gender,
              birthday: identity.birthday,
              birthCity: identity.birthCity,
              region: identity.region,
              bazi: identity.bazi,
            },
            child.slug,
          )
        } catch (e) {
          const msg = e instanceof Error ? e.message : '排盘失败'
          await prisma.report.update({
            where: { id: childReport.id },
            data: { status: 'FAILED', errorMessage: `紫微排盘失败：${msg}` },
          })
          return
        }

        const childGen = await generateReportContent({
          ir: childIr,
          templateSlug: child.slug,
          templateName: child.name,
          extraInfo,
        })

        // 更新子报告结果
        try {
          await prisma.report.update({
            where: { id: childReport.id },
            data: {
              status: childGen.status,
              progress: childGen.status === 'COMPLETED' ? 100 : 0,
              content: childGen.content || null,
              errorMessage: childGen.errorMessage || null,
            },
          })
        } catch (err) {
          console.error(`[子报告] 更新结果失败: ${child.name}`, err)
        }
      })

      // 并行等待所有子报告完成（不阻塞 API 响应）
      Promise.allSettled(childPromises).then(() => {
        // 重新查询 updatedReport 以刷新 children 状态（不阻塞响应）
      }).catch(() => { /* ignore */ })
    }

    return NextResponse.json({ report: updatedReport }, { status: 201 })
  } catch (error) {
    console.error('创建报告失败:', error)
    return NextResponse.json(
      { error: '创建报告失败' },
      { status: 500 }
    )
  }
}
