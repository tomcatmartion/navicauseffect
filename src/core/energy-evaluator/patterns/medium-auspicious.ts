/**
 * M2: 格局判定 — 中吉格局（33条）
 *
 * 中吉格局成立后倍率为 × 1.3
 * 来源：SKILL_宫位原生能级评估 V3.0
 */

import type { PatternPredicate, ChartAccessor } from './types'
import {
  getSanFangSiZheng,
  hasStarInSanFang,
  hasSihuaInSanFang,
  hasZuoYouInSanFang,
  isJiGeYinDong,
  isMiaoWang,
  isLuoXian,
  checkSanQiFromSameSource,
  hasClampStars,
  hasMinStarsInSanFang,
  isAnchorPalaceEmpty,
  hasLuInSanFang,
} from './types'

// ═══════════════════════════════════════════════════════════════════
// 紫微类
// ═══════════════════════════════════════════════════════════════════

// ─── 1. 紫杀带化权 ──────────────────────────────────────────────
// 紫微七杀命宫同宫巳亥 + 三方四正见左辅或右弼 + 加吉格
const ziShaDaiHuaQuan: PatternPredicate = {
  name: '紫杀带化权',
  level: '中吉',
  category: '紫微',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '紫微') || !chart.hasStarInPalace(mingIdx, '七杀')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '巳' && zhi !== '亥') return false

    if (!hasZuoYouInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 廉贞类
// ═══════════════════════════════════════════════════════════════════

// ─── 2. 雄宿朝垣 ──────────────────────────────────────────────
// 廉贞在命宫未寅申 + 同宫或三方有化禄/禄存 + 喜见左右 + 加吉格
const xiongSuChaoYuan: PatternPredicate = {
  name: '雄宿朝垣',
  level: '中吉',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '未' && zhi !== '寅' && zhi !== '申') return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasHuaLu && !hasLuCun) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 3. 绝处逢生 ──────────────────────────────────────────────
// 廉贞贪狼在命宫亥 + 同宫或三方有化禄/禄存 + 加吉格
const jueChuFengSheng: PatternPredicate = {
  name: '绝处逢生',
  level: '中吉',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞') || !chart.hasStarInPalace(mingIdx, '贪狼')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '亥') return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasHuaLu && !hasLuCun) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 武曲类
// ═══════════════════════════════════════════════════════════════════

// ─── 4. 贪武同行 ──────────────────────────────────────────────
// 贪狼武曲在命宫辰戌丑未 + 见吉多 + 加吉格
const tanWuTongXing: PatternPredicate = {
  name: '贪武同行',
  level: '中吉',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '贪狼') || !chart.hasStarInPalace(mingIdx, '武曲')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '辰' && zhi !== '戌' && zhi !== '丑' && zhi !== '未') return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 5. 横发 ──────────────────────────────────────────────────
