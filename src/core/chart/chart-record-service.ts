/**
 * 命盘档案服务 —— ChartRecord 表的业务封装
 *
 * 所有写操作校验 identityId 归属当前 userId；删除 primary 时自动改选最新
 *
 * 仅在 server 端使用（API 路由、Server Action、Server Component）
 *
 * 使用场景：
 *   - chart 页「保存为命盘」按钮 → saveChart
 *   - /charts 列表页 → listChartRecords / setPrimary / deleteChartRecord
 *   - 报告生成 → getOrBuildForIdentity（复用 snapshot，无则现算）
 *   - AI 对话 → getChartRecord（按用户选择）
 *   - 合盘 → getChartRecord × 2
 */
import { prisma } from '@/lib/db'
import {
  buildChartSnapshot,
  computeChartFingerprint,
  isSnapshotCompatible,
  type ChartBirthInfo,
  type ChartSnapshot,
} from './chart-snapshot-builder'

// ════════════════════════════════════════════════════════════
// 类型
// ════════════════════════════════════════════════════════════

export type ChartSource = 'MANUAL' | 'IMPORTED' | 'CHAT' | 'REPORT'

export interface SaveChartInput {
  userId: string
  identityId: string
  /** 盘别名："本人-午时-真太阳时校正" */
  name: string
  /** 出生信息（用于排盘） */
  birthInfo: ChartBirthInfo
  /** 来源 */
  source?: ChartSource
  /** 用户备注 */
  note?: string
  /** 是否设为命主默认盘（同 identity 互斥） */
  isPrimary?: boolean
}

export interface ChartRecordSummary {
  id: string
  identityId: string
  name: string
  birthSolarDate: string
  birthCity: string | null
  timeIndex: number
  gender: 'MALE' | 'FEMALE'
  isPrimary: boolean
  source: ChartSource
  note: string | null
  chartFingerprint: string
  /** 命盘摘要（来自 snapshot.summary，便于列表卡片展示） */
  summary: ChartSnapshot['summary'] | null
  createdAt: Date
  updatedAt: Date
}

// ════════════════════════════════════════════════════════════
// 内部工具
// ════════════════════════════════════════════════════════════

/** 从 ChartSnapshot 提取摘要（用于列表卡片，避免序列化整个 snapshot） */
function extractSummary(snapshot: unknown): ChartSnapshot['summary'] | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const s = snapshot as { summary?: ChartSnapshot['summary'] }
  return s.summary ?? null
}

/** 校验 identityId 归属当前用户 */
async function assertIdentityOwned(identityId: string, userId: string): Promise<void> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { id: true },
  })
  if (!identity) {
    throw new Error('命主不存在或无权操作')
  }
}

