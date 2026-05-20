/**
 * M2: 格局判定 — 大吉格局（9条）
 *
 * 大吉格局成立后倍率为 × 1.5
 * 来源：SKILL_宫位原生能级评估 V3.0
 */

import type { PatternPredicate } from './types'
import {
  getSanFangSiZheng,
  hasZuoYouInSanFang,
  hasStarInSanFang,
  hasSihuaInSanFang,
  isJiGeYinDong,
  isLuoXian,
} from './types'

// ─── 1. 君臣庆会 ───────────────────────────────────────────────
// 紫微或者天府在命宫，三方四正要见全紫微、天府、廉贞、武曲、天相，缺一不可
// 引动：三方四正见左辅或右弼；加吉格引动条件
const junChenQingHui: PatternPredicate = {
  name: '君臣庆会',
  level: '大吉',
  category: '紫微',
  evaluate(chart) {
    // 锚定命宫：紫微或天府必须在命宫
    const mingIdx = chart.mingGongIndex
    const hasZiWei = chart.hasStarInPalace(mingIdx, '紫微')
    const hasTianFu = chart.hasStarInPalace(mingIdx, '天府')
    if (!hasZiWei && !hasTianFu) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    // 三方四正必须见全：紫微、天府、廉贞、武曲、天相
    const allPresent = ['紫微', '天府', '廉贞', '武曲', '天相'].every((star) =>
      sf.some((idx) => chart.hasStarInPalace(idx, star)),
    )
    if (!allPresent) return false

    // 引动条件：三方四正见左辅或右弼
    if (!hasZuoYouInSanFang(chart, mingIdx)) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 2. 紫府同宫终身福厚 ───────────────────────────────────────
// 紫微天府在命宫寅申同宫
// 引动：三方四正见左辅或右弼；加吉格引动条件
const ziFuTongGong: PatternPredicate = {
  name: '紫府同宫终身福厚',
  level: '大吉',
  category: '紫微',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '紫微') || !chart.hasStarInPalace(mingIdx, '天府')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    // 寅申同宫
    if (zhi !== '寅' && zhi !== '申') return false

    // 引动：三方四正见左辅或右弼
    if (!hasZuoYouInSanFang(chart, mingIdx)) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 3. 紫微居午位至公卿 ───────────────────────────────────────
// 紫微在命宫午宫
// 引动：三方四正见左辅或右弼；加吉格引动条件
const ziWeiJuWu: PatternPredicate = {
  name: '紫微居午位至公卿',
  level: '大吉',
  category: '紫微',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '紫微')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '午') return false

    // 引动：三方四正见左辅或右弼
    if (!hasZuoYouInSanFang(chart, mingIdx)) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 4. 腰金衣紫 ──────────────────────────────────────────────
// 廉贞、天府在命宫戌宫
// 引动：廉贞化禄或武曲化禄；喜见左辅右弼，加吉格引动条件
const yaoJinYiZi: PatternPredicate = {
  name: '腰金衣紫',
  level: '大吉',
  category: '廉贞',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞') || !chart.hasStarInPalace(mingIdx, '天府')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '戌') return false

    // 引动：廉贞化禄或武曲化禄
    const lianHuaLu = chart.hasStarSihua('廉贞', '化禄')
    const wuHuaLu = chart.hasStarSihua('武曲', '化禄')
    if (!lianHuaLu && !wuHuaLu) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 5. 限至腾达 ──────────────────────────────────────────────
// 武曲在命宫，铃星、陀罗、文昌同宫或三方四正
// 引动：武曲化禄且辅弼同时作用，加吉格引动条件
const xianZhiTengDa: PatternPredicate = {
  name: '限至腾达',
  level: '大吉',
  category: '武曲',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    // 铃星、陀罗、文昌须同宫或三方四正
    const hasLing = sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
    const hasTuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    const hasChang = sf.some((idx) => chart.hasStarInPalace(idx, '文昌'))
    if (!hasLing || !hasTuo || !hasChang) return false

    // 引动：武曲化禄
    if (!chart.hasStarSihua('武曲', '化禄')) return false

    // 辅弼同时作用（三方四正同时见左辅和右弼）
    const hasZuo = sf.some((idx) => chart.hasStarInPalace(idx, '左辅'))
    const hasYou = sf.some((idx) => chart.hasStarInPalace(idx, '右弼'))
    if (!hasZuo || !hasYou) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 6. 官封三代 ──────────────────────────────────────────────
// 巨门太阳在命宫寅
// 引动：巨门化禄或太阳化禄，巨门化权，太阳化权，太阳化科；喜见左辅右弼，加吉格引动条件
const guanFengSanDai: PatternPredicate = {
  name: '官封三代',
  level: '大吉',
  category: '巨门',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '巨门') || !chart.hasStarInPalace(mingIdx, '太阳')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '寅') return false

    // 引动：巨门化禄或太阳化禄或巨门化权或太阳化权或太阳化科
    const hasHuaLu =
      chart.hasStarSihua('巨门', '化禄') || chart.hasStarSihua('太阳', '化禄')
    const hasHuaQuan =
      chart.hasStarSihua('巨门', '化权') || chart.hasStarSihua('太阳', '化权')
    const hasHuaKe = chart.hasStarSihua('太阳', '化科')
    if (!hasHuaLu && !hasHuaQuan && !hasHuaKe) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 7. 驰名食禄 ──────────────────────────────────────────────
// 命宫太阳在巳巨门在亥，太阳在亥巨门在巳，太阳巨门在申
// 引动：巨门化禄或太阳化禄等；喜见左辅右弼，加吉格引动条件
const chiMingShiLu: PatternPredicate = {
  name: '驰名食禄',
  level: '大吉',
  category: '巨门',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    const mingZhi = chart.getPalaceDiZhi(mingIdx)
    let matched = false

    // 场景3：太阳巨门在申同宫（命宫在申）
    if (mingZhi === '申' && chart.hasStarInPalace(mingIdx, '太阳') && chart.hasStarInPalace(mingIdx, '巨门')) {
      matched = true
    }
    // 场景1&2：太阳巨门对宫（巳亥对冲，命宫在巳或亥）
    if (mingZhi === '巳' && chart.hasStarInPalace(mingIdx, '太阳')) {
      const opp = chart.getOppositeIndex(mingIdx)
      if (chart.getPalaceDiZhi(opp) === '亥' && chart.hasStarInPalace(opp, '巨门')) {
        matched = true
      }
    }
    if (mingZhi === '巳' && chart.hasStarInPalace(mingIdx, '巨门')) {
      const opp = chart.getOppositeIndex(mingIdx)
      if (chart.getPalaceDiZhi(opp) === '亥' && chart.hasStarInPalace(opp, '太阳')) {
        matched = true
      }
    }
    if (mingZhi === '亥' && chart.hasStarInPalace(mingIdx, '太阳')) {
      const opp = chart.getOppositeIndex(mingIdx)
      if (chart.getPalaceDiZhi(opp) === '巳' && chart.hasStarInPalace(opp, '巨门')) {
        matched = true
      }
    }
    if (mingZhi === '亥' && chart.hasStarInPalace(mingIdx, '巨门')) {
      const opp = chart.getOppositeIndex(mingIdx)
      if (chart.getPalaceDiZhi(opp) === '巳' && chart.hasStarInPalace(opp, '太阳')) {
        matched = true
      }
    }

    if (!matched) return false

    // 引动：巨门化禄或太阳化禄或巨门化权或太阳化权或太阳化科
    const hasHuaLu =
      chart.hasStarSihua('巨门', '化禄') || chart.hasStarSihua('太阳', '化禄')
    const hasHuaQuan =
      chart.hasStarSihua('巨门', '化权') || chart.hasStarSihua('太阳', '化权')
    const hasHuaKe = chart.hasStarSihua('太阳', '化科')
    if (!hasHuaLu && !hasHuaQuan && !hasHuaKe) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 8. 阳梁昌禄 ──────────────────────────────────────────────
// 命宫太阳、天梁，文昌或文曲，化禄或禄存会于三方或同宫
// 天梁和太阳同宫于卯最吉，天梁和太阳同是旺宫次之，落陷再次之
// 引动：加吉格引动条件
const yangLiangChangLu: PatternPredicate = {
  name: '阳梁昌禄',
  level: '大吉',
  category: '日月',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '太阳')) return false

    // 太阳天梁同宫于卯最吉
    if (chart.hasStarInPalace(mingIdx, '天梁') && chart.getPalaceDiZhi(mingIdx) === '卯') {
      const sf = getSanFangSiZheng(chart, mingIdx)
      // 三方四正须见文昌或文曲
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      if (!hasChangQu) return false

      // 三方四正须见化禄或禄存
      const hasLu =
        hasSihuaInSanFang(chart, mingIdx, '化禄') ||
        sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasLu) return false

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, mingIdx)) return false
      return true
    }

    // 太阳天梁三方相会（不在同宫）
    if (!hasStarInSanFang(chart, mingIdx, '天梁')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    // 三方四正须见文昌或文曲
    const hasChangQu =
      sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
      sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    if (!hasChangQu) return false

    // 三方四正须见化禄或禄存
    const hasLu =
      hasSihuaInSanFang(chart, mingIdx, '化禄') ||
      sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasLu) return false

    // 太阳落陷则吉象下降但仍可成格
    const sunBright = chart.getPalaceBrightness(mingIdx)
    if (isLuoXian(sunBright)) {
      // 落陷情况：需要更强的引动条件
      if (!isJiGeYinDong(chart, mingIdx)) return false
    }

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 9. 英星入庙晋官加爵 ──────────────────────────────────────
// 破军在命宫子午
// 引动：必须化禄或者禄存同宫，见吉多，最喜见左辅右弼，加吉格引动条件
const yingXingRuMiao: PatternPredicate = {
  name: '英星入庙晋官加爵',
  level: '大吉',
  category: '杀破狼',
  evaluate(chart) {
    // 锚定命宫
    const mingIdx = chart.mingGongIndex
    if (!chart.hasStarInPalace(mingIdx, '破军')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '子' && zhi !== '午') return false

    // 必须化禄或禄存同宫
    const hasHuaLu = chart.hasSihuaInPalace(mingIdx, '化禄')
    const hasLuCun = chart.hasStarInPalace(mingIdx, '禄存')
    if (!hasHuaLu && !hasLuCun) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, mingIdx)) return false

    return true
  },
}

/** 大吉格局列表（9条，×1.5） */
export const greatAuspiciousPatterns: PatternPredicate[] = [
  junChenQingHui,
  ziFuTongGong,
  ziWeiJuWu,
  yaoJinYiZi,
  xianZhiTengDa,
  guanFengSanDai,
  chiMingShiLu,
  yangLiangChangLu,
  yingXingRuMiao,
]
