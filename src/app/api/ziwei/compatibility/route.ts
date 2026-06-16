/**
 * POST /api/ziwei/compatibility — 双方完整命盘合盘分析
 *
 * 入参：
 *   {
 *     selfChartId: string,
 *     partnerChartId: string,
 *     withAI?: boolean   // 默认 true，是否调 AI 生成解读
 *   }
 *
 * 流程：
 *   1. 加载两份 ChartSnapshot
 *   2. 校验归属（两份都属于当前用户）
 *   3. 命中缓存（同 selfChartId + partnerChartId）→ 直接返回
 *   4. 否则调 executeStage4Full + AI 解读 → 存表 → 返回
 */
import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getChartSnapshot } from '@/core/chart/chart-record-service'
import { executeStage4Full } from '@/core/stages/stage4-full-compatibility'

// AI 调用（直接复用项目已有的 AI Provider 配置）
async function generateCompatibilityAI(
  selfSummary: { solarDate: string; mingGongMajorStars: string[] },
  partnerSummary: { solarDate: string; mingGongMajorStars: string[] },
  result: ReturnType<typeof executeStage4Full>,
): Promise<string> {
  // 复用项目 AI 模型配置：先取默认激活的 AIModelConfig
  const config = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  }) ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } })
  if (!config) {
    console.warn('[compatibility] 未配置任何 AI 模型，跳过 AI 解读')
    return ''
  }

  const { createProvider } = await import('@/lib/ai')
  const provider = createProvider({
    id: config.id,
    name: config.name,
    provider: config.provider,
    apiKey: config.apiKeyEncrypted,
    baseUrl: config.baseUrl,
    modelId: config.modelId,
  })

  const systemPrompt = `你是一位资深的紫微斗数合盘分析师。基于以下程序计算出的合盘数据，给出深入、客观、有建设性的解读。
要求：
- 严格使用紫微斗数理论（命宫、夫妻宫、四化、主星等），禁止使用八字术语
- 解读要分维度（情感/事业/财运/沟通/家庭）
- 给出 3-5 条具体可执行的关系经营建议
- 风险提示要客观，避免绝对化表述
- 输出 Markdown 格式，章节清晰`

  const userPrompt = `# 合盘对象
- 自己：${selfSummary.solarDate}，命宫${selfSummary.mingGongMajorStars.join('·') || '空宫'}
- 对方：${partnerSummary.solarDate}，命宫${partnerSummary.mingGongMajorStars.join('·') || '空宫'}

# 程序计算结果
${result.summaryText}

# 关键四化交叉详情
${result.crossSihua.map((s) => `- ${s.note}`).join('\n') || '（无显著四化交叉）'}

# 星曜互动详情
${result.starInteraction.map((i) => `- ${i.note}`).join('\n') || '（无显著星曜互动）'}

请基于以上数据，输出完整的合盘分析报告。`

  try {
    const response = await provider.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.7, maxTokens: 4096, stream: false } as Record<string, unknown>)
    // AIProvider.chat 返回 stream，这里取 content
    const r = response as unknown as { content?: string }
    return r.content ?? ''
  } catch (e) {
    console.error('[compatibility] AI 调用失败:', e instanceof Error ? e.message : e)
    return '' // 失败时仅返回结构化数据
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()
    const { selfChartId, partnerChartId, withAI = true } = body as {
      selfChartId?: string
      partnerChartId?: string
      withAI?: boolean
    }

    if (!selfChartId || !partnerChartId) {
      return NextResponse.json(
        { error: '缺少 selfChartId 或 partnerChartId' },
        { status: 400 },
      )
    }
    if (selfChartId === partnerChartId) {
      return NextResponse.json(
        { error: '不能与自己合盘' },
        { status: 400 },
      )
    }

    // 命中缓存
    const cached = await prisma.compatibilityAnalysis.findFirst({
      where: { selfChartId, partnerChartId, userId: session.user.id },
    })
    if (cached) {
      return NextResponse.json({ analysis: cached, cached: true })
    }

    // 加载两份 chartSnapshot
    const [selfSnapshot, partnerSnapshot] = await Promise.all([
      getChartSnapshot(selfChartId, session.user.id),
      getChartSnapshot(partnerChartId, session.user.id),
    ])
    if (!selfSnapshot || !partnerSnapshot) {
      return NextResponse.json(
        { error: '命盘不存在或无权使用' },
        { status: 400 },
      )
    }

    // 计算
    const result = executeStage4Full({
      selfChart: selfSnapshot,
      partnerChart: partnerSnapshot,
    })

    // AI 解读（可选）
    let aiSummary: string | null = null
    if (withAI) {
      aiSummary = await generateCompatibilityAI(
        selfSnapshot.summary,
        partnerSnapshot.summary,
        result,
      )
    }

    // 存表
    const analysis = await prisma.compatibilityAnalysis.create({
      data: {
        userId: session.user.id,
        selfChartId,
        partnerChartId,
        result: result as unknown as object,
        aiSummary,
      },
    })

    return NextResponse.json({ analysis, cached: false })
  } catch (error) {
    console.error('[compatibility] 创建失败:', error)
    const msg = error instanceof Error ? error.message : '合盘分析失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/ziwei/compatibility — 列出当前用户的合盘历史
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const analyses = await prisma.compatibilityAnalysis.findMany({
      where: { userId: session.user.id },
      include: {
        selfChart: {
          select: { id: true, name: true, birthSolarDate: true, identityId: true },
        },
        partnerChart: {
          select: { id: true, name: true, birthSolarDate: true, identityId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ analyses })
  } catch (error) {
    console.error('[compatibility] 列表失败:', error)
    return NextResponse.json({ error: '获取合盘历史失败' }, { status: 500 })
  }
}