// 武曲火星或铃星命宫同宫 + 武曲化禄 + 喜见左右 + 加吉格
const hengFa: PatternPredicate = {
  name: '横发',
  level: '中吉',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲')) return false
    const hasHuoXing = chart.hasStarInPalace(mingIdx, '火星')
    const hasLingXing = chart.hasStarInPalace(mingIdx, '铃星')
    if (!hasHuoXing && !hasLingXing) return false

    if (!chart.hasStarSihua('武曲', '化禄')) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 6. 武破白手 ──────────────────────────────────────────────
// 武曲破军在命宫巳 + 化禄或禄存同宫 + 加吉格
const wuPoBaiShou: PatternPredicate = {
  name: '武破白手',
  level: '中吉',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲') || !chart.hasStarInPalace(mingIdx, '破军')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '巳') return false

    const hasHuaLu = chart.hasSihuaInPalace(mingIdx, '化禄')
    const hasLuCun = chart.hasStarInPalace(mingIdx, '禄存')
    if (!hasHuaLu && !hasLuCun) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 巨门类
// ═══════════════════════════════════════════════════════════════════

// ─── 7. 石中隐玉 ──────────────────────────────────────────────
// 巨门在命宫子午 + 辛癸年生 + 巨门化权/化禄 + 加吉格（化忌不成格）
const shiZhongYinYu: PatternPredicate = {
  name: '石中隐玉',
  level: '中吉',
  category: '巨门',
  evaluate(chart) {
    if (chart.birthGan !== '辛' && chart.birthGan !== '癸') return false

    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '巨门')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '子' && zhi !== '午') return false

    const hasHuaQuan = chart.hasStarSihua('巨门', '化权')
    const hasHuaLu = chart.hasStarSihua('巨门', '化禄')
    if (!hasHuaQuan && !hasHuaLu) return false

    if (chart.hasStarSihua('巨门', '化忌')) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 8. 巨机公卿 ──────────────────────────────────────────────
// 巨门天机在命宫卯 + 巨门/天机/太阴化禄 + 加吉格
const juJiGongQing: PatternPredicate = {
  name: '巨机公卿',
  level: '中吉',
  category: '巨门',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '巨门') || !chart.hasStarInPalace(mingIdx, '天机')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '卯') return false

    const hasHuaLu =
      chart.hasStarSihua('巨门', '化禄') ||
      chart.hasStarSihua('天机', '化禄') ||
      chart.hasStarSihua('太阴', '化禄')
    if (!hasHuaLu) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 9. 巨火羊终身不懈 ────────────────────────────────────────
// 巨门+火星/铃星之一+擎羊/陀罗之一 + 巨门化禄 + 见左右 + 加吉格
const juHuoYangZhongShenBuXie: PatternPredicate = {
  name: '巨火羊终身不懈',
  level: '中吉',
  category: '巨门',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '巨门')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasHuoOrLing =
      sf.some((idx) => chart.hasStarInPalace(idx, '火星')) ||
      sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
    if (!hasHuoOrLing) return false

    const hasQingYangOrTuoLuo =
      sf.some((idx) => chart.hasStarInPalace(idx, '擎羊')) ||
      sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    if (!hasQingYangOrTuoLuo) return false

    if (!chart.hasStarSihua('巨门', '化禄')) return false
    if (!hasZuoYouInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 日月类
// ═══════════════════════════════════════════════════════════════════

// ─── 10. 日月夹财 ─────────────────────────────────────────────
// 天府在未宫丁庚年生 / 武贪在丑宫 + 日月两宫有吉化 + 加吉格
const riYueJiaCai: PatternPredicate = {
  name: '日月夹财',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const mingZhi = chart.getPalaceDiZhi(mingIdx)

    // 场景1：天府在未宫，丁年或庚年生
    if (chart.hasStarInPalace(mingIdx, '天府') && mingZhi === '未') {
      if (chart.birthGan === '丁' || chart.birthGan === '庚') {
        if (hasRiYueJiHua(chart)) {
          if (isJiGeYinDong(chart, mingIdx)) return true
        }
      }
    }

    // 场景2：武贪在丑宫
    if (chart.hasStarInPalace(mingIdx, '武曲') && chart.hasStarInPalace(mingIdx, '贪狼') && mingZhi === '丑') {
      if (hasRiYueJiHua(chart)) {
        if (isJiGeYinDong(chart, mingIdx)) return true
      }
    }

    return false
  },
}

/** 辅助：检查太阳太阴所在宫位有吉化（化禄/化权/化科） */
function hasRiYueJiHua(chart: ChartAccessor): boolean {
  for (let p = 0; p < 12; p++) {
    if (chart.hasStarInPalace(p, '太阳') || chart.hasStarInPalace(p, '太阴')) {
      if (
        chart.hasSihuaInPalace(p, '化禄') ||
        chart.hasSihuaInPalace(p, '化权') ||
        chart.hasSihuaInPalace(p, '化科')
      ) {
        return true
      }
    }
  }
  return false
}

// ─── 11. 马头带剑(日月) ────────────────────────────────────────
// 天同太阴擎羊在命宫午宫 + 丙年生 + 天同化禄 + 见吉多 + 加吉格
const maTouDaiJianRiYue: PatternPredicate = {
  name: '马头带剑(日月)',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    if (chart.birthGan !== '丙') return false

    const mingIdx = chart.anchorPalaceIndex
    if (chart.getPalaceDiZhi(mingIdx) !== '午') return false
    if (!chart.hasStarInPalace(mingIdx, '天同') || !chart.hasStarInPalace(mingIdx, '太阴') || !chart.hasStarInPalace(mingIdx, '擎羊')) return false

    if (!chart.hasStarSihua('天同', '化禄')) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 12. 水澄桂萼 ─────────────────────────────────────────────
// 太阴天同在命宫子 + 太阴/天同化禄或禄存同宫 + 见昌曲或魁钺成格 + 加吉格
const shuiChengGuiE: PatternPredicate = {
  name: '水澄桂萼',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴') || !chart.hasStarInPalace(mingIdx, '天同')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '子') return false

    const hasHuaLu = chart.hasStarSihua('太阴', '化禄') || chart.hasStarSihua('天同', '化禄')
    const hasLuCun = chart.hasStarInPalace(mingIdx, '禄存')
    if (!hasHuaLu && !hasLuCun) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasChangQu = sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) || sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    const hasKuiYue = sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) || sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
    if (!hasChangQu && !hasKuiYue) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 13. 月朗天门 ─────────────────────────────────────────────
// 太阴在命宫亥 + 太阴/天同化禄或禄存 + 见昌曲或魁钺 + 加吉格
const yueLangTianMen: PatternPredicate = {
  name: '月朗天门',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '亥') return false

    const hasHuaLu = chart.hasStarSihua('太阴', '化禄') || chart.hasStarSihua('天同', '化禄')
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasHuaLu && !hasLuCun) return false

    const hasChangQu = sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) || sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    const hasKuiYue = sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) || sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
    if (!hasChangQu && !hasKuiYue) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 14. 月朗天门奇格 ─────────────────────────────────────────
