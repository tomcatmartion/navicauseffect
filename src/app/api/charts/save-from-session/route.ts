/**
 * POST /api/charts/save-from-session — chart 页从 sessionStorage 一键保存
 *
 * 入参：
 *   {
 *     identityId: string,
 *     name: string,
 *     birthInfo: ChartBirthInfo,  // chart 页 sessionStorage 中的 CHART_STATE_KEY 数据
 *     note?: string,
 *     isPrimary?: boolean
 *   }
 *
 * 返回：{ chart: ChartRecordSummary }（与 POST /api/charts 一致）
 *
 * 实质是 POST /api/charts 的语义化别名，方便前端区分"从已存在的临时盘保存"
 */
import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { saveChart } from '@/core/chart/chart-record-service'
import type { ChartBirthInfo } from '@/core/chart/chart-snapshot-builder'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
    }
    const { identityId, name, birthInfo, chartData, note, isPrimary } = body as {
      identityId?: string
      name?: string
      birthInfo?: ChartBirthInfo
      chartData?: Record<string, unknown> | null
      note?: string
      isPrimary?: boolean
    }

    if (!identityId || !name || !birthInfo) {
      return NextResponse.json(
        { error: '缺少必填字段：identityId / name / birthInfo' },
        { status: 400 },
      )
    }
    if (!birthInfo.gender || !birthInfo.birthday) {
      return NextResponse.json(
        { error: 'birthInfo 缺少 gender 或 birthday' },
        { status: 400 },
      )
    }

    // chartData 结构校验（防止前端异常状态传入空对象导致伪 snapshot 入库）
    if (chartData) {
      const palaces = (chartData as { palaces?: unknown }).palaces
      if (!Array.isArray(palaces) || palaces.length < 12) {
        return NextResponse.json(
          { error: 'chartData 结构非法（palaces 须为数组且至少 12 宫）' },
          { status: 400 },
        )
      }
    }

    const chart = await saveChart({
      userId: session.user.id,
      identityId,
      name: name.trim(),
      birthInfo,
      chartData,
      source: 'MANUAL',
      note,
      isPrimary,
    })

    return NextResponse.json({ chart }, { status: 201 })
  } catch (error) {
    console.error('[charts/save-from-session] 失败:', error)
    const msg = error instanceof Error ? error.message : '保存失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