/** Prisma ChartRecord → ChartRecordSummary（瘦身后给前端列表用） */
function toSummary(r: {
  id: string
  identityId: string
  name: string
  birthSolarDate: string
  birthCity: string | null
  timeIndex: number
  gender: 'MALE' | 'FEMALE'
  isPrimary: boolean
  source: ChartSource
  note: string | null
  chartFingerprint: string
  chartSnapshot: unknown
  createdAt: Date
  updatedAt: Date
}): ChartRecordSummary {
  return {
    id: r.id,
    identityId: r.identityId,
    name: r.name,
    birthSolarDate: r.birthSolarDate,
    birthCity: r.birthCity,
    timeIndex: r.timeIndex,
    gender: r.gender,
    isPrimary: r.isPrimary,
    source: r.source,
    note: r.note,
    chartFingerprint: r.chartFingerprint,
    summary: extractSummary(r.chartSnapshot),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ════════════════════════════════════════════════════════════
// CRUD
// ════════════════════════════════════════════════════════════

/**
 * 保存命盘（排盘 + 持久化）
 *
 * 流程：
 *   1. 校验 identityId 归属
 *   2. 构建完整 chartSnapshot（排盘 + 序列化 + stage1/2）
 *   3. 写入 ChartRecord
 *   4. 如 isPrimary=true，自动取消同 identity 其他 primary
 *
 * 同一指纹已存在时返回已有记录（幂等）
 */
export async function saveChart(input: SaveChartInput): Promise<ChartRecordSummary> {
  const { userId, identityId, name, birthInfo, source = 'MANUAL', note, isPrimary } = input

  await assertIdentityOwned(identityId, userId)

  // 幂等：同指纹已存在则直接返回
  const fingerprint = computeChartFingerprint(birthInfo)
  const existing = await prisma.chartRecord.findFirst({
    where: { chartFingerprint: fingerprint, identityId },
  })
  if (existing) {
    return toSummary(existing)
  }

  // 构建完整快照
  const snapshot = buildChartSnapshot(birthInfo)

  // 第一个盘自动 primary
  const count = await prisma.chartRecord.count({ where: { identityId } })
  const shouldBePrimary = isPrimary ?? count === 0

  // 互斥：设为 primary 时取消其他
  if (shouldBePrimary) {
    await prisma.chartRecord.updateMany({
      where: { identityId, isPrimary: true },
      data: { isPrimary: false },
    })
  }

  const record = await prisma.chartRecord.create({
    data: {
      identityId,
      userId,
      name: name.trim(),
      chartSnapshot: snapshot as unknown as object,
      chartFingerprint: fingerprint,
      birthSolarDate: snapshot.summary.solarDate,
      birthCity: birthInfo.birthCity ?? null,
      timeIndex: snapshot.birthInfo.hour,
      gender: birthInfo.gender,
      isPrimary: shouldBePrimary,
      note: note?.trim() || null,
      source,
    },
  })

  return toSummary(record)
}

/**
 * 列出用户所有命盘（可按 identityId 过滤）
 *
 * 默认按 isPrimary desc + createdAt desc 排序
 */
export async function listChartRecords(
  userId: string,
  options?: { identityId?: string },
): Promise<ChartRecordSummary[]> {
  const records = await prisma.chartRecord.findMany({
    where: {
      userId,
      ...(options?.identityId ? { identityId: options.identityId } : {}),
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  })
  return records.map(toSummary)
}

/**
 * 获取单个命盘（含完整 chartSnapshot）
 */
export async function getChartRecord(id: string, userId: string) {
  const record = await prisma.chartRecord.findFirst({
    where: { id, userId },
    include: {
      identity: {
        select: { id: true, name: true, gender: true, birthday: true, relation: true },
      },
    },
  })
  return record
}

/**
 * 获取命盘完整快照（带兼容性校验）
 *
 * 不兼容时返回 null，调用方应 fallback 到 getOrBuildForIdentity
 */
export async function getChartSnapshot(id: string, userId: string): Promise<ChartSnapshot | null> {
  const record = await getChartRecord(id, userId)
  if (!record) return null
  const snapshot = record.chartSnapshot as unknown as ChartSnapshot
  if (!isSnapshotCompatible(snapshot)) return null
  return snapshot
}

/**
 * 设为命主默认盘（同 identity 互斥）
 */
export async function setPrimary(id: string, userId: string): Promise<void> {
  const record = await prisma.chartRecord.findFirst({
    where: { id, userId },
    select: { identityId: true },
  })
  if (!record) throw new Error('命盘不存在或无权操作')

  await prisma.$transaction([
    prisma.chartRecord.updateMany({
      where: { identityId: record.identityId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.chartRecord.update({
      where: { id },
      data: { isPrimary: true },
    }),
  ])
}

/**
 * 删除命盘
 *
 * 删除 primary 时，自动将同 identity 最新的盘设为 primary（如有）
 */
export async function deleteChartRecord(id: string, userId: string): Promise<void> {
  const record = await prisma.chartRecord.findFirst({
    where: { id, userId },
    select: { id: true, identityId: true, isPrimary: true },
  })
  if (!record) throw new Error('命盘不存在或无权操作')

  await prisma.chartRecord.delete({ where: { id } })

  // 如果删除的是 primary，且同 identity 还有其他盘，自动选最新
  if (record.isPrimary) {
    const latest = await prisma.chartRecord.findFirst({
      where: { identityId: record.identityId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (latest) {
      await prisma.chartRecord.update({
        where: { id: latest.id },
        data: { isPrimary: true },
      })
    }
  }
}

/**
 * 更新盘别名/备注
 */
export async function updateChartRecord(
  id: string,
  userId: string,
  data: { name?: string; note?: string | null },
): Promise<ChartRecordSummary> {
  const record = await prisma.chartRecord.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
    },
  })
  // 校验归属（update 不校验归属，单独查一次）
  if (record.userId !== userId) {
    throw new Error('命盘不存在或无权操作')
  }
  return toSummary(record)
}

// ════════════════════════════════════════════════════════════
// 业务：报告/对话统一入口
// ════════════════════════════════════════════════════════════

/**
 * 取命主的默认盘 snapshot；无则用 identity 现算并写回（首次访问自动沉淀）
 *
 * 报告生成、AI 对话都应走这个入口，避免每次重排盘
 */
export async function getOrBuildForIdentity(identity: {
  id: string
  userId: string
  name: string
  gender: 'MALE' | 'FEMALE'
  birthday: string
  birthCity?: string | null
  region?: string | null
}): Promise<ChartSnapshot> {
  // 1. 先查 primary 盘
  const primary = await prisma.chartRecord.findFirst({
    where: { identityId: identity.id, isPrimary: true },
    select: { chartSnapshot: true },
  })
  if (primary) {
    const snapshot = primary.chartSnapshot as unknown as ChartSnapshot
    if (isSnapshotCompatible(snapshot)) {
      return snapshot
    }
    // 不兼容：fallback 到现算（但不覆盖现有记录，避免误删用户备注）
  }

  // 2. 现算并写回（source=IMPORTED，标记为自动沉淀）
  const birthInfo: ChartBirthInfo = {
    gender: identity.gender,
    birthday: identity.birthday,
    birthCity: identity.birthCity,
    region: identity.region,
  }
  const snapshot = buildChartSnapshot(birthInfo)

  // 同步写一条 IMPORTED 记录（不抛错，失败仅日志）
  try {
    const fingerprint = computeChartFingerprint(birthInfo)
    // 幂等：先查再写
    const exists = await prisma.chartRecord.findFirst({
      where: { chartFingerprint: fingerprint, identityId: identity.id },
      select: { id: true },
    })
    if (!exists) {
      const count = await prisma.chartRecord.count({ where: { identityId: identity.id } })
      await prisma.chartRecord.create({
        data: {
          identityId: identity.id,
          userId: identity.userId,
          name: `${identity.name}-自动`,
          chartSnapshot: snapshot as unknown as object,
          chartFingerprint: fingerprint,
          birthSolarDate: snapshot.summary.solarDate,
          birthCity: identity.birthCity ?? null,
          timeIndex: snapshot.birthInfo.hour,
          gender: identity.gender,
          isPrimary: count === 0,
          source: 'IMPORTED',
          note: '系统在生成报告时自动沉淀',
        },
      })
    }
  } catch (e) {
    console.error('[chart-record-service] 自动沉淀失败（不影响主流程）:', e instanceof Error ? e.message : e)
  }

  return snapshot
}

/**
 * 批量获取命盘摘要（合盘页/列表页可一次查多盘）
 */
export async function getChartSummaries(ids: string[], userId: string): Promise<ChartRecordSummary[]> {
  if (ids.length === 0) return []
  const records = await prisma.chartRecord.findMany({
    where: { id: { in: ids }, userId },
  })
  return records.map(toSummary)
}