// 太阴在命宫亥 + 太阴化忌 + 见昌曲或魁钺 + 三方煞星不多于一颗 + 加吉格
const yueLangTianMenQiGe: PatternPredicate = {
  name: '月朗天门奇格',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '亥') return false

    if (!chart.hasStarSihua('太阴', '化忌')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasChangQu = sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) || sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    const hasKuiYue = sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) || sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
    if (!hasChangQu && !hasKuiYue) return false

    const shaCount = chart.countInauspiciousInPalaces(sf)
    if (shaCount > 1) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 15. 机智灵活 ─────────────────────────────────────────────
// 太阴铃星命宫同宫或三方 + 太阴化禄
const jiZhiLingHuo: PatternPredicate = {
  name: '机智灵活',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    if (!chart.hasStarSihua('太阴', '化禄')) return false

    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴')) return false
    if (hasStarInSanFang(chart, mingIdx, '铃星')) return true
    return false
  },
}

// ─── 16. 威仪俱足 ─────────────────────────────────────────────
// 太阴擎羊或太阴陀罗命宫同宫 + 太阴化禄 + 加吉格
const weiYiJuZu: PatternPredicate = {
  name: '威仪俱足',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴')) return false
    const hasQingYang = chart.hasStarInPalace(mingIdx, '擎羊')
    const hasTuoLuo = chart.hasStarInPalace(mingIdx, '陀罗')
    if (!hasQingYang && !hasTuoLuo) return false

    if (!chart.hasStarSihua('太阴', '化禄')) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 17. 日月反背 ─────────────────────────────────────────────
// 日月在命宫三方四正落陷相遇 + 太阴化禄 + 见昌曲或魁钺 + 喜见左右 + 加吉格
const riYueFanBei: PatternPredicate = {
  name: '日月反背',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarSihua('太阴', '化禄')) return false

    // 太阳和太阴必须在命宫三方四正范围内
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasTaiYang = sf.some((idx) => chart.hasStarInPalace(idx, '太阳'))
    const hasTaiYin = sf.some((idx) => chart.hasStarInPalace(idx, '太阴'))
    if (!hasTaiYang || !hasTaiYin) return false

    // 太阳落陷
    let taiYangLuoXian = false
    let taiYinLuoXian = false
    for (const idx of sf) {
      const stars = chart.getStarsInPalace(idx)
      for (const s of stars) {
        if (s.star === '太阳' && isLuoXian(s.brightness)) taiYangLuoXian = true
        if (s.star === '太阴' && isLuoXian(s.brightness)) taiYinLuoXian = true
      }
    }
    if (!taiYangLuoXian || !taiYinLuoXian) return false

    const hasChangQu = hasStarInSanFang(chart, mingIdx, '文昌') || hasStarInSanFang(chart, mingIdx, '文曲')
    const hasKuiYue = hasStarInSanFang(chart, mingIdx, '天魁') || hasStarInSanFang(chart, mingIdx, '天钺')
    if (!hasChangQu && !hasKuiYue) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 18. 日月并明 ─────────────────────────────────────────────
// 太阴太阳命宫三合 + 两者庙旺 + 见昌曲或魁钺 + 加吉格
const riYueBingMing: PatternPredicate = {
  name: '日月并明',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 太阳和太阴必须在命宫三方四正范围内
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasTaiYang = sf.some((idx) => chart.hasStarInPalace(idx, '太阳'))
    const hasTaiYin = sf.some((idx) => chart.hasStarInPalace(idx, '太阴'))
    if (!hasTaiYang || !hasTaiYin) return false

    // 太阳太阴庙旺
    let taiYangMiaoWang = false
    let taiYinMiaoWang = false
    for (const idx of sf) {
      const stars = chart.getStarsInPalace(idx)
      for (const s of stars) {
        if (s.star === '太阳' && isMiaoWang(s.brightness)) taiYangMiaoWang = true
        if (s.star === '太阴' && isMiaoWang(s.brightness)) taiYinMiaoWang = true
      }
    }
    if (!taiYangMiaoWang || !taiYinMiaoWang) return false

    const hasChangQu = hasStarInSanFang(chart, mingIdx, '文昌') || hasStarInSanFang(chart, mingIdx, '文曲')
    const hasKuiYue = hasStarInSanFang(chart, mingIdx, '天魁') || hasStarInSanFang(chart, mingIdx, '天钺')
    if (!hasChangQu && !hasKuiYue) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 19. 丁火辛勤 ─────────────────────────────────────────────
// 太阳在命宫子 + 太阳化禄/禄存/化权/化科/见禄 + 喜见左右 + 加吉格
const dingHuoXinQin: PatternPredicate = {
  name: '丁火辛勤',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阳')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '子') return false

    const hasHuaLu = chart.hasStarSihua('太阳', '化禄')
    const hasLuCun = chart.hasStarInPalace(mingIdx, '禄存')
    const hasHuaQuan = chart.hasStarSihua('太阳', '化权')
    const hasHuaKe = chart.hasStarSihua('太阳', '化科')
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasLu = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasHuaLu && !hasLuCun && !hasHuaQuan && !hasHuaKe && !hasLu) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 20. 日丽中天 ─────────────────────────────────────────────
// 太阳在命宫午 + 太阳化禄/禄存/化权/化科/见禄 + 喜见左右 + 加吉格
const riLiZhongTian: PatternPredicate = {
  name: '日丽中天',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阳')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '午') return false

    const hasHuaLu = chart.hasStarSihua('太阳', '化禄')
    const hasLuCun = chart.hasStarInPalace(mingIdx, '禄存')
    const hasHuaQuan = chart.hasStarSihua('太阳', '化权')
    const hasHuaKe = chart.hasStarSihua('太阳', '化科')
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasLu = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasHuaLu && !hasLuCun && !hasHuaQuan && !hasHuaKe && !hasLu) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 21. 出世荣华 ─────────────────────────────────────────────
// 太阴太阳命宫同宫 + 见文昌文曲 + 太阴太阳有吉化 + 加吉格
const chuShiRongHua: PatternPredicate = {
  name: '出世荣华',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阳') || !chart.hasStarInPalace(mingIdx, '太阴')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasChangQu = sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) || sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    if (!hasChangQu) return false

    const hasJiHua =
      chart.hasStarSihua('太阳', '化禄') || chart.hasStarSihua('太阳', '化权') ||
      chart.hasStarSihua('太阳', '化科') || chart.hasStarSihua('太阴', '化禄') ||
      chart.hasStarSihua('太阴', '化权') || chart.hasStarSihua('太阴', '化科')
    if (!hasJiHua) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 杀破狼类
// ═══════════════════════════════════════════════════════════════════

// ─── 22. 加官进爵 ─────────────────────────────────────────────
// 破军在命宫 + 化禄或禄存同宫 + 见吉多 + 加吉格
const jiaGuanJinJue: PatternPredicate = {
  name: '加官进爵',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '破军')) return false

    const hasHuaLu = chart.hasSihuaInPalace(mingIdx, '化禄')
    const hasLuCun = chart.hasStarInPalace(mingIdx, '禄存')
    if (!hasHuaLu && !hasLuCun) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 23. 火贪横发 ─────────────────────────────────────────────
// 火星贪狼或铃星贪狼命宫同宫 + 见禄 + 加吉格
const huoTanHengFa: PatternPredicate = {
  name: '火贪横发',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '贪狼')) return false
    const hasHuoXing = chart.hasStarInPalace(mingIdx, '火星')
    const hasLingXing = chart.hasStarInPalace(mingIdx, '铃星')
    if (!hasHuoXing && !hasLingXing) return false

    if (!hasLuInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 24. 通权变而多谋 ─────────────────────────────────────────
// 文昌贪狼或文曲贪狼命宫同宫 + 贪狼化禄或同宫化禄 + 见禄存 + 加吉格
const tongQuanBianErDuoMou: PatternPredicate = {
  name: '通权变而多谋',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '贪狼')) return false
    const hasChang = chart.hasStarInPalace(mingIdx, '文昌')
    const hasQu = chart.hasStarInPalace(mingIdx, '文曲')
    if (!hasChang && !hasQu) return false

    const hasTanHuaLu = chart.hasStarSihua('贪狼', '化禄')
    const hasGongHuaLu = chart.hasSihuaInPalace(mingIdx, '化禄')
    if (!hasTanHuaLu && !hasGongHuaLu) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasLuCun) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 天府类
