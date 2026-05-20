/**
 * M2: 格局判定 — 小吉格局（7条）
 *
 * 小吉格局成立后倍率为 × 1.0（只标注，不加分）
 * 来源：SKILL_宫位原生能级评估 V3.0
 */

import type { PatternPredicate } from './types'
import {
  getSanFangSiZheng,
  hasLuInSanFang,
  isJiGeYinDong,
  isMiaoWang,
} from './types'

// ─── 1. 脱俗之僧 ──────────────────────────────────────────────
// 紫微贪狼在命宫卯酉 + 必须见地空地劫 + 见其他吉星
const tuoSuZhiSeng: PatternPredicate = {
  name: '脱俗之僧',
  level: '小吉',
  category: '紫微',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '紫微') || !chart.hasStarInPalace(mingIdx, '贪狼')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '卯' && zhi !== '酉') return false

    if (!chart.hasStarInPalace(mingIdx, '地空') && !chart.hasStarInPalace(mingIdx, '地劫')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    if (chart.countAuspiciousInPalaces(sf) < 1) return false

    return true
  },
}

// ─── 2. 积富之人 ──────────────────────────────────────────────
// 廉贞七杀在命宫未 + 见禄见吉多 + 加吉格引动
const jiFuZhiRen: PatternPredicate = {
  name: '积富之人',
  level: '小吉',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞') || !chart.hasStarInPalace(mingIdx, '七杀')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '未') return false

    if (!hasLuInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 3. 礼乐并施 ──────────────────────────────────────────────
// 廉贞与文昌/文曲命宫同宫 + 同宫或三方有化禄/禄存 + 加吉格引动
const liYueBingShi: PatternPredicate = {
  name: '礼乐并施',
  level: '小吉',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞')) return false
    const hasChang = chart.hasStarInPalace(mingIdx, '文昌')
    const hasQu = chart.hasStarInPalace(mingIdx, '文曲')
    if (!hasChang && !hasQu) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasHuaLu && !hasLuCun) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 4. 日出扶桑 ──────────────────────────────────────────────
// 太阳天同命宫同宫于卯 + 天梁化禄最吉 + 其他吉化 + 加吉格引动
const riChuFuSang: PatternPredicate = {
  name: '日出扶桑',
  level: '小吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '太阳') || !chart.hasStarInPalace(mingIdx, '天梁')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '卯') return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasJiHua =
      sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄')) ||
      sf.some((idx) => chart.hasSihuaInPalace(idx, '化权')) ||
      sf.some((idx) => chart.hasSihuaInPalace(idx, '化科'))
    if (!hasJiHua) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 5. 马头带剑(杀破狼) ──────────────────────────────────────
// 擎羊贪狼在命宫午宫 + 最好贪狼化禄 + 见吉多 + 加吉格引动
const maTouDaiJianShaPoLang: PatternPredicate = {
  name: '马头带剑',
  level: '小吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    if (chart.getPalaceDiZhi(mingIdx) !== '午') return false
    if (!chart.hasStarInPalace(mingIdx, '擎羊') || !chart.hasStarInPalace(mingIdx, '贪狼')) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 6. 寿星入庙(杀破狼) ──────────────────────────────────────
// 贪狼旺宫 + 贪狼同宫无羊陀空劫 + 见多吉星 + 化禄 + 加吉格引动
const shouXingRuMiaoShaPoLang: PatternPredicate = {
  name: '寿星入庙',
  level: '小吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '贪狼')) return false

    const stars = chart.getStarsInPalace(mingIdx)
    const tanLangBright = stars.find((s) => s.star === '贪狼')
    if (!tanLangBright || !isMiaoWang(tanLangBright.brightness)) return false

    if (chart.hasStarInPalace(mingIdx, '擎羊')) return false
    if (chart.hasStarInPalace(mingIdx, '陀罗')) return false
    if (chart.hasStarInPalace(mingIdx, '地空')) return false
    if (chart.hasStarInPalace(mingIdx, '地劫')) return false

    if (!chart.hasStarSihua('贪狼', '化禄')) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 7. 机梁嘉会善谈兵 ────────────────────────────────────────
// 天机天梁同宫或分居命身 + 加吉格引动
const jiLiangJiaHuiShanTanBing: PatternPredicate = {
  name: '机梁嘉会善谈兵',
  level: '小吉',
  category: '机梁同',
  evaluate(chart) {
    // 天机天梁同宫（命宫）
    const mingIdx = chart.mingGongIndex
    if (chart.hasStarInPalace(mingIdx, '天机') && chart.hasStarInPalace(mingIdx, '天梁')) {
      if (isJiGeYinDong(chart, mingIdx)) return true
    }

    // 天机天梁分居命身
    const hasMingJi = chart.hasStarInPalace(mingIdx, '天机')
    const hasShenLiang = chart.hasStarInPalace(chart.shenGongIndex, '天梁')
    const hasMingLiang = chart.hasStarInPalace(mingIdx, '天梁')
    const hasShenJi = chart.hasStarInPalace(chart.shenGongIndex, '天机')

    if ((hasMingJi && hasShenLiang) || (hasMingLiang && hasShenJi)) {
      if (isJiGeYinDong(chart, mingIdx)) return true
    }

    return false
  },
}

/** 小吉格局列表（7条，×1.0） */
export const smallAuspiciousPatterns: PatternPredicate[] = [
  tuoSuZhiSeng,
  jiFuZhiRen,
  liYueBingShi,
  riChuFuSang,
  maTouDaiJianShaPoLang,
  shouXingRuMiaoShaPoLang,
  jiLiangJiaHuiShanTanBing,
]
