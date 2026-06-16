/**
 * GET  /api/charts            — 列出当前用户的所有命盘（按 isPrimary + createdAt 排序）
 * POST /api/charts            — 创建命盘（排盘 + 持久化）
 *
 * 入参 POST：
 *   {
 *     identityId: string,
 *     name: string,                  // 盘别名
 *     birthInfo: {
 *       gender: 'MALE' | 'FEMALE',
 *       birthday: string,            // "YYYY-MM-DD HH:mm"
 *       birthCity?: string,
 *       region?: string,
 *       solar?: boolean              // 默认 true
 *     },
 *     source?: 'MANUAL' | 'CHAT' | 'REPORT',  // 默认 MANUAL
 *     note?: string,
 *     isPrimary?: boolean
 *   }
 */
import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  saveChart,
  listChartRecords,
  type ChartSource,
} from '@/core/chart/chart-record-service'
import type { ChartBirthInfo } from '@/core/chart/chart-snapshot-builder'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const identityId = searchParams.get('identityId') ?? undefined

    const charts = await listChartRecords(session.user.id, { identityId })
    return NextResponse.json({ charts })
  } catch (error) {
    console.error('[charts] 列表失败:', error)
    return NextResponse.json({ error: '获取命盘列表失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()
    const { identityId, name, birthInfo, source, note, isPrimary } = body as {
      identityId?: string
      name?: string
      birthInfo?: ChartBirthInfo
      source?: ChartSource
      note?: string
      isPrimary?: boolean
    }

    // 入参校验
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
    if (birthInfo.gender !== 'MALE' && birthInfo.gender !== 'FEMALE') {
      return NextResponse.json(
        { error: 'gender 必须为 MALE 或 FEMALE' },
        { status: 400 },
      )
    }

    const chart = await saveChart({
      userId: session.user.id,
      identityId,
      name: name.trim(),
      birthInfo,
      source: source ?? 'MANUAL',
      note,
      isPrimary,
    })

    return NextResponse.json({ chart }, { status: 201 })
  } catch (error) {
    console.error('[charts] 创建失败:', error)
    const msg = error instanceof Error ? error.message : '创建命盘失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