// ═══════════════════════════════════════════════════════════════════

// ─── 25. 府相遇禄 ─────────────────────────────────────────────
// 天府天相+禄存 或 天府天相同宫化禄 + 无空劫与化忌 + 加吉格
const fuXiangYuLu: PatternPredicate = {
  name: '府相遇禄',
  level: '中吉',
  category: '天府',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天府')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasTianXiang = sf.some((idx) => chart.hasStarInPalace(idx, '天相'))
    if (!hasTianXiang) return false

    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    if (!hasLuCun && !hasHuaLu) return false

    const hasKongJie = sf.some((idx) => chart.hasStarInPalace(idx, '地空')) || sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
    if (hasKongJie) return false
    const hasHuaJi = sf.some((idx) => chart.hasSihuaInPalace(idx, '化忌'))
    if (hasHuaJi) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 26. 武府财臣 ─────────────────────────────────────────────
// 天府武曲在命宫子午 + 不见空劫双星 + 见魁钺 + 三方四正见禄 + 加吉格
const wuFuCaiChen: PatternPredicate = {
  name: '武府财臣',
  level: '中吉',
  category: '天府',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天府') || !chart.hasStarInPalace(mingIdx, '武曲')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '子' && zhi !== '午') return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
    const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
    if (hasKong && hasJie) return false

    const hasKuiYue = sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) || sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
    if (!hasKuiYue) return false

    if (!hasLuInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 机梁同类
// ═══════════════════════════════════════════════════════════════════

// ─── 27. 寿星入庙(机梁同) ─────────────────────────────────────
// 天梁在命宫午 + 丁己癸年生 + 见禄见科 + 加吉格
const shouXingRuMiaoJiLiang: PatternPredicate = {
  name: '寿星入庙(机梁同)',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    if (chart.birthGan !== '丁' && chart.birthGan !== '己' && chart.birthGan !== '癸') return false

    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天梁')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '午') return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasLu = hasSihuaInSanFang(chart, mingIdx, '化禄') || sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    const hasKe = hasSihuaInSanFang(chart, mingIdx, '化科')
    if (!hasLu || !hasKe) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 28. 官资清显格 ───────────────────────────────────────────
// 天梁三方会落陷太阳 + 见禄见科 + 喜见科 + 不见左右 + 加吉格
const guanZiQingXian: PatternPredicate = {
  name: '官资清显格',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天梁')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    let foundLuoXianTaiYang = false
    for (const idx of sf) {
      if (chart.hasStarInPalace(idx, '太阳') && isLuoXian(chart.getPalaceBrightness(idx))) {
        foundLuoXianTaiYang = true
        break
      }
    }
    if (!foundLuoXianTaiYang) return false

    const hasLu = hasSihuaInSanFang(chart, mingIdx, '化禄') || sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    if (!hasLu) return false

    const hasKe = hasSihuaInSanFang(chart, mingIdx, '化科')
    if (!hasKe) return false

    if (hasZuoYouInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 29. 机梁羊机谋致胜 ───────────────────────────────────────
// 天机天梁擎羊/陀罗同宫或三合 + 见昌曲或魁钺 + 化禄权科更吉
const jiLiangYangJiMouZhiSheng: PatternPredicate = {
  name: '机梁羊机谋致胜',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天机')) return false
    if (!hasStarInSanFang(chart, mingIdx, '天梁')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasQingYangOrTuoLuo = sf.some((idx) => chart.hasStarInPalace(idx, '擎羊')) || sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    if (!hasQingYangOrTuoLuo) return false

    const hasChangQu = sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) || sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    const hasKuiYue = sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) || sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
    if (!hasChangQu && !hasKuiYue) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 30. 位至公卿 ─────────────────────────────────────────────
// 天梁旺宫 + 与文昌或文曲命宫同宫 + 见禄 + 加吉格
const weiZhiGongQing: PatternPredicate = {
  name: '位至公卿',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天梁')) return false
    if (!isMiaoWang(chart.getPalaceBrightness(mingIdx))) return false

    const hasChang = chart.hasStarInPalace(mingIdx, '文昌')
    const hasQu = chart.hasStarInPalace(mingIdx, '文曲')
    if (!hasChang && !hasQu) return false

    if (!hasLuInSanFang(chart, mingIdx)) return false
    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 31. 天同化权反贵 ─────────────────────────────────────────
// 天同在命宫戌 + 丁年生 + 见吉多 + 加吉格
const tianTongHuaQuanFanGui: PatternPredicate = {
  name: '天同化权反贵',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    if (chart.birthGan !== '丁') return false

    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天同')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '戌') return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 其他类
// ═══════════════════════════════════════════════════════════════════

// ─── 32. 异路功名 ─────────────────────────────────────────────
// 三方四正同时见空劫 + 主星庙旺 + 加吉格
const yiLuGongMing: PatternPredicate = {
  name: '异路功名',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return false

    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
    const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
    if (!hasKong || !hasJie) return false

    const mainStarMiaoWang = stars.some((s) => isMiaoWang(s.brightness))
    if (!mainStarMiaoWang) return false

    if (!isJiGeYinDong(chart, mingIdx)) return false
    return true
  },
}

// ─── 33. 三奇嘉会 ─────────────────────────────────────────────
// 无需引动条件，同一来源化禄+化权+化科三方四正会齐即成格
// 四化来源严格隔离
const sanQiJiaHui: PatternPredicate = {
  name: '三奇嘉会',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    const sources = ['命造', '父亲', '母亲']
    for (const source of sources) {
      const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄', source))
      const hasHuaQuan = sf.some((idx) => chart.hasSihuaInPalace(idx, '化权', source))
      const hasHuaKe = sf.some((idx) => chart.hasSihuaInPalace(idx, '化科', source))

      if (hasHuaLu && hasHuaQuan && hasHuaKe) return true
    }
    return false
  },
}

// ─── 34. 府相朝垣 ─────────────────────────────────────────────
// 天府天相分居命宫三方
// 三方四正吉多煞少
const fuXiangChaoYuan: PatternPredicate = {
  name: '府相朝垣',
  level: '中吉',
  category: '天府',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 天府和天相必须在三方四正范围内
    const hasTianFu = sf.some((idx) => chart.hasStarInPalace(idx, '天府'))
    const hasTianXiang = sf.some((idx) => chart.hasStarInPalace(idx, '天相'))
    if (!hasTianFu || !hasTianXiang) return false

    // 三方四正吉多煞少
    const ji = chart.countAuspiciousInPalaces(sf)
    const sha = chart.countInauspiciousInPalaces(sf)
    return ji > sha
  },
}

// ─── 35. 禄合鸳鸯 ─────────────────────────────────────────────
// 禄存与化禄同宫
// 无地空地劫冲破
const luHeYuanYang: PatternPredicate = {
  name: '禄合鸳鸯',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 禄存与化禄同宫
    if (!chart.hasStarInPalace(mingIdx, '禄存')) return false
    if (!chart.hasSihuaInPalace(mingIdx, '化禄')) return false

    // 无地空地劫冲破
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
    const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
    return !hasKong && !hasJie
  },
}

// ─── 36. 双禄朝垣 ─────────────────────────────────────────────
// 禄存与化禄分居命宫三方
// 三方四正吉多
const shuangLuChaoYuan: PatternPredicate = {
  name: '双禄朝垣',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 禄存与化禄分居命宫三方
    const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    if (!hasLuCun || !hasHuaLu) return false

    // 三方四正吉多
    const ji = chart.countAuspiciousInPalaces(sf)
    const sha = chart.countInauspiciousInPalaces(sf)
    return ji > sha
  },
}

// ─── 37. 辅弼拱命 ─────────────────────────────────────────────
// 左辅右弼分居命宫三方
// 命宫主星庙旺
const fuBiGongMing: PatternPredicate = {
  name: '辅弼拱命',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 左辅右弼分居命宫三方
    const hasZuoFu = sf.some((idx) => chart.hasStarInPalace(idx, '左辅'))
    const hasYouBi = sf.some((idx) => chart.hasStarInPalace(idx, '右弼'))
    if (!hasZuoFu || !hasYouBi) return false

    // 命宫主星庙旺
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return false
    return stars.some((s) => isMiaoWang(s.brightness))
  },
}

// ─── 38. 昌曲夹命 ─────────────────────────────────────────────
// 文昌文曲夹命宫
// 命宫主星庙旺
const changQuJiaMing: PatternPredicate = {
  name: '昌曲夹命',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 文昌文曲夹命宫
    if (!hasClampStars(chart, mingIdx, '文昌', '文曲')) return false

    // 命宫主星庙旺
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return false
    return stars.some((s) => isMiaoWang(s.brightness))
  },
}

