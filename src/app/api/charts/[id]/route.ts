/**
 * GET   /api/charts/[id]   — 命盘详情（含完整 chartSnapshot）
 * PATCH /api/charts/[id]   — 更新盘别名/备注
 * DELETE /api/charts/[id]  — 删除（删 primary 自动改选最新）
 */
import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  getChartRecord,
  setPrimary,
  deleteChartRecord,
  updateChartRecord,
} from '@/core/chart/chart-record-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params
    const chart = await getChartRecord(id, session.user.id)
    if (!chart) {
      return NextResponse.json({ error: '命盘不存在或无权查看' }, { status: 404 })
    }

    return NextResponse.json({ chart })
  } catch (error) {
    console.error('[charts/:id] 查询失败:', error)
    return NextResponse.json({ error: '获取命盘失败' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
    }
    const { name, note, isPrimary } = body as {
      name?: string
      note?: string | null
      isPrimary?: boolean
    }

    // isPrimary 单独走 setPrimary（同 identity 互斥）
    if (isPrimary === true) {
      await setPrimary(id, session.user.id)
    }

    // name/note 走 updateChartRecord
    if (name !== undefined || note !== undefined) {
      await updateChartRecord(id, session.user.id, { name, note })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[charts/:id] 更新失败:', error)
    const msg = error instanceof Error ? error.message : '更新命盘失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { id } = await params
    await deleteChartRecord(id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[charts/:id] 删除失败:', error)
    const msg = error instanceof Error ? error.message : '删除命盘失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
