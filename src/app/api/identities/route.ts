import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Gender, RelationType } from '@prisma/client'

// GET /api/identities — 获取当前用户的命主列表
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const identities = await prisma.identity.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ identities })
  } catch (error) {
    console.error('获取命主列表失败:', error)
    return NextResponse.json(
      { error: '获取命主列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/identities — 添加新命主
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
    const { name, gender, birthday, birthCity, region, relation } = body as {
      name?: string
      gender?: Gender
      birthday?: string
      birthCity?: string
      region?: string
      relation?: RelationType
    }

    if (!name || !gender || !birthday) {
      return NextResponse.json(
        { error: '姓名、性别、出生时间为必填' },
        { status: 400 }
      )
    }

    // 如果这是第一个命主，自动设为活跃
    const existingCount = await prisma.identity.count({
      where: { userId: session.user.id },
    })

    const identity = await prisma.identity.create({
      data: {
        userId: session.user.id,
        name,
        gender,
        birthday,
        birthCity,
        region,
        relation: relation || 'SELF',
        isActive: existingCount === 0,
      },
    })

    return NextResponse.json({ identity }, { status: 201 })
  } catch (error) {
    console.error('添加命主失败:', error)
    return NextResponse.json(
      { error: '添加命主失败' },
      { status: 500 }
    )
  }
}