// ─── 39. 左右夹命 ─────────────────────────────────────────────
// 左辅右弼夹命宫
// 命宫主星庙旺
const zuoYouJiaMing: PatternPredicate = {
  name: '左右夹命',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 左辅右弼夹命宫
    if (!hasClampStars(chart, mingIdx, '左辅', '右弼')) return false

    // 命宫主星庙旺
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return false
    return stars.some((s) => isMiaoWang(s.brightness))
  },
}

// ─── 40. 七杀朝斗 ─────────────────────────────────────────────
// 七杀在子午宫独坐，三方四正会照吉星
// 主威权出众，适合武职或管理工作
const qiShaChaoDou: PatternPredicate = {
  name: '七杀朝斗',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const zhi = chart.getPalaceDiZhi(mingIdx)

    // 七杀在子午宫独坐
    if (zhi !== '子' && zhi !== '午') return false
    if (!chart.hasStarInPalace(mingIdx, '七杀')) return false

    // 三方四正会照吉星（左辅右弼文昌文曲天魁天钺禄存化禄化权化科）
    const sf = getSanFangSiZheng(chart, mingIdx)
    const jiXing = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存']
    const hasJi = sf.some((idx) => jiXing.some((star) => chart.hasStarInPalace(idx, star)))
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    const hasHuaQuan = sf.some((idx) => chart.hasSihuaInPalace(idx, '化权'))
    const hasHuaKe = sf.some((idx) => chart.hasSihuaInPalace(idx, '化科'))

    return hasJi || hasHuaLu || hasHuaQuan || hasHuaKe
  },
}

