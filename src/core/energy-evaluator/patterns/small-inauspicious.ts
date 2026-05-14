/**
 * M2: 格局判定 — 小凶格局（9条）
 *
 * 小凶格局成立后倍率为 × 1.0（只标注，不扣分）
 * 来源：SKILL_宫位原生能级评估 V3.0
 */

import type { PatternPredicate } from './types'
import {
  getSanFangSiZheng,
  isLuoXian,
} from './types'

/**
 * 辅助：加凶格引动条件 — 三方四正煞星数量 > 吉星数量
 */
function isXiongGeYinDong(chart: Parameters<PatternPredicate['evaluate']>[0], palaceIndex: number): boolean {
  const indices = getSanFangSiZheng(chart, palaceIndex)
  const ji = chart.countAuspiciousInPalaces(indices)
  const sha = chart.countInauspiciousInPalaces(indices)
  return sha > ji
}

/**
 * 辅助：丙级桃花星列表
 */
const PEACH_STARS = ['红鸾', '天喜', '咸池', '天姚']

// ─── 1. 紫杀虚权 ──────────────────────────────────────────────
// 紫微七杀在巳亥 + 化权 + 见地空地劫 + 不见左右
const ziShaXuQuan: PatternPredicate = {
  name: '紫杀虚权',
  level: '小凶',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微') || !chart.hasStarInPalace(i, '七杀')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '巳' && zhi !== '亥') continue

      // 化权
      if (!chart.hasSihuaInPalace(i, '化权')) continue

      // 见地空或地劫
      if (!chart.hasStarInPalace(i, '地空') && !chart.hasStarInPalace(i, '地劫')) continue

      // 不见左右（同宫和三方四正都不见）
      const sf = getSanFangSiZheng(chart, i)
      const hasZuoYou = sf.some((idx) =>
        chart.hasStarInPalace(idx, '左辅') || chart.hasStarInPalace(idx, '右弼'),
      )
      if (hasZuoYou) continue

      return true
    }
    return false
  },
}

// ─── 2. 悭吝之人 ──────────────────────────────────────────────
// 贪狼武曲丑未同宫 + 化忌或见煞多
const qianLinZhiRen: PatternPredicate = {
  name: '悭吝之人',
  level: '小凶',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼') || !chart.hasStarInPalace(i, '武曲')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '丑' && zhi !== '未') continue

      // 化忌引动
      if (chart.hasSihuaInPalace(i, '化忌')) return true

      // 见煞多（加凶格引动）
      if (isXiongGeYinDong(chart, i)) return true

      return false
    }
    return false
  },
}

