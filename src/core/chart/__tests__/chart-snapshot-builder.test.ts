/**
 * ChartSnapshot 持久化核心逻辑单元测试
 *
 * 覆盖本次"命盘保存 + Stage1-2 持久化复用"改造的关键路径：
 *   - 差距 C：buildChartSnapshotFromReading 与 buildChartSnapshot 同 birthInfo 产出 stage1/2 一致
 *            （保证前端传 chartData 保存与服务端排盘保存的数据等价）
 *   - 差距 E：stageVersion 版本治理（旧 snapshot / 错版本 → 自动失效触发重算）
 *   - 差距 A 前提：chartDataToBirthInfo 能从 reading 还原 birthInfo（orchestrator 查 DB 持久缓存的指纹基础）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  buildChartSnapshot,
  buildChartSnapshotFromReading,
  computeChartFingerprint,
  isSnapshotCompatible,
  chartDataToBirthInfo,
  STAGE_VERSION,
  type ChartBirthInfo,
  type ChartSnapshot,
} from '../chart-snapshot-builder'

const testBirthInfo: ChartBirthInfo = {
  gender: 'MALE',
  birthday: '1990-05-15 14:00',
  birthCity: '北京',
  region: '北京',
}

// 两次构建只跑一次排盘 + Stage1/2，多个 it 复用（buildChartSnapshot 真排盘约 100ms）
let fromAstro: ChartSnapshot
let fromReading: ChartSnapshot

beforeAll(() => {
  fromAstro = buildChartSnapshot(testBirthInfo)
  fromReading = buildChartSnapshotFromReading({
    chartData: fromAstro.reading,
    birthInfo: testBirthInfo,
  })
})

describe('buildChartSnapshotFromReading（差距C：跳过排盘的数据等价性）', () => {
  it('与 buildChartSnapshot 同 birthInfo 产出 stage1 deep equal', () => {
    expect(fromReading.stage1).toEqual(fromAstro.stage1)
  })

  it('与 buildChartSnapshot 同 birthInfo 产出 stage2 deep equal', () => {
    expect(fromReading.stage2).toEqual(fromAstro.stage2)
  })

  it('产出的 summary 与 buildChartSnapshot 一致（原局信息不变）', () => {
    expect(fromReading.summary).toEqual(fromAstro.summary)
  })

  it('产出包含当前 stageVersion', () => {
    expect(fromReading.stageVersion).toBe(STAGE_VERSION)
    expect(fromAstro.stageVersion).toBe(STAGE_VERSION)
  })

  it('reading 字段直接复用前端 chartData（未重排）', () => {
    expect(fromReading.reading).toBe(fromAstro.reading)
  })
})

describe('isSnapshotCompatible（差距E：版本治理）', () => {
  it('对当前版本返回 true', () => {
    expect(isSnapshotCompatible(fromAstro)).toBe(true)
  })

  it('对错误 stageVersion 返回 false', () => {
    expect(isSnapshotCompatible({ ...fromAstro, stageVersion: 'v0' })).toBe(false)
  })

  it('对缺失 stageVersion 返回 false（旧 snapshot 自动失效，触发重算回写）', () => {
    const partial = { ...fromAstro } as Partial<ChartSnapshot>
    delete partial.stageVersion
    expect(isSnapshotCompatible(partial as ChartSnapshot)).toBe(false)
  })

  it('对缺失 stage1 返回 false', () => {
    const partial = { ...fromAstro } as Partial<ChartSnapshot>
    delete partial.stage1
    expect(isSnapshotCompatible(partial as ChartSnapshot)).toBe(false)
  })
})

describe('chartDataToBirthInfo（差距A前提：orchestrator 查 DB 持久缓存的指纹基础）', () => {
  it('从 snapshot.reading 提取非空 birthInfo', () => {
    const extracted = chartDataToBirthInfo(fromAstro.reading)
    expect(extracted).not.toBeNull()
  })

  it('提取的 gender 与原 birthInfo 一致', () => {
    const extracted = chartDataToBirthInfo(fromAstro.reading)
    expect(extracted?.gender).toBe(testBirthInfo.gender)
  })

  it('字段不全时返回 null（降级安全）', () => {
    expect(chartDataToBirthInfo({})).toBeNull()
    expect(chartDataToBirthInfo({ gender: 'male' })).toBeNull() // 缺 solarDate
  })

  it('提取的 birthInfo 生成的 fingerprint 与原 birthInfo 一致（DB 缓存命中基础）', () => {
    // 差距A的核心验证：保存路径（SaveChartButton 的 birthdayStr）与查询路径（chartDataToBirthInfo）
    // 必须产出相同 fingerprint，否则 DB 持久缓存永久静默失效
    const extracted = chartDataToBirthInfo(fromAstro.reading)
    expect(extracted).not.toBeNull()
    if (extracted) {
      expect(computeChartFingerprint(extracted)).toBe(computeChartFingerprint(testBirthInfo))
    }
  })
})