// ─── 41. 七杀仰斗 ─────────────────────────────────────────────
// 七杀在寅申宫独坐，三方四正会照吉星
// 主威权出众，适合武职或管理工作
const qiShaYangDou: PatternPredicate = {
  name: '七杀仰斗',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const zhi = chart.getPalaceDiZhi(mingIdx)

    // 七杀在寅申宫独坐
    if (zhi !== '寅' && zhi !== '申') return false
    if (!chart.hasStarInPalace(mingIdx, '七杀')) return false

    // 三方四正会照吉星
    const sf = getSanFangSiZheng(chart, mingIdx)
    const jiXing = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存']
    const hasJi = sf.some((idx) => jiXing.some((star) => chart.hasStarInPalace(idx, star)))
    const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
    const hasHuaQuan = sf.some((idx) => chart.hasSihuaInPalace(idx, '化权'))
    const hasHuaKe = sf.some((idx) => chart.hasSihuaInPalace(idx, '化科'))

    return hasJi || hasHuaLu || hasHuaQuan || hasHuaKe
  },
}

// ─── 42. 机月同梁 ─────────────────────────────────────────────
// 天机、太阴、天同、天梁在命宫三方四正会齐
// 经典大格局，主聪明机变、善于谋划、适合公职或企划类工作
const jiYueTongLiang: PatternPredicate = {
  name: '机月同梁',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 四颗星必须在三方四正范围内全部出现
    const hasTianJi = sf.some((idx) => chart.hasStarInPalace(idx, '天机'))
    const hasTaiYin = sf.some((idx) => chart.hasStarInPalace(idx, '太阴'))
    const hasTianTong = sf.some((idx) => chart.hasStarInPalace(idx, '天同'))
    const hasTianLiang = sf.some((idx) => chart.hasStarInPalace(idx, '天梁'))

    return hasTianJi && hasTaiYin && hasTianTong && hasTianLiang
  },
}

