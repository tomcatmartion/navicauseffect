/**
 * GET /api/ziwei/router-tree
 * 返回 data/router.json 问诊树（供前端逐步问诊，不含 resolver 表达式）
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRouterTreeForClient } from '@/core/router/router-tree-client'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, data: getRouterTreeForClient() })
}
