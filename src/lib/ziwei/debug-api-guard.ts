import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * 调试/阶段 API：生产默认关闭；开发或 ENABLE_DEBUG_API=1 时允许 ADMIN 角色用户。
 */
export async function guardZiweiDebugApi(): Promise<NextResponse | null> {
  const enabled =
    process.env.NODE_ENV === 'development' ||
    process.env.ENABLE_DEBUG_API === '1' ||
    process.env.ENABLE_DEBUG_API === 'true'

  if (!enabled) {
    return NextResponse.json({ error: '调试接口未启用' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  // 收紧权限：仅允许 ADMIN 角色访问调试接口
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  return null
}
