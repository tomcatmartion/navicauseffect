/**
 * POST /api/admin/sentiment/analyze
 * 舆情分析：AI 生成 SQL → 查询 → AI 分析
 *
 * 请求体：{ keyword, startDate, endDate, domain? }
 * 响应：{ sql, queryResult, analysis }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createProvider } from '@/lib/ai'

const SQL_GENERATION_PROMPT = `你是一个 MySQL 专家。用户想统计 user_question_logs 表中"用户问题"的分布和趋势。

表结构：
CREATE TABLE user_question_logs (
  id varchar(100) PRIMARY KEY,
  user_id varchar(100),
  session_id varchar(100),
  question TEXT NOT NULL,
  domain varchar(100),          -- 领域：事业/财运/感情/健康/子女/六亲
  intent_type varchar(50),      -- 意图：normal/offtopic/chitchat
  answer LONGTEXT,
  answer_model varchar(100),
  latency_ms int,
  step2_ms int,                -- Step2 要素提取耗时
  step3_ms int,                -- Step3 知识召回耗时
  step4_ms int,                -- Step4 AI 生成耗时
  chart_fingerprint varchar(100),
  created_at datetime DEFAULT CURRENT_TIMESTAMP
);

用户输入：
- 关键词：{keyword}
- 时间范围：{startDate} 至 {endDate}
- 领域：{domain || '全部'}

请生成一条 SELECT 查询语句，同时统计：
1. 每天的问题数量（date, count）
2. 问题关键词出现频率（question关键词字数多的在前）（question片段, 出现次数）
3. 领域分布（domain, count）

注意：
- 只生成 SELECT 语句，不要任何其他内容
- 使用 LIKE 匹配关键词（区分大小写不敏感）
- 日期用 DATE(created_at) 分组
- 必须加上时间范围条件（created_at BETWEEN '{startDate}' AND '{endDate}'）
- 如果 domain 不为空，则加上 domain = '{domain}'
- 合并多个统计：一条 SQL 用 UNION ALL 连接三个子查询

只返回 SQL 语句，不要任何解释。SQL 必须可执行。格式示例：
SELECT DATE(created_at) as date, COUNT(*) as count FROM ... GROUP BY DATE(created_at)
UNION ALL
SELECT LEFT(question, 30) as label, COUNT(*) as count FROM ... GROUP BY LEFT(question, 30) ORDER BY count DESC LIMIT 20
UNION ALL
SELECT COALESCE(domain, '未知') as domain, COUNT(*) as count FROM ... GROUP BY domain`;

const ANALYSIS_PROMPT = `以下是 user_question_logs 表的查询结果：

用户条件：
- 关键词：{keyword}
- 时间范围：{startDate} 至 {endDate}
- 领域：{domain || '全部'}

查询结果数据：
{queryResult}

请分析：
1. 整体趋势（增长/下降/平稳）
2. 问题数量峰值和谷值出现的日期
3. 主要问题类型和关注点
4. 有趣的关联发现（如果有的话）
5. 简短的总结和建议

以自然语言回答，数据要具体。`

export async function POST(request: NextRequest) {
  // 管理员权限检查
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const body = await request.json()
  const { keyword, startDate, endDate, domain } = body as {
    keyword: string
    startDate: string
    endDate: string
    domain?: string
  }

  if (!keyword || !startDate || !endDate) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
  }

  try {
    // 1. 生成 SQL
    const modelConfig = await prisma.aIModelConfig.findFirst({
      where: { isActive: true, isDefault: true },
    }) ?? await prisma.aIModelConfig.findFirst({
      where: { isActive: true },
    })

    if (!modelConfig) {
      return NextResponse.json({ error: '无可用 AI 模型' }, { status: 503 })
    }

    const provider = createProvider({
      id: modelConfig.id,
      name: modelConfig.name,
      provider: modelConfig.provider,
      apiKey: modelConfig.apiKeyEncrypted,
      baseUrl: modelConfig.baseUrl,
      modelId: modelConfig.modelId,
    })

    const sqlPrompt = SQL_GENERATION_PROMPT
      .replace('{keyword}', keyword)
      .replace('{startDate}', startDate)
      .replace('{endDate}', endDate)
      .replace('{domain}', domain || '全部')

    const sqlResponse = await provider.chatSync(
      [
        { role: 'system', content: '你是一个 MySQL 专家，只返回 SQL 语句，不返回任何其他内容。' },
        { role: 'user', content: sqlPrompt },
      ],
      { temperature: 0.1, maxTokens: 500 }
    )

    // 清理 SQL（去掉可能的 markdown 标记和 AI 思考过程）
    let sql = sqlResponse.trim()
    // 去掉 markdown 代码块标记
    sql = sql.replace(/^```sql\s*/i, '').replace(/\s*```$/i, '').trim()
    // 去掉 AI 思考过程（CoT thinking blocks），从最后一个 </think> 之后开始提取 SQL
    const thinkTagIndex = sql.toUpperCase().lastIndexOf('</THINK>')
    if (thinkTagIndex !== -1) {
      sql = sql.slice(thinkTagIndex + 8).trim()
    } else {
      // 没有思考标签，移除所有 <think>...<think> 块
      sql = sql.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    }
    console.log('[Sentiment] AI 生成的 SQL:', sql.slice(0, 300))

    // 安全检查：只拦截明确的写操作（精确匹配完整词）
    const sqlUpper = sql.toUpperCase()
    const dangerous = [
      /\bDROP\s+/i,    // DROP TABLE/DATABASE/INDEX...
      /\bTRUNCATE\b/i, // TRUNCATE TABLE
      /\bDELETE\s+FROM\b/i, // DELETE FROM table
      /\bINSERT\b/i,   // INSERT INTO
      /\bUPDATE\b/i,  // UPDATE table SET
      /\bALTER\b/i,   // ALTER TABLE
      /\bCREATE\b/i,   // CREATE TABLE/PROCEDURE/...
      /\bGRANT\b/i,    // GRANT privileges
      /\bREVOKE\b/i,   // REVOKE privileges
      /\bEXEC\b/i,     // EXEC/EXECUTE stored procedures
    ]
    const isDangerous = dangerous.some(re => re.test(sqlUpper))
    if (!sqlUpper.startsWith('SELECT') || isDangerous) {
      return NextResponse.json({ error: 'SQL 生成不安全，已拒绝执行' }, { status: 400 })
    }

    // 2. 执行查询
    let rows: Record<string, unknown>[] = []
    try {
      rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql)
    } catch (err) {
      console.warn('[Sentiment] 查询失败，尝试简化 SQL:', err)
      // 如果 UNION ALL 失败，降级到简单查询
      const simpleSql = `SELECT DATE(created_at) as date, COUNT(*) as count
        FROM user_question_logs
        WHERE question LIKE '%${keyword}%'
          AND created_at BETWEEN '${startDate}' AND '${endDate}'${domain ? ` AND domain = '${domain}'` : ''}
        GROUP BY DATE(created_at)
        ORDER BY date`
      rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(simpleSql)
    }

    // 3. 解析数据结构（按 type 字段区分三个子查询的结果）
    // AI 返回的 SQL 用 UNION ALL，三个子查询分别带 type 标识
    // 但 AI 可能不会按预期加 type，我们从数据特征判断
    type ParsedData = {
      trend: Array<{ date: string; count: number }>
      keywords: Array<{ question: string; count: number }>
      domains: Array<{ domain: string; count: number }>
    }

    const parsed: ParsedData = { trend: [], keywords: [], domains: [] }
    for (const row of rows) {
      const keys = Object.keys(row)
      if (keys.includes('date') && keys.includes('count')) {
        // 日期趋势数据
        parsed.trend.push({
          date: String(row.date ?? ''),
          count: Number(row.count ?? 0),
        })
      } else if (keys.includes('question') || keys.includes('label')) {
        // 关键词频率数据
        parsed.keywords.push({
          question: String(row.question ?? row.label ?? ''),
          count: Number(row.count ?? 0),
        })
      } else if (keys.includes('domain')) {
        // 领域分布数据
        parsed.domains.push({
          domain: String(row.domain ?? ''),
          count: Number(row.count ?? 0),
        })
      }
    }

    // 4. AI 分析结果
    const queryResultJson = JSON.stringify(parsed, null, 2)
    const analysisPrompt = ANALYSIS_PROMPT
      .replace('{keyword}', keyword)
      .replace('{startDate}', startDate)
      .replace('{endDate}', endDate)
      .replace('{domain}', domain || '全部')
      .replace('{queryResult}', queryResultJson)

    const analysisResponse = await provider.chatSync(
      [
        { role: 'system', content: '你是一个数据分析师，用自然语言回答数据分析问题。' },
        { role: 'user', content: analysisPrompt },
      ],
      { temperature: 0.5, maxTokens: 1500 }
    )

    return NextResponse.json({
      sql,
      trend: parsed.trend,
      keywords: parsed.keywords,
      domains: parsed.domains,
      analysis: analysisResponse,
    })
  } catch (err) {
    console.error('[Sentiment Analyze Error]', err)
    const message = err instanceof Error ? err.message : '分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}