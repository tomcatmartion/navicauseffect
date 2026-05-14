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
// 紫微或者天府三方四正要见全紫微、天府、廉贞、武曲、天相，缺一不可
// 引动：三方四正见左辅或右弼；加吉格引动条件
const junChenQingHui: PatternPredicate = {
  name: '君臣庆会',
  level: '大吉',
  category: '紫微',
  evaluate(chart) {
    // 找到紫微或天府所在宫位
    for (let i = 0; i < 12; i++) {
      const hasZiWei = chart.hasStarInPalace(i, '紫微')
      const hasTianFu = chart.hasStarInPalace(i, '天府')
      if (!hasZiWei && !hasTianFu) continue

      const sf = getSanFangSiZheng(chart, i)
      // 三方四正必须见全：紫微、天府、廉贞、武曲、天相
      const allPresent = ['紫微', '天府', '廉贞', '武曲', '天相'].every((star) =>
        sf.some((idx) => chart.hasStarInPalace(idx, star)),
      )
      if (!allPresent) continue

      // 引动条件：三方四正见左辅或右弼
      if (!hasZuoYouInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 2. 紫府同宫终身福厚 ───────────────────────────────────────
// 紫微天府在寅申同宫
// 引动：三方四正见左辅或右弼；加吉格引动条件
const ziFuTongGong: PatternPredicate = {
  name: '紫府同宫终身福厚',
  level: '大吉',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微') || !chart.hasStarInPalace(i, '天府')) continue
      const zhi = chart.getPalaceDiZhi(i)
      // 寅申同宫
      if (zhi !== '寅' && zhi !== '申') continue

      // 引动：三方四正见左辅或右弼
      if (!hasZuoYouInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 3. 紫微居午位至公卿 ───────────────────────────────────────
// 紫微在午宫
// 引动：三方四正见左辅或右弼；加吉格引动条件
const ziWeiJuWu: PatternPredicate = {
  name: '紫微居午位至公卿',
  level: '大吉',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微')) continue
      if (chart.getPalaceDiZhi(i) !== '午') continue

      // 引动：三方四正见左辅或右弼
      if (!hasZuoYouInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 4. 腰金衣紫 ──────────────────────────────────────────────
// 廉贞、天府在戌宫
// 引动：廉贞化禄或武曲化禄；喜见左辅右弼，加吉格引动条件
const yaoJinYiZi: PatternPredicate = {
  name: '腰金衣紫',
  level: '大吉',
  category: '廉贞',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '廉贞') || !chart.hasStarInPalace(i, '天府')) continue
      if (chart.getPalaceDiZhi(i) !== '戌') continue

      // 引动：廉贞化禄或武曲化禄
      const lianHuaLu = chart.hasStarSihua('廉贞', '化禄')
      const wuHuaLu = chart.hasStarSihua('武曲', '化禄')
      if (!lianHuaLu && !wuHuaLu) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 5. 限至腾达 ──────────────────────────────────────────────
// 武曲、铃星、陀罗、文昌同宫或三方四正
// 引动：武曲化禄且辅弼同时作用，加吉格引动条件
const xianZhiTengDa: PatternPredicate = {
  name: '限至腾达',
  level: '大吉',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '武曲')) continue

      const sf = getSanFangSiZheng(chart, i)
      // 铃星、陀罗、文昌须同宫或三方四正
      const hasLing = sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
      const hasTuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
      const hasChang = sf.some((idx) => chart.hasStarInPalace(idx, '文昌'))
      if (!hasLing || !hasTuo || !hasChang) continue

      // 引动：武曲化禄
      if (!chart.hasStarSihua('武曲', '化禄')) continue

      // 辅弼同时作用（三方四正同时见左辅和右弼）
      const hasZuo = sf.some((idx) => chart.hasStarInPalace(idx, '左辅'))
      const hasYou = sf.some((idx) => chart.hasStarInPalace(idx, '右弼'))
      if (!hasZuo || !hasYou) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 6. 官封三代 ──────────────────────────────────────────────
// 巨门太阳在寅
// 引动：巨门化禄或太阳化禄，巨门化权，太阳化权，太阳化科；喜见左辅右弼，加吉格引动条件
const guanFengSanDai: PatternPredicate = {
  name: '官封三代',
  level: '大吉',
  category: '巨门',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '巨门') || !chart.hasStarInPalace(i, '太阳')) continue
      if (chart.getPalaceDiZhi(i) !== '寅') continue

      // 引动：巨门化禄或太阳化禄或巨门化权或太阳化权或太阳化科
      const hasHuaLu =
        chart.hasStarSihua('巨门', '化禄') || chart.hasStarSihua('太阳', '化禄')
      const hasHuaQuan =
        chart.hasStarSihua('巨门', '化权') || chart.hasStarSihua('太阳', '化权')
      const hasHuaKe = chart.hasStarSihua('太阳', '化科')
      if (!hasHuaLu && !hasHuaQuan && !hasHuaKe) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 7. 驰名食禄 ──────────────────────────────────────────────
// 太阳在巳巨门在亥，太阳在亥巨门在巳，太阳巨门在申
// 引动：巨门化禄或太阳化禄等；喜见左辅右弼，加吉格引动条件
const chiMingShiLu: PatternPredicate = {
  name: '驰名食禄',
  level: '大吉',
  category: '巨门',
  evaluate(chart) {
    // 场景1：太阳在巳、巨门在亥（对宫关系）
    // 场景2：太阳在亥、巨门在巳（对宫关系）
    // 场景3：太阳巨门在申同宫
    let matched = false

    for (let i = 0; i < 12; i++) {
      const zhi = chart.getPalaceDiZhi(i)

      // 场景3：太阳巨门在申同宫
      if (zhi === '申' && chart.hasStarInPalace(i, '太阳') && chart.hasStarInPalace(i, '巨门')) {
        matched = true
      }
      // 场景1&2：太阳巨门对宫（巳亥对冲）
      if (zhi === '巳' && chart.hasStarInPalace(i, '太阳')) {
        const opp = chart.getOppositeIndex(i)
        if (chart.getPalaceDiZhi(opp) === '亥' && chart.hasStarInPalace(opp, '巨门')) {
          matched = true
        }
      }
      if (zhi === '巳' && chart.hasStarInPalace(i, '巨门')) {
        const opp = chart.getOppositeIndex(i)
        if (chart.getPalaceDiZhi(opp) === '亥' && chart.hasStarInPalace(opp, '太阳')) {
          matched = true
        }
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

    // 找到匹配宫位，检查加吉格引动条件
    // 使用太阳或巨门所在宫位
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '太阳') || chart.hasStarInPalace(i, '巨门')) {
        if (isJiGeYinDong(chart, i)) return true
      }
    }
    return false
  },
}

// ─── 8. 阳梁昌禄 ──────────────────────────────────────────────
// 太阳、天梁，文昌或文曲，化禄或禄存会于三方或同宫
// 天梁和太阳同宫于卯最吉，天梁和太阳同是旺宫次之，落陷再次之
// 引动：加吉格引动条件
const yangLiangChangLu: PatternPredicate = {
  name: '阳梁昌禄',
  level: '大吉',
  category: '日月',
  evaluate(chart) {
    // 找太阳和天梁
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阳')) continue

      // 太阳天梁同宫于卯最吉
      if (chart.hasStarInPalace(i, '天梁') && chart.getPalaceDiZhi(i) === '卯') {
        const sf = getSanFangSiZheng(chart, i)
        // 三方四正须见文昌或文曲
        const hasChangQu =
          sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
          sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
        if (!hasChangQu) continue

        // 三方四正须见化禄或禄存
        const hasLu =
          hasSihuaInSanFang(chart, i, '化禄') ||
          sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
        if (!hasLu) continue

        // 加吉格引动条件
        if (!isJiGeYinDong(chart, i)) continue
        return true
      }

      // 太阳天梁三方相会（不在同宫）
      if (!hasStarInSanFang(chart, i, '天梁')) continue

      const sf = getSanFangSiZheng(chart, i)
      // 三方四正须见文昌或文曲
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      if (!hasChangQu) continue

      // 三方四正须见化禄或禄存
      const hasLu =
        hasSihuaInSanFang(chart, i, '化禄') ||
        sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasLu) continue

      // 太阳落陷则吉象下降但仍可成格
      const sunBright = chart.getPalaceBrightness(i)
      if (isLuoXian(sunBright)) {
        // 落陷情况：需要更强的引动条件
        if (!isJiGeYinDong(chart, i)) continue
      }

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue
      return true
    }
    return false
  },
}

// ─── 9. 英星入庙晋官加爵 ──────────────────────────────────────
// 破军在子午
// 引动：必须化禄或者禄存同宫，见吉多，最喜见左辅右弼，加吉格引动条件
const yingXingRuMiao: PatternPredicate = {
  name: '英星入庙晋官加爵',
  level: '大吉',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '破军')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '子' && zhi !== '午') continue

      // 必须化禄或禄存同宫
      const hasHuaLu = chart.hasSihuaInPalace(i, '化禄')
      const hasLuCun = chart.hasStarInPalace(i, '禄存')
      if (!hasHuaLu && !hasLuCun) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
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