// ─── 3. 败伦乱俗 ──────────────────────────────────────────────
// 巨门天梁分别命身 + 落陷 + 加凶格引动
const baiLunLuanSu: PatternPredicate = {
  name: '败伦乱俗',
  level: '小凶',
  category: '巨门',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    const shenIdx = chart.shenGongIndex

    // 巨门天梁分别命身
    const hasJuMenMingTianLiangShen =
      chart.hasStarInPalace(mingIdx, '巨门') && chart.hasStarInPalace(shenIdx, '天梁')
    const hasTianLiangMingJuMenShen =
      chart.hasStarInPalace(mingIdx, '天梁') && chart.hasStarInPalace(shenIdx, '巨门')
    if (!hasJuMenMingTianLiangShen && !hasTianLiangMingJuMenShen) return false

    // 落陷（命宫或身宫落陷）
    if (!isLuoXian(chart.getPalaceBrightness(mingIdx)) && !isLuoXian(chart.getPalaceBrightness(shenIdx))) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 4. 机月淫贫格 ────────────────────────────────────────────
// 天机太阴分别命身 + 落陷 + 加凶格引动
const jiYueYinPin: PatternPredicate = {
  name: '机月淫贫格',
  level: '小凶',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    const shenIdx = chart.shenGongIndex

    // 天机太阴分别命身
    const hasJiMingYueShen =
      chart.hasStarInPalace(mingIdx, '天机') && chart.hasStarInPalace(shenIdx, '太阴')
    const hasYueMingJiShen =
      chart.hasStarInPalace(mingIdx, '太阴') && chart.hasStarInPalace(shenIdx, '天机')
    if (!hasJiMingYueShen && !hasYueMingJiShen) return false

    // 落陷（命宫或身宫落陷）
    if (!isLuoXian(chart.getPalaceBrightness(mingIdx)) && !isLuoXian(chart.getPalaceBrightness(shenIdx))) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 5. 泛水桃花 ──────────────────────────────────────────────
// 贪狼亥子 + 三方四正丙级桃花星 + 贪狼/廉贞/昌曲化忌 + 见火铃更凶 + 加凶格
const fanShuiTaoHua: PatternPredicate = {
  name: '泛水桃花',
  level: '小凶',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '亥' && zhi !== '子') continue

      // 三方四正见丙级桃花星
      const sf = getSanFangSiZheng(chart, i)
      const hasPeach = sf.some((idx) =>
        chart.getAuxStarsInPalace(idx).some((s) => PEACH_STARS.includes(s)),
      )
      if (!hasPeach) continue

      // 化忌引动：贪狼/廉贞/昌曲化忌或同宫化忌
      const hasHuaJi =
        chart.hasStarSihua('贪狼', '化忌') ||
        chart.hasStarSihua('廉贞', '化忌') ||
        chart.hasSihuaInPalace(i, '化忌')
      if (!hasHuaJi) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 6. 风流彩杖 ──────────────────────────────────────────────
// 贪狼与擎羊/陀罗同宫 + 四桃花星同宫或三方四正 + 化忌引动 + 见火铃更凶 + 加凶格
const fengLiuCaiZhang: PatternPredicate = {
  name: '风流彩杖',
  level: '小凶',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼')) continue
      // 擎羊或陀罗同宫
      if (!chart.hasStarInPalace(i, '擎羊') && !chart.hasStarInPalace(i, '陀罗')) continue

      // 四桃花星同宫或三方四正
      const sf = getSanFangSiZheng(chart, i)
      const hasPeach = sf.some((idx) =>
        chart.getAuxStarsInPalace(idx).some((s) => PEACH_STARS.includes(s)),
      )
      if (!hasPeach) continue

      // 化忌引动
      const hasHuaJi =
        chart.hasStarSihua('贪狼', '化忌') ||
        chart.hasSihuaInPalace(i, '化忌')
      if (!hasHuaJi) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 7. 梁宿太阴飘荡格 ────────────────────────────────────────
// 天梁太阴均落陷 + 不需化忌引动 / 化忌更凶
const liangSuTaiYinPiaoDang: PatternPredicate = {
  name: '梁宿太阴飘荡格',
  level: '小凶',
  category: '机梁同',
  evaluate(chart) {
    // 天梁落陷
    let tianLiangIdx = -1
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '天梁') && isLuoXian(chart.getPalaceBrightness(i))) {
        tianLiangIdx = i
        break
      }
    }
    if (tianLiangIdx < 0) return false

    // 太阴落陷
    let taiYinIdx = -1
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '太阴') && isLuoXian(chart.getPalaceBrightness(i))) {
        taiYinIdx = i
        break
      }
    }
    if (taiYinIdx < 0) return false

    // 不需化忌引动即成格，化忌更凶（此处只判断基本条件）
    return true
  },
}

// ─── 8. 浪荡多淫 ──────────────────────────────────────────────
// 天同天梁分别在巳和亥 + 无禄存坐入
const langDangDuoYin: PatternPredicate = {
  name: '浪荡多淫',
  level: '小凶',
  category: '机梁同',
  evaluate(chart) {
    // 天同在巳、天梁在亥
    let siIdx = -1
    let haiIdx = -1
    for (let i = 0; i < 12; i++) {
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi === '巳' && chart.hasStarInPalace(i, '天同')) siIdx = i
      if (zhi === '亥' && chart.hasStarInPalace(i, '天梁')) haiIdx = i
    }

    // 天同在亥、天梁在巳（互换）
    if (siIdx < 0 || haiIdx < 0) {
      for (let i = 0; i < 12; i++) {
        const zhi = chart.getPalaceDiZhi(i)
        if (zhi === '巳' && chart.hasStarInPalace(i, '天梁')) siIdx = i
        if (zhi === '亥' && chart.hasStarInPalace(i, '天同')) haiIdx = i
      }
    }

    if (siIdx < 0 || haiIdx < 0) return false

    // 无禄存坐入这两个宫位
    if (chart.hasStarInPalace(siIdx, '禄存') || chart.hasStarInPalace(haiIdx, '禄存')) return false

    return true
  },
}

// ─── 9. 折足马 ────────────────────────────────────────────────
// 主星落陷 + 化忌 + 天马陀罗同宫 + 加凶格引动
const zheZuMa: PatternPredicate = {
  name: '折足马',
  level: '小凶',
  category: '其他',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      // 主星落陷
      const stars = chart.getStarsInPalace(i)
      if (stars.length === 0) continue
      const mainStarLuoXian = stars.some((s) => isLuoXian(s.brightness))
      if (!mainStarLuoXian) continue

      // 化忌
      if (!chart.hasSihuaInPalace(i, '化忌')) continue

      // 天马陀罗同宫
      if (!chart.hasStarInPalace(i, '天马') || !chart.hasStarInPalace(i, '陀罗')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

/** 小凶格局列表（9条，×1.0） */
export const smallInauspiciousPatterns: PatternPredicate[] = [
  ziShaXuQuan,
  qianLinZhiRen,
  baiLunLuanSu,
  jiYueYinPin,
  fanShuiTaoHua,
  fengLiuCaiZhang,
  liangSuTaiYinPiaoDang,
  langDangDuoYin,
  zheZuMa,
]
