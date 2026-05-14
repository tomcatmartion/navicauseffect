/**
 * M2: 格局判定 — 中凶格局（13条）
 *
 * 中凶格局成立后倍率为 × 0.7
 * 来源：SKILL_宫位原生能级评估 V3.0
 */

import type { PatternPredicate } from './types'
import {
  getSanFangSiZheng,
  hasSihuaInSanFang,
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

/**
 * 辅助：四煞星列表
 */
const SI_SHA = ['擎羊', '陀罗', '火星', '铃星']

// ═══════════════════════════════════════════════════════════════════
// 紫微类
// ═══════════════════════════════════════════════════════════════════

// ─── 1. 孤君在野 ──────────────────────────────────────────────
// 紫微任意宫 + 不见左右 + 羊陀火铃之一同宫 + 三方再见其一
// + 三方有化忌或陀罗宫凶 + 加凶格
const guJunZaiYe: PatternPredicate = {
  name: '孤君在野',
  level: '中凶',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微')) continue

      const sf = getSanFangSiZheng(chart, i)

      // 不见左右
      const hasZuoYou = sf.some((idx) =>
        chart.hasStarInPalace(idx, '左辅') || chart.hasStarInPalace(idx, '右弼'),
      )
      if (hasZuoYou) continue

      // 羊陀火铃之一同宫
      const shaInPalace = SI_SHA.some((s) => chart.hasStarInPalace(i, s))
      if (!shaInPalace) continue

      // 三方再见其一（排除同宫）
      const otherSf = sf.filter((idx) => idx !== i)
      const shaInSf = otherSf.filter((idx) =>
        SI_SHA.some((s) => chart.hasStarInPalace(idx, s)),
      )
      if (shaInSf.length === 0) continue

      // 三方有化忌或陀罗宫凶
      const hasHuaJi = hasSihuaInSanFang(chart, i, '化忌')
      const hasTuoLuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
      if (!hasHuaJi && !hasTuoLuo) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 2. 桃花犯主 ──────────────────────────────────────────────
// 紫微贪狼卯酉/子午 + 羊陀火铃之一同宫 + 三方四正丙级桃花星
// + 桃花星宫见忌/煞/贪狼化忌 + 加凶格
const taoHuaFanZhu: PatternPredicate = {
  name: '桃花犯主',
  level: '中凶',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微') || !chart.hasStarInPalace(i, '贪狼')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '卯' && zhi !== '酉' && zhi !== '子' && zhi !== '午') continue

      // 羊陀火铃之一同宫
      if (!SI_SHA.some((s) => chart.hasStarInPalace(i, s))) continue

      const sf = getSanFangSiZheng(chart, i)

      // 三方四正见丙级桃花星
      const hasPeach = sf.some((idx) =>
        chart.getAuxStarsInPalace(idx).some((s) => PEACH_STARS.includes(s)),
      )
      if (!hasPeach) continue

      // 桃花星宫见化忌或煞星或贪狼化忌
      const tanHuaJi = chart.hasStarSihua('贪狼', '化忌')
      const peachPalaceJi = sf.some((idx) =>
        chart.getAuxStarsInPalace(idx).some((s) => PEACH_STARS.includes(s)) &&
        chart.hasSihuaInPalace(idx, '化忌'),
      )
      if (!tanHuaJi && !peachPalaceJi && !chart.hasSihuaInPalace(i, '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 廉贞类
// ═══════════════════════════════════════════════════════════════════

// ─── 3. 破祖离宗 ──────────────────────────────────────────────
// 廉贞破军卯酉同宫 + 破军化禄时贪狼化忌煞多仍破败 / 廉贞化忌 / 昌曲化忌
// + 不喜昌曲 + 加凶格
const poZuLiZong: PatternPredicate = {
  name: '破祖离宗',
  level: '中凶',
  category: '廉贞',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '廉贞') || !chart.hasStarInPalace(i, '破军')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '卯' && zhi !== '酉') continue

      // 廉贞化忌
      if (chart.hasStarSihua('廉贞', '化忌')) {
        if (isXiongGeYinDong(chart, i)) return true
      }

      // 昌曲化忌（不喜昌曲）
      const hasChangHuaJi = chart.hasStarSihua('文昌', '化忌')
      const hasQuHuaJi = chart.hasStarSihua('文曲', '化忌')
      if (hasChangHuaJi || hasQuHuaJi) {
        if (isXiongGeYinDong(chart, i)) return true
      }

      // 破军化禄时贪狼化忌煞多仍破败
      if (chart.hasStarSihua('破军', '化禄') && chart.hasStarSihua('贪狼', '化忌')) {
        if (isXiongGeYinDong(chart, i)) return true
      }

      return false
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 武曲类
// ═══════════════════════════════════════════════════════════════════

// ─── 4. 因财持刀-武曲七杀擎羊 ────────────────────────────────
// 武曲七杀擎羊同宫 + 武曲化忌 + 加凶格
const yinCaiChiDaoWuShaYang: PatternPredicate = {
  name: '因财持刀-武曲七杀擎羊',
  level: '中凶',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '武曲') || !chart.hasStarInPalace(i, '七杀') || !chart.hasStarInPalace(i, '擎羊')) continue

      // 武曲化忌
      if (!chart.hasStarSihua('武曲', '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 5. 因财持刀-武曲擎羊 ────────────────────────────────────
// 武曲擎羊同宫（无七杀，上一个格局覆盖有七杀的情况）+ 武曲化忌 + 加凶格
const yinCaiChiDaoWuYang: PatternPredicate = {
  name: '因财持刀-武曲擎羊',
  level: '中凶',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '武曲') || !chart.hasStarInPalace(i, '擎羊')) continue
      // 七杀由上一个格局覆盖
      if (chart.hasStarInPalace(i, '七杀')) continue

      // 武曲化忌
      if (!chart.hasStarSihua('武曲', '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 6. 寡宿 ──────────────────────────────────────────────────
// 武曲火星或铃星同宫 + 武曲化忌 + 加凶格
const guaSu: PatternPredicate = {
  name: '寡宿',
  level: '中凶',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '武曲')) continue
      // 火星或铃星同宫
      if (!chart.hasStarInPalace(i, '火星') && !chart.hasStarInPalace(i, '铃星')) continue

      // 武曲化忌
      if (!chart.hasStarSihua('武曲', '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 巨门类
// ═══════════════════════════════════════════════════════════════════

// ─── 7. 巨机破荡2 ─────────────────────────────────────────────
// 天机巨门在卯 + 天机化忌或巨门化忌 + 加凶格
const juJiPoDang2: PatternPredicate = {
  name: '巨机破荡2',
  level: '中凶',
  category: '巨门',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天机') || !chart.hasStarInPalace(i, '巨门')) continue
      if (chart.getPalaceDiZhi(i) !== '卯') continue

      // 天机化忌或巨门化忌
      if (!chart.hasStarSihua('天机', '化忌') && !chart.hasStarSihua('巨门', '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 日月类
// ═══════════════════════════════════════════════════════════════════

// ─── 8. 十恶格 ────────────────────────────────────────────────
// 太阴铃星同宫或三方 + 太阴化忌
const shiEGe: PatternPredicate = {
  name: '十恶格',
  level: '中凶',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴')) continue

      // 铃星同宫或三方四正
      const sf = getSanFangSiZheng(chart, i)
      const hasLingXing = sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
      if (!hasLingXing) continue

      // 太阴化忌
      if (!chart.hasStarSihua('太阴', '化忌')) continue

      return true
    }
    return false
  },
}

// ─── 9. 人离财散 ──────────────────────────────────────────────
// 太阴擎羊或太阴陀罗同宫 + 太阴化忌（擎羊>陀罗严重）
const renLiCaiSan: PatternPredicate = {
  name: '人离财散',
  level: '中凶',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴')) continue
      // 擎羊或陀罗同宫
      if (!chart.hasStarInPalace(i, '擎羊') && !chart.hasStarInPalace(i, '陀罗')) continue

      // 太阴化忌
      if (!chart.hasStarSihua('太阴', '化忌')) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 杀破狼类
// ═══════════════════════════════════════════════════════════════════

// ─── 10. 贫士格 ───────────────────────────────────────────────
// 破军文曲同宫 + 昌曲化忌 + 加凶格
const pinShiGe: PatternPredicate = {
  name: '贫士格',
  level: '中凶',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '破军')) continue
      if (!chart.hasStarInPalace(i, '文曲')) continue

      // 昌曲化忌
      if (!chart.hasStarSihua('文昌', '化忌') && !chart.hasStarSihua('文曲', '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 11. 火贪横破 ─────────────────────────────────────────────
// 火星贪狼或铃星贪狼同宫 + 贪狼化忌或同宫化忌 + 加凶格
const huoTanHengPo: PatternPredicate = {
  name: '火贪横破',
  level: '中凶',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼')) continue
      // 火星或铃星同宫
      if (!chart.hasStarInPalace(i, '火星') && !chart.hasStarInPalace(i, '铃星')) continue

      // 贪狼化忌或同宫化忌
      if (!chart.hasStarSihua('贪狼', '化忌') && !chart.hasSihuaInPalace(i, '化忌')) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 机梁同类
// ═══════════════════════════════════════════════════════════════════

// ─── 12. 机梁羊刑克见孤 ───────────────────────────────────────
// 天机天梁擎羊/陀罗同宫或三合 + 三方四正即成格不需化忌 / 化忌更凶
const jiLiangYangXingKeJianGu: PatternPredicate = {
  name: '机梁羊刑克见孤',
  level: '中凶',
  category: '机梁同',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天机')) continue
      if (!chart.hasStarInPalace(i, '天梁')) continue

      // 擎羊或陀罗同宫
      if (!chart.hasStarInPalace(i, '擎羊') && !chart.hasStarInPalace(i, '陀罗')) continue

      // 三方四正即成格，不需化忌引动
      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 其他类
// ═══════════════════════════════════════════════════════════════════

// ─── 13. 半空折翅 ─────────────────────────────────────────────
// 三方四正同时见空劫 + 主星落陷 + 加凶格
const banKongZheChi: PatternPredicate = {
  name: '半空折翅',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      // 主星落陷
      const stars = chart.getStarsInPalace(i)
      if (stars.length === 0) continue
      const mainStarLuoXian = stars.some((s) => isLuoXian(s.brightness))
      if (!mainStarLuoXian) continue

      const sf = getSanFangSiZheng(chart, i)

      // 同时见地空和地劫
      const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
      const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
      if (!hasKong || !hasJie) continue

      // 加凶格引动
      if (!isXiongGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

/** 中凶格局列表（13条，×0.7） */
export const mediumInauspiciousPatterns: PatternPredicate[] = [
  guJunZaiYe,
  taoHuaFanZhu,
  poZuLiZong,
  yinCaiChiDaoWuShaYang,
  yinCaiChiDaoWuYang,
  guaSu,
  juJiPoDang2,
  shiEGe,
  renLiCaiSan,
  pinShiGe,
  huoTanHengPo,
  jiLiangYangXingKeJianGu,
  banKongZheChi,
]
