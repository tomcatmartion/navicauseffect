/**
 * POST /api/cron/sentiment-report
 *
 * 定时生成舆情报告（每天凌晨运行）
 * 可通过外部 cron 触发（如 cronjob.com、GitHub Actions）
 * GET 请求也可触发（用于手动测试）
 *
 * 查询昨天的问题数据，按预设关键词生成分析报告
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createProvider } from '@/lib/ai'

const REPORT_KEYWORDS = ['事业', '财运', '感情', '健康', '子女', '创业', '求职', '婚姻']

async function generateReportForKeyword(keyword: string, reportDate: Date) {
  // 统计昨天全天数据
  const startDate = new Date(reportDate)
  startDate.setDate(startDate.getDate() - 1)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setHours(23, 59, 59, 999)

  const startStr = startDate.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)

  // 查询问题数量
  const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) as cnt FROM user_question_logs
     WHERE question LIKE '%${keyword}%'
       AND created_at BETWEEN '${startStr}' AND '${endStr}'`
  )
  const totalCount = Number(countResult[0]?.cnt ?? 0)

  if (totalCount === 0) return null

  // 查询领域分布
  const domainResult = await prisma.$queryRawUnsafe<Array<{ domain: string; cnt: bigint }>>(
    `SELECT COALESCE(domain, '未知') as domain, COUNT(*) as cnt
     FROM user_question_logs
     WHERE question LIKE '%${keyword}%'
       AND created_at BETWEEN '${startStr}' AND '${endStr}'
     GROUP BY domain
     ORDER BY cnt DESC LIMIT 5`
  )

  // 查询热门问题
  const keywordResult = await prisma.$queryRawUnsafe<Array<{ question: string; cnt: bigint }>>(
    `SELECT LEFT(question, 30) as question, COUNT(*) as cnt
     FROM user_question_logs
     WHERE question LIKE '%${keyword}%'
       AND created_at BETWEEN '${startStr}' AND '${endStr}'
     GROUP BY LEFT(question, 30)
     ORDER BY cnt DESC LIMIT 5`
  )

  const topDomains = domainResult.map((r) => ({ domain: r.domain, count: Number(r.cnt) }))
  const topKeywords = keywordResult.map((r) => ({ question: r.question, count: Number(r.cnt) }))

  // AI 生成摘要
  const modelConfig = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  }) ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } })

  let summary = `共收到 ${totalCount} 条与"${keyword}"相关的问题。`
  if (topDomains.length > 0) {
    const topDomain = topDomains[0]
    summary += ` 主要领域为"${topDomain.domain}"（${topDomain.count}条）。`
  }

  if (modelConfig) {
    try {
      const provider = createProvider({
        id: modelConfig.id,
        name: modelConfig.name,
        provider: modelConfig.provider,
        apiKey: modelConfig.apiKeyEncrypted,
        baseUrl: modelConfig.baseUrl,
        modelId: modelConfig.modelId,
      })
      const analysisPrompt = `请用一段话总结以下舆情数据（50字以内）：
关键词：${keyword}
日期：${startStr} 至 ${endStr}
问题总数：${totalCount}
领域分布：${JSON.stringify(topDomains)}
热门问题：${JSON.stringify(topKeywords.map((k) => k.question))}`
      summary = await provider.chatSync(
        [
          { role: 'system', content: '你是一个舆情分析师，用简洁的中文总结数据，50字以内。' },
          { role: 'user', content: analysisPrompt },
        ],
        { temperature: 0.3, maxTokens: 200 }
      )
    } catch (err) {
      console.warn('[Sentiment Cron] AI 摘要生成失败:', err)
    }
  }

  return {
    reportDate: startDate,
    keyword,
    summary,
    trendCount: totalCount,
    topDomains,
    topKeywords,
    sqlQuery: null,
  }
}

export async function GET(request: NextRequest) {
  // 简单密钥验证（通过 X-Cron-Secret header）
  const secret = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET ?? 'navicauseffect-cron-secret'
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  try {
    const reportDate = new Date()
    const results = []

    for (const keyword of REPORT_KEYWORDS) {
      const data = await generateReportForKeyword(keyword, reportDate)
      if (!data) continue

      // 写入或更新报告
      await prisma.sentimentReport.upsert({
        where: {
          reportDate_keyword: {
            reportDate: data.reportDate,
            keyword: data.keyword,
          },
        },
        update: {
          summary: data.summary,
          trendCount: data.trendCount,
          topDomains: data.topDomains,
          topKeywords: data.topKeywords,
          sqlQuery: data.sqlQuery,
        },
        create: {
          reportDate: data.reportDate,
          keyword: data.keyword,
          summary: data.summary,
          trendCount: data.trendCount,
          topDomains: data.topDomains,
          topKeywords: data.topKeywords,
          sqlQuery: data.sqlQuery,
        },
      })
      results.push(data)
    }

    return NextResponse.json({
      success: true,
      date: reportDate.toISOString().slice(0, 10),
      reports: results.length,
      details: results,
    })
  } catch (err) {
    console.error('[Sentiment Cron] 报告生成失败:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '生成失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // 也支持 POST
  return GET(request)
}