// ─── 43. 禄马交驰 ─────────────────────────────────────────────
// 禄存与天马同宫或在对宫
// 主动态来财，越跑越赚，适合经商或流动性工作
const luMaJiaoChi: PatternPredicate = {
  name: '禄马交驰',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 命宫有禄存
    if (!chart.hasStarInPalace(mingIdx, '禄存')) return false

    // 命宫有天马，或对宫有天马
    if (chart.hasStarInPalace(mingIdx, '天马')) return true
    const duiGong = (mingIdx + 6) % 12
    if (chart.hasStarInPalace(duiGong, '天马')) return true

    return false
  },
}

// ─── 44. 天乙拱命 ─────────────────────────────────────────────
// 天魁天钺夹命宫或分居命宫三方
// 主贵人扶持，逢凶化吉
const tianYiGongMing: PatternPredicate = {
  name: '天乙拱命',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 天魁天钺夹命宫
    if (hasClampStars(chart, mingIdx, '天魁', '天钺')) return true

    // 或天魁天钺分居命宫三方
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasTianKui = sf.some((idx) => chart.hasStarInPalace(idx, '天魁'))
    const hasTianYue = sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
    return hasTianKui && hasTianYue
  },
}

// ─── 45. 科权禄夹命 ───────────────────────────────────────────
// 化科、化权、化禄夹命宫
// 主富贵双全，功名显达
const keQuanLuJiaMing: PatternPredicate = {
  name: '科权禄夹命',
  level: '中吉',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const [leftIdx, rightIdx] = chart.getFlankingIndices(mingIdx)

    // 左右邻宫分别有不同化曜
    const sihuaTypes = ['化禄', '化权', '化科'] as const
    const foundSihua = new Set<string>()

    for (const type of sihuaTypes) {
      if (chart.hasSihuaInPalace(leftIdx, type) || chart.hasSihuaInPalace(rightIdx, type)) {
        foundSihua.add(type)
      }
    }

    return foundSihua.has('化禄') && foundSihua.has('化权') && foundSihua.has('化科')
  },
}

