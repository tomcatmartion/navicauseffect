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
// 紫微贪狼在卯酉 + 必须见地空地劫 + 见其他吉星
const tuoSuZhiSeng: PatternPredicate = {
  name: '脱俗之僧',
  level: '小吉',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微') || !chart.hasStarInPalace(i, '贪狼')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '卯' && zhi !== '酉') continue

      // 必须见地空或地劫
      if (!chart.hasStarInPalace(i, '地空') && !chart.hasStarInPalace(i, '地劫')) continue

      // 见其他吉星（三方四正中有吉星）
      const sf = getSanFangSiZheng(chart, i)
      if (chart.countAuspiciousInPalaces(sf) < 1) continue

      return true
    }
    return false
  },
}

// ─── 2. 积富之人 ──────────────────────────────────────────────
// 廉贞七杀在未 + 见禄见吉多 + 加吉格引动
const jiFuZhiRen: PatternPredicate = {
  name: '积富之人',
  level: '小吉',
  category: '廉贞',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '廉贞') || !chart.hasStarInPalace(i, '七杀')) continue
      if (chart.getPalaceDiZhi(i) !== '未') continue

      // 见禄
      if (!hasLuInSanFang(chart, i)) continue

      // 加吉格引动条件（含见吉多判断）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 3. 礼乐并施 ──────────────────────────────────────────────
// 廉贞与文昌/文曲同宫 + 同宫或三方有化禄/禄存 + 加吉格引动
const liYueBingShi: PatternPredicate = {
  name: '礼乐并施',
  level: '小吉',
  category: '廉贞',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '廉贞')) continue
      // 文昌或文曲同宫
      const hasChang = chart.hasStarInPalace(i, '文昌')
      const hasQu = chart.hasStarInPalace(i, '文曲')
      if (!hasChang && !hasQu) continue

      // 同宫或三方有化禄/禄存
      const sf = getSanFangSiZheng(chart, i)
      const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
      const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasHuaLu && !hasLuCun) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 4. 日出扶桑 ──────────────────────────────────────────────
// 太阳天梁同宫于卯 + 天梁化禄最吉 + 其他吉化 + 加吉格引动
const riChuFuSang: PatternPredicate = {
  name: '日出扶桑',
  level: '小吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阳') || !chart.hasStarInPalace(i, '天梁')) continue
      if (chart.getPalaceDiZhi(i) !== '卯') continue

      // 见吉化（天梁化禄最吉，其他化禄/化权/化科也可）
      const sf = getSanFangSiZheng(chart, i)
      const hasJiHua =
        sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄')) ||
        sf.some((idx) => chart.hasSihuaInPalace(idx, '化权')) ||
        sf.some((idx) => chart.hasSihuaInPalace(idx, '化科'))
      if (!hasJiHua) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 5. 马头带剑(杀破狼) ──────────────────────────────────────
// 擎羊贪狼在午宫 + 最好贪狼化禄 + 见吉多 + 加吉格引动
const maTouDaiJianShaPoLang: PatternPredicate = {
  name: '马头带剑',
  level: '小吉',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (chart.getPalaceDiZhi(i) !== '午') continue
      if (!chart.hasStarInPalace(i, '擎羊') || !chart.hasStarInPalace(i, '贪狼')) continue

      // 加吉格引动条件（含见吉多判断）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 6. 寿星入庙(杀破狼) ──────────────────────────────────────
// 贪狼旺宫 + 贪狼同宫无羊陀空劫 + 见多吉星 + 化禄 + 加吉格引动
const shouXingRuMiaoShaPoLang: PatternPredicate = {
  name: '寿星入庙',
  level: '小吉',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼')) continue

      // 贪狼旺宫
      const stars = chart.getStarsInPalace(i)
      const tanLangBright = stars.find((s) => s.star === '贪狼')
      if (!tanLangBright || !isMiaoWang(tanLangBright.brightness)) continue

      // 同宫无羊陀空劫
      if (chart.hasStarInPalace(i, '擎羊')) continue
      if (chart.hasStarInPalace(i, '陀罗')) continue
      if (chart.hasStarInPalace(i, '地空')) continue
      if (chart.hasStarInPalace(i, '地劫')) continue

      // 化禄
      if (!chart.hasStarSihua('贪狼', '化禄')) continue

      // 加吉格引动条件（含见多吉星判断）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 7. 机梁嘉会善谈兵 ────────────────────────────────────────
// 天机天梁同宫或分居命身 + 加吉格引动
const jiLiangJiaHuiShanTanBing: PatternPredicate = {
  name: '机梁嘉会善谈兵',
  level: '小吉',
  category: '机梁同',
  evaluate(chart) {
    // 天机天梁同宫
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '天机') && chart.hasStarInPalace(i, '天梁')) {
        if (isJiGeYinDong(chart, i)) return true
      }
    }

    // 天机天梁分居命身
    const hasMingJi = chart.hasStarInPalace(chart.mingGongIndex, '天机')
    const hasShenLiang = chart.hasStarInPalace(chart.shenGongIndex, '天梁')
    const hasMingLiang = chart.hasStarInPalace(chart.mingGongIndex, '天梁')
    const hasShenJi = chart.hasStarInPalace(chart.shenGongIndex, '天机')

    if ((hasMingJi && hasShenLiang) || (hasMingLiang && hasShenJi)) {
      if (isJiGeYinDong(chart, chart.mingGongIndex)) return true
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
