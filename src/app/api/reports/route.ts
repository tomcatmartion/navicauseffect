import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateReportContent } from '@/core/report/report-generator'
import { buildReportContext, buildReportContextFromSnapshot } from '@/core/report/report-pipeline'
import { getChartSnapshot, saveChart } from '@/core/chart/chart-record-service'

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
    const { templateId, identityId, extraInfo, chartRecordId } = body

    if (!templateId || !identityId) {
      return NextResponse.json(
        { error: '缺少 templateId 或 identityId' },
        { status: 400 }
      )
    }

    // 验证 chartRecordId（可选；若提供则用快照替代重排盘）
    let chartSnapshot: Awaited<ReturnType<typeof getChartSnapshot>> = null
    if (chartRecordId) {
      chartSnapshot = await getChartSnapshot(chartRecordId, session.user.id)
      if (!chartSnapshot) {
        return NextResponse.json(
          { error: '指定命盘不存在或无权使用' },
          { status: 400 }
        )
      }
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
    // 优先用 chartRecordId 对应的快照（避免重排盘，复用 stage1/2）
    let ir: ReturnType<typeof buildReportContext>
    try {
      const identityInput = {
        name: identity.name,
        gender: identity.gender,
        birthday: identity.birthday,
        birthCity: identity.birthCity,
        region: identity.region,
        bazi: identity.bazi,
      }
      ir = chartSnapshot
        ? buildReportContextFromSnapshot(identityInput, template.slug, chartSnapshot)
        : buildReportContext(identityInput, template.slug)
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

        // 子报告：构建紫微 IR（复用主报告的 chartSnapshot，避免重排盘）
        let childIr: ReturnType<typeof buildReportContext>
        try {
          const identityInput = {
            name: identity.name,
            gender: identity.gender,
            birthday: identity.birthday,
            birthCity: identity.birthCity,
            region: identity.region,
            bazi: identity.bazi,
          }
          childIr = chartSnapshot
            ? buildReportContextFromSnapshot(identityInput, child.slug, chartSnapshot)
            : buildReportContext(identityInput, child.slug)
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

    // ── 步骤 6：报告成功后异步沉淀 ChartRecord（source=REPORT） ──
    // 让用户在「我的命盘」看到报告来源的盘，避免重复排盘
    // 仅当本次报告未使用 chartRecordId（即用户首次没保存过）时沉淀
    if (genResult.status === 'COMPLETED' && !chartRecordId) {
      saveChart({
        userId: session.user.id,
        identityId,
        name: `${identity.name}-${new Date().toLocaleDateString('zh-CN')}`,
        birthInfo: {
          gender: identity.gender as 'MALE' | 'FEMALE',
          birthday: identity.birthday,
          birthCity: identity.birthCity ?? undefined,
          region: identity.region ?? undefined,
        },
        source: 'REPORT',
        note: `报告「${template.name}」生成时自动沉淀`,
      }).catch((e) => {
        // 自动沉淀失败不影响主流程（可能是同指纹已存在，幂等会跳过）
        console.warn('[reports] 自动沉淀 ChartRecord 失败（不影响报告）:', e instanceof Error ? e.message : e)
      })
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