// ─── 46. 日月照壁 ─────────────────────────────────────────────
// 太阳太阴在田宅宫同宫或会照
// 主置产丰厚，家宅兴旺
// 田宅宫位置 = (命宫 + 9) % 12
const riYueZhaoBi: PatternPredicate = {
  name: '日月照壁',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    // 田宅宫索引 = (命宫 + 9) % 12
    const tianZhaiIdx = (chart.anchorPalaceIndex + 9) % 12

    // 太阳太阴在田宅宫同宫或会照
    const sf = getSanFangSiZheng(chart, tianZhaiIdx)
    const hasTaiYang = sf.some((idx) => chart.hasStarInPalace(idx, '太阳'))
    const hasTaiYin = sf.some((idx) => chart.hasStarInPalace(idx, '太阴'))
    return hasTaiYang && hasTaiYin
  },
}

// ─── 47. 善荫朝纲 ─────────────────────────────────────────────
// 天梁在旺宫与文昌或文曲同宫
// 主聪明正直，有领导才能，适合公职
const shanYinChaoGang: PatternPredicate = {
  name: '善荫朝纲',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 命宫有天梁
    if (!chart.hasStarInPalace(mingIdx, '天梁')) return false

    // 天梁庙旺
    const stars = chart.getStarsInPalace(mingIdx)
    const tianLiang = stars.find((s) => s.star === '天梁')
    if (!tianLiang || !isMiaoWang(tianLiang.brightness)) return false

    // 与文昌或文曲同宫
    return chart.hasStarInPalace(mingIdx, '文昌') || chart.hasStarInPalace(mingIdx, '文曲')
  },
}

// ─── 48. 紫府朝垣 ─────────────────────────────────────────────
// 紫微天府在三方四正朝照命宫
// 主权贵格局，领导力强
const ziFuChaoYuan: PatternPredicate = {
  name: '紫府朝垣',
  level: '中吉',
  category: '紫微',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 紫微天府在三方四正朝照命宫
    const hasZiWei = sf.some((idx) => chart.hasStarInPalace(idx, '紫微'))
    const hasTianFu = sf.some((idx) => chart.hasStarInPalace(idx, '天府'))
    return hasZiWei && hasTianFu
  },
}

// ─── 49. 廉贞清白 ─────────────────────────────────────────────
// 廉贞在寅申宫独坐，无煞星冲破
// 主清廉正直，有节操
const lianZhenQingBai: PatternPredicate = {
  name: '廉贞清白',
  level: '中吉',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const zhi = chart.getPalaceDiZhi(mingIdx)

    // 廉贞在寅申宫独坐
    if (zhi !== '寅' && zhi !== '申') return false
    if (!chart.hasStarInPalace(mingIdx, '廉贞')) return false

    // 无煞星冲破
    const sf = getSanFangSiZheng(chart, mingIdx)
    const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']
    return !sf.some((idx) => shaXing.some((star) => chart.hasStarInPalace(idx, star)))
  },
}

/** 中吉格局列表（49条，×1.3） */
export const mediumAuspiciousPatterns: PatternPredicate[] = [
  ziShaDaiHuaQuan,
  xiongSuChaoYuan,
  jueChuFengSheng,
  tanWuTongXing,
  hengFa,
  wuPoBaiShou,
  shiZhongYinYu,
  juJiGongQing,
  juHuoYangZhongShenBuXie,
  riYueJiaCai,
  maTouDaiJianRiYue,
  shuiChengGuiE,
  yueLangTianMen,
  yueLangTianMenQiGe,
  jiZhiLingHuo,
  weiYiJuZu,
  riYueFanBei,
  riYueBingMing,
  dingHuoXinQin,
  riLiZhongTian,
  chuShiRongHua,
  jiaGuanJinJue,
  huoTanHengFa,
  tongQuanBianErDuoMou,
  fuXiangYuLu,
  wuFuCaiChen,
  shouXingRuMiaoJiLiang,
  guanZiQingXian,
  jiLiangYangJiMouZhiSheng,
  weiZhiGongQing,
  tianTongHuaQuanFanGui,
  yiLuGongMing,
  sanQiJiaHui,
  fuXiangChaoYuan,
  luHeYuanYang,
  shuangLuChaoYuan,
  fuBiGongMing,
  changQuJiaMing,
  zuoYouJiaMing,
  qiShaChaoDou,
  qiShaYangDou,
  jiYueTongLiang,
  luMaJiaoChi,
  tianYiGongMing,
  keQuanLuJiaMing,
  riYueZhaoBi,
  shanYinChaoGang,
  ziFuChaoYuan,
  lianZhenQingBai,
]
