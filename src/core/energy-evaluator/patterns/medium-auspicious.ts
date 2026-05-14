/**
 * M2: 格局判定 — 中吉格局（33条）
 *
 * 中吉格局成立后倍率为 × 1.3
 * 来源：SKILL_宫位原生能级评估 V3.0
 */

import type { PatternPredicate, ChartAccessor } from './types'
import {
  getSanFangSiZheng,
  hasZuoYouInSanFang,
  hasStarInSanFang,
  hasSihuaInSanFang,
  isJiGeYinDong,
  isMiaoWang,
  isLuoXian,
  hasLuInSanFang,
} from './types'

// ═══════════════════════════════════════════════════════════════════
// 紫微类
// ═══════════════════════════════════════════════════════════════════

// ─── 1. 紫杀带化权 ──────────────────────────────────────────────
// 紫微七杀同宫巳亥 + 三方四正见左辅或右弼 + 加吉格
const ziShaDaiHuaQuan: PatternPredicate = {
  name: '紫杀带化权',
  level: '中吉',
  category: '紫微',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '紫微') || !chart.hasStarInPalace(i, '七杀')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '巳' && zhi !== '亥') continue

      // 引动：三方四正见左辅或右弼
      if (!hasZuoYouInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 廉贞类
// ═══════════════════════════════════════════════════════════════════

// ─── 2. 雄宿朝垣 ──────────────────────────────────────────────
// 廉贞在未寅申 + 同宫或三方有化禄/禄存 + 喜见左右 + 加吉格
const xiongSuChaoYuan: PatternPredicate = {
  name: '雄宿朝垣',
  level: '中吉',
  category: '廉贞',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '廉贞')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '未' && zhi !== '寅' && zhi !== '申') continue

      const sf = getSanFangSiZheng(chart, i)
      // 同宫或三方有化禄或禄存
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

// ─── 3. 绝处逢生 ──────────────────────────────────────────────
// 廉贞贪狼在亥 + 同宫或三方有化禄/禄存 + 加吉格
const jueChuFengSheng: PatternPredicate = {
  name: '绝处逢生',
  level: '中吉',
  category: '廉贞',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '廉贞') || !chart.hasStarInPalace(i, '贪狼')) continue
      if (chart.getPalaceDiZhi(i) !== '亥') continue

      const sf = getSanFangSiZheng(chart, i)
      // 同宫或三方有化禄或禄存
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

// ═══════════════════════════════════════════════════════════════════
// 武曲类
// ═══════════════════════════════════════════════════════════════════

// ─── 4. 贪武同行 ──────────────────────────────────────────────
// 贪狼武曲在辰戌丑未 + 见吉多 + 加吉格
const tanWuTongXing: PatternPredicate = {
  name: '贪武同行',
  level: '中吉',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼') || !chart.hasStarInPalace(i, '武曲')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '辰' && zhi !== '戌' && zhi !== '丑' && zhi !== '未') continue

      // 加吉格引动条件（包含见吉多判断）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 5. 横发 ──────────────────────────────────────────────────
// 武曲火星或铃星同宫 + 武曲化禄 + 喜见左右 + 加吉格
const hengFa: PatternPredicate = {
  name: '横发',
  level: '中吉',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '武曲')) continue
      // 火星或铃星同宫
      const hasHuoXing = chart.hasStarInPalace(i, '火星')
      const hasLingXing = chart.hasStarInPalace(i, '铃星')
      if (!hasHuoXing && !hasLingXing) continue

      // 武曲化禄
      if (!chart.hasStarSihua('武曲', '化禄')) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 6. 武破白手 ──────────────────────────────────────────────
// 武曲破军在巳 + 化禄或禄存同宫 + 加吉格
const wuPoBaiShou: PatternPredicate = {
  name: '武破白手',
  level: '中吉',
  category: '武曲',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '武曲') || !chart.hasStarInPalace(i, '破军')) continue
      if (chart.getPalaceDiZhi(i) !== '巳') continue

      // 化禄或禄存同宫
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

// ═══════════════════════════════════════════════════════════════════
// 巨门类
// ═══════════════════════════════════════════════════════════════════

// ─── 7. 石中隐玉 ──────────────────────────────────────────────
// 巨门在子午 + 辛癸年生 + 巨门化权/化禄 + 加吉格（化忌不成格）
const shiZhongYinYu: PatternPredicate = {
  name: '石中隐玉',
  level: '中吉',
  category: '巨门',
  evaluate(chart) {
    // 辛年或癸年生
    if (chart.birthGan !== '辛' && chart.birthGan !== '癸') return false

    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '巨门')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '子' && zhi !== '午') continue

      // 巨门化权或化禄
      const hasHuaQuan = chart.hasStarSihua('巨门', '化权')
      const hasHuaLu = chart.hasStarSihua('巨门', '化禄')
      if (!hasHuaQuan && !hasHuaLu) continue

      // 化忌不成格
      if (chart.hasStarSihua('巨门', '化忌')) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 8. 巨机公卿 ──────────────────────────────────────────────
// 巨门天机在卯 + 巨门/天机/太阴化禄 + 加吉格
const juJiGongQing: PatternPredicate = {
  name: '巨机公卿',
  level: '中吉',
  category: '巨门',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '巨门') || !chart.hasStarInPalace(i, '天机')) continue
      if (chart.getPalaceDiZhi(i) !== '卯') continue

      // 巨门/天机/太阴化禄
      const hasHuaLu =
        chart.hasStarSihua('巨门', '化禄') ||
        chart.hasStarSihua('天机', '化禄') ||
        chart.hasStarSihua('太阴', '化禄')
      if (!hasHuaLu) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 9. 巨火羊终身不懈 ────────────────────────────────────────
// 巨门+火星/铃星之一+擎羊/陀罗之一 + 巨门化禄 + 见左右 + 加吉格
const juHuoYangZhongShenBuXie: PatternPredicate = {
  name: '巨火羊终身不懈',
  level: '中吉',
  category: '巨门',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '巨门')) continue

      const sf = getSanFangSiZheng(chart, i)
      // 火星或铃星之一
      const hasHuoOrLing =
        sf.some((idx) => chart.hasStarInPalace(idx, '火星')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
      if (!hasHuoOrLing) continue

      // 擎羊或陀罗之一
      const hasQingYangOrTuoLuo =
        sf.some((idx) => chart.hasStarInPalace(idx, '擎羊')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
      if (!hasQingYangOrTuoLuo) continue

      // 巨门化禄
      if (!chart.hasStarSihua('巨门', '化禄')) continue

      // 见左右
      if (!hasZuoYouInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
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
    // 场景1：天府在未宫，丁年或庚年生
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '天府') && chart.getPalaceDiZhi(i) === '未') {
        if (chart.birthGan === '丁' || chart.birthGan === '庚') {
          // 日月两宫有吉化
          if (hasRiYueJiHua(chart, i)) {
            if (isJiGeYinDong(chart, i)) return true
          }
        }
      }
    }

    // 场景2：武贪在丑宫
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '武曲') && chart.hasStarInPalace(i, '贪狼')) {
        if (chart.getPalaceDiZhi(i) === '丑') {
          // 日月两宫有吉化
          if (hasRiYueJiHua(chart, i)) {
            if (isJiGeYinDong(chart, i)) return true
          }
        }
      }
    }

    return false
  },
}

/** 辅助：检查太阳太阴所在宫位有吉化（化禄/化权/化科） */
function hasRiYueJiHua(chart: ChartAccessor, _baseIndex: number): boolean {
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
// 天同太阴擎羊在午宫 + 丙年生 + 天同化禄 + 见吉多 + 加吉格
const maTouDaiJianRiYue: PatternPredicate = {
  name: '马头带剑',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    // 丙年生
    if (chart.birthGan !== '丙') return false

    for (let i = 0; i < 12; i++) {
      if (chart.getPalaceDiZhi(i) !== '午') continue
      if (!chart.hasStarInPalace(i, '天同') || !chart.hasStarInPalace(i, '太阴') || !chart.hasStarInPalace(i, '擎羊')) continue

      // 天同化禄
      if (!chart.hasStarSihua('天同', '化禄')) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 12. 水澄桂萼 ─────────────────────────────────────────────
// 太阴天同在子 + 太阴/天同化禄或禄存同宫 + 见昌曲或魁钺成格 + 加吉格
const shuiChengGuiE: PatternPredicate = {
  name: '水澄桂萼',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴') || !chart.hasStarInPalace(i, '天同')) continue
      if (chart.getPalaceDiZhi(i) !== '子') continue

      // 太阴/天同化禄或禄存同宫
      const hasHuaLu =
        chart.hasStarSihua('太阴', '化禄') || chart.hasStarSihua('天同', '化禄')
      const hasLuCun = chart.hasStarInPalace(i, '禄存')
      if (!hasHuaLu && !hasLuCun) continue

      // 见昌曲或魁钺
      const sf = getSanFangSiZheng(chart, i)
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      const hasKuiYue =
        sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
      if (!hasChangQu && !hasKuiYue) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 13. 月朗天门 ─────────────────────────────────────────────
// 太阴在亥 + 太阴/天同化禄或禄存 + 见昌曲或魁钺 + 加吉格
const yueLangTianMen: PatternPredicate = {
  name: '月朗天门',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴')) continue
      if (chart.getPalaceDiZhi(i) !== '亥') continue

      // 太阴/天同化禄或禄存
      const hasHuaLu =
        chart.hasStarSihua('太阴', '化禄') || chart.hasStarSihua('天同', '化禄')
      const sf = getSanFangSiZheng(chart, i)
      const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasHuaLu && !hasLuCun) continue

      // 见昌曲或魁钺
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      const hasKuiYue =
        sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
      if (!hasChangQu && !hasKuiYue) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 14. 月朗天门奇格 ─────────────────────────────────────────
// 太阴在亥 + 太阴化忌 + 见昌曲或魁钺 + 三方煞星不多于一颗 + 加吉格
const yueLangTianMenQiGe: PatternPredicate = {
  name: '月朗天门奇格',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴')) continue
      if (chart.getPalaceDiZhi(i) !== '亥') continue

      // 太阴化忌
      if (!chart.hasStarSihua('太阴', '化忌')) continue

      const sf = getSanFangSiZheng(chart, i)
      // 见昌曲或魁钺
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      const hasKuiYue =
        sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
      if (!hasChangQu && !hasKuiYue) continue

      // 三方煞星不多于一颗
      const shaCount = chart.countInauspiciousInPalaces(sf)
      if (shaCount > 1) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 15. 机智灵活 ─────────────────────────────────────────────
// 太阴铃星同宫或三方 + 太阴化禄
const jiZhiLingHuo: PatternPredicate = {
  name: '机智灵活',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    // 太阴化禄
    if (!chart.hasStarSihua('太阴', '化禄')) return false

    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴')) continue
      // 铃星同宫或三方四正
      if (hasStarInSanFang(chart, i, '铃星')) return true
    }
    return false
  },
}

// ─── 16. 威仪俱足 ─────────────────────────────────────────────
// 太阴擎羊或太阴陀罗同宫 + 太阴化禄 + 加吉格
const weiYiJuZu: PatternPredicate = {
  name: '威仪俱足',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阴')) continue
      // 擎羊或陀罗同宫
      const hasQingYang = chart.hasStarInPalace(i, '擎羊')
      const hasTuoLuo = chart.hasStarInPalace(i, '陀罗')
      if (!hasQingYang && !hasTuoLuo) continue

      // 太阴化禄
      if (!chart.hasStarSihua('太阴', '化禄')) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 17. 日月反背 ─────────────────────────────────────────────
// 日月在三方四正落陷相遇 + 太阴化禄 + 见昌曲或魁钺 + 喜见左右 + 加吉格
const riYueFanBei: PatternPredicate = {
  name: '日月反背',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    // 太阴化禄
    if (!chart.hasStarSihua('太阴', '化禄')) return false

    // 找太阳和太阴所在宫位
    let taiYangIdx = -1
    let taiYinIdx = -1
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '太阳')) taiYangIdx = i
      if (chart.hasStarInPalace(i, '太阴')) taiYinIdx = i
    }
    if (taiYangIdx < 0 || taiYinIdx < 0) return false

    // 太阳太阴落陷
    if (!isLuoXian(chart.getPalaceBrightness(taiYangIdx))) return false
    if (!isLuoXian(chart.getPalaceBrightness(taiYinIdx))) return false

    // 日月三方四正相遇
    const sfTaiYang = getSanFangSiZheng(chart, taiYangIdx)
    if (!sfTaiYang.includes(taiYinIdx)) return false

    // 见昌曲或魁钺
    const hasChangQu =
      hasStarInSanFang(chart, taiYinIdx, '文昌') || hasStarInSanFang(chart, taiYinIdx, '文曲')
    const hasKuiYue =
      hasStarInSanFang(chart, taiYinIdx, '天魁') || hasStarInSanFang(chart, taiYinIdx, '天钺')
    if (!hasChangQu && !hasKuiYue) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, taiYinIdx)) return false

    return true
  },
}

// ─── 18. 日月并明 ─────────────────────────────────────────────
// 太阴太阳三合 + 两者庙旺 + 见昌曲或魁钺 + 加吉格
const riYueBingMing: PatternPredicate = {
  name: '日月并明',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    // 找太阳和太阴所在宫位
    let taiYangIdx = -1
    let taiYinIdx = -1
    for (let i = 0; i < 12; i++) {
      if (chart.hasStarInPalace(i, '太阳')) taiYangIdx = i
      if (chart.hasStarInPalace(i, '太阴')) taiYinIdx = i
    }
    if (taiYangIdx < 0 || taiYinIdx < 0) return false

    // 两者庙旺
    if (!isMiaoWang(chart.getPalaceBrightness(taiYangIdx))) return false
    if (!isMiaoWang(chart.getPalaceBrightness(taiYinIdx))) return false

    // 三合关系
    const sf = getSanFangSiZheng(chart, taiYangIdx)
    if (!sf.includes(taiYinIdx)) return false

    // 见昌曲或魁钺
    const hasChangQu =
      hasStarInSanFang(chart, taiYangIdx, '文昌') || hasStarInSanFang(chart, taiYangIdx, '文曲')
    const hasKuiYue =
      hasStarInSanFang(chart, taiYangIdx, '天魁') || hasStarInSanFang(chart, taiYangIdx, '天钺')
    if (!hasChangQu && !hasKuiYue) return false

    // 加吉格引动条件
    if (!isJiGeYinDong(chart, taiYangIdx)) return false

    return true
  },
}

// ─── 19. 丁火辛勤 ─────────────────────────────────────────────
// 太阳在子 + 太阳化禄/禄存/化权/化科/见禄 + 喜见左右 + 加吉格
const dingHuoXinQin: PatternPredicate = {
  name: '丁火辛勤',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阳')) continue
      if (chart.getPalaceDiZhi(i) !== '子') continue

      // 太阳化禄/禄存/化权/化科/见禄
      const hasHuaLu = chart.hasStarSihua('太阳', '化禄')
      const hasLuCun = chart.hasStarInPalace(i, '禄存')
      const hasHuaQuan = chart.hasStarSihua('太阳', '化权')
      const hasHuaKe = chart.hasStarSihua('太阳', '化科')
      const sf = getSanFangSiZheng(chart, i)
      const hasLu = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasHuaLu && !hasLuCun && !hasHuaQuan && !hasHuaKe && !hasLu) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 20. 日丽中天 ─────────────────────────────────────────────
// 太阳在午 + 太阳化禄/禄存/化权/化科/见禄 + 喜见左右 + 加吉格
const riLiZhongTian: PatternPredicate = {
  name: '日丽中天',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阳')) continue
      if (chart.getPalaceDiZhi(i) !== '午') continue

      // 太阳化禄/禄存/化权/化科/见禄
      const hasHuaLu = chart.hasStarSihua('太阳', '化禄')
      const hasLuCun = chart.hasStarInPalace(i, '禄存')
      const hasHuaQuan = chart.hasStarSihua('太阳', '化权')
      const hasHuaKe = chart.hasStarSihua('太阳', '化科')
      const sf = getSanFangSiZheng(chart, i)
      const hasLu = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasHuaLu && !hasLuCun && !hasHuaQuan && !hasHuaKe && !hasLu) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 21. 出世荣华 ─────────────────────────────────────────────
// 太阴太阳同宫 + 见文昌文曲 + 太阴太阳有吉化 + 加吉格
const chuShiRongHua: PatternPredicate = {
  name: '出世荣华',
  level: '中吉',
  category: '日月',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '太阳') || !chart.hasStarInPalace(i, '太阴')) continue

      // 见文昌文曲
      const sf = getSanFangSiZheng(chart, i)
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      if (!hasChangQu) continue

      // 太阴太阳有吉化
      const hasJiHua =
        chart.hasStarSihua('太阳', '化禄') || chart.hasStarSihua('太阳', '化权') ||
        chart.hasStarSihua('太阳', '化科') || chart.hasStarSihua('太阴', '化禄') ||
        chart.hasStarSihua('太阴', '化权') || chart.hasStarSihua('太阴', '化科')
      if (!hasJiHua) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 杀破狼类
// ═══════════════════════════════════════════════════════════════════

// ─── 22. 加官进爵 ─────────────────────────────────────────────
// 破军任意宫位 + 化禄或禄存同宫 + 见吉多 + 加吉格
const jiaGuanJinJue: PatternPredicate = {
  name: '加官进爵',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '破军')) continue

      // 化禄或禄存同宫
      const hasHuaLu = chart.hasSihuaInPalace(i, '化禄')
      const hasLuCun = chart.hasStarInPalace(i, '禄存')
      if (!hasHuaLu && !hasLuCun) continue

      // 加吉格引动条件（含见吉多判断）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 23. 火贪横发 ─────────────────────────────────────────────
// 火星贪狼或铃星贪狼同宫 + 见禄 + 加吉格
const huoTanHengFa: PatternPredicate = {
  name: '火贪横发',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼')) continue
      // 火星或铃星同宫
      const hasHuoXing = chart.hasStarInPalace(i, '火星')
      const hasLingXing = chart.hasStarInPalace(i, '铃星')
      if (!hasHuoXing && !hasLingXing) continue

      // 见禄（化禄或禄存）
      if (!hasLuInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 24. 通权变而多谋 ─────────────────────────────────────────
// 文昌贪狼或文曲贪狼同宫 + 贪狼化禄或同宫化禄 + 见禄存 + 加吉格
const tongQuanBianErDuoMou: PatternPredicate = {
  name: '通权变而多谋',
  level: '中吉',
  category: '杀破狼',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '贪狼')) continue
      // 文昌或文曲同宫
      const hasChang = chart.hasStarInPalace(i, '文昌')
      const hasQu = chart.hasStarInPalace(i, '文曲')
      if (!hasChang && !hasQu) continue

      // 贪狼化禄或同宫化禄
      const hasTanHuaLu = chart.hasStarSihua('贪狼', '化禄')
      const hasGongHuaLu = chart.hasSihuaInPalace(i, '化禄')
      if (!hasTanHuaLu && !hasGongHuaLu) continue

      // 见禄存
      const sf = getSanFangSiZheng(chart, i)
      const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasLuCun) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
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
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天府')) continue

      const sf = getSanFangSiZheng(chart, i)
      // 天相在三方四正
      const hasTianXiang = sf.some((idx) => chart.hasStarInPalace(idx, '天相'))
      if (!hasTianXiang) continue

      // 禄存同宫或同宫化禄
      const hasLuCun = sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄'))
      if (!hasLuCun && !hasHuaLu) continue

      // 无空劫与化忌
      const hasKongJie =
        sf.some((idx) => chart.hasStarInPalace(idx, '地空')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
      if (hasKongJie) continue
      const hasHuaJi = sf.some((idx) => chart.hasSihuaInPalace(idx, '化忌'))
      if (hasHuaJi) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 26. 武府财臣 ─────────────────────────────────────────────
// 天府武曲在子午 + 不见空劫双星 + 见魁钺 + 三方四正见禄 + 加吉格
const wuFuCaiChen: PatternPredicate = {
  name: '武府财臣',
  level: '中吉',
  category: '天府',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天府') || !chart.hasStarInPalace(i, '武曲')) continue
      const zhi = chart.getPalaceDiZhi(i)
      if (zhi !== '子' && zhi !== '午') continue

      const sf = getSanFangSiZheng(chart, i)

      // 不见空劫双星
      const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
      const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
      if (hasKong && hasJie) continue

      // 见魁钺
      const hasKuiYue =
        sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
      if (!hasKuiYue) continue

      // 三方四正见禄
      if (!hasLuInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 机梁同类
// ═══════════════════════════════════════════════════════════════════

// ─── 27. 寿星入庙(机梁同) ─────────────────────────────────────
// 天梁在午 + 丁己癸年生 + 见禄见科 + 加吉格
const shouXingRuMiaoJiLiang: PatternPredicate = {
  name: '寿星入庙',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    // 丁年、己年或癸年生
    if (chart.birthGan !== '丁' && chart.birthGan !== '己' && chart.birthGan !== '癸') return false

    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天梁')) continue
      if (chart.getPalaceDiZhi(i) !== '午') continue

      // 见禄见科
      const sf = getSanFangSiZheng(chart, i)
      const hasLu =
        hasSihuaInSanFang(chart, i, '化禄') ||
        sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      const hasKe = hasSihuaInSanFang(chart, i, '化科')
      if (!hasLu || !hasKe) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 28. 官资清显格 ───────────────────────────────────────────
// 天梁三方会落陷太阳 + 见禄见科 + 喜见科 + 不见左右 + 加吉格
const guanZiQingXian: PatternPredicate = {
  name: '官资清显格',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天梁')) continue

      const sf = getSanFangSiZheng(chart, i)

      // 三方会落陷太阳
      let foundLuoXianTaiYang = false
      for (const idx of sf) {
        if (chart.hasStarInPalace(idx, '太阳') && isLuoXian(chart.getPalaceBrightness(idx))) {
          foundLuoXianTaiYang = true
          break
        }
      }
      if (!foundLuoXianTaiYang) continue

      // 见禄见科
      const hasLu =
        hasSihuaInSanFang(chart, i, '化禄') ||
        sf.some((idx) => chart.hasStarInPalace(idx, '禄存'))
      if (!hasLu) continue

      // 喜见科
      const hasKe = hasSihuaInSanFang(chart, i, '化科')
      if (!hasKe) continue

      // 不见左右
      if (hasZuoYouInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 29. 机梁羊机谋致胜 ───────────────────────────────────────
// 天机天梁擎羊/陀罗同宫或三合 + 见昌曲或魁钺 + 化禄权科更吉
const jiLiangYangJiMouZhiSheng: PatternPredicate = {
  name: '机梁羊机谋致胜',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天机')) continue
      if (!hasStarInSanFang(chart, i, '天梁')) continue

      const sf = getSanFangSiZheng(chart, i)
      // 擎羊或陀罗同宫或三合
      const hasQingYangOrTuoLuo =
        sf.some((idx) => chart.hasStarInPalace(idx, '擎羊')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
      if (!hasQingYangOrTuoLuo) continue

      // 见昌曲或魁钺
      const hasChangQu =
        sf.some((idx) => chart.hasStarInPalace(idx, '文昌')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
      const hasKuiYue =
        sf.some((idx) => chart.hasStarInPalace(idx, '天魁')) ||
        sf.some((idx) => chart.hasStarInPalace(idx, '天钺'))
      if (!hasChangQu && !hasKuiYue) continue

      // 加吉格引动条件（化禄权科越多越吉，体现在吉格引动中）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 30. 位至公卿 ─────────────────────────────────────────────
// 天梁旺宫 + 与文昌或文曲同宫 + 见禄 + 加吉格
const weiZhiGongQing: PatternPredicate = {
  name: '位至公卿',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天梁')) continue
      // 天梁旺宫
      if (!isMiaoWang(chart.getPalaceBrightness(i))) continue

      // 文昌或文曲同宫
      const hasChang = chart.hasStarInPalace(i, '文昌')
      const hasQu = chart.hasStarInPalace(i, '文曲')
      if (!hasChang && !hasQu) continue

      // 见禄
      if (!hasLuInSanFang(chart, i)) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
  },
}

// ─── 31. 天同化权反贵 ─────────────────────────────────────────
// 天同在戌 + 丁年生 + 见吉多 + 加吉格
const tianTongHuaQuanFanGui: PatternPredicate = {
  name: '天同化权反贵',
  level: '中吉',
  category: '机梁同',
  evaluate(chart) {
    // 丁年生
    if (chart.birthGan !== '丁') return false

    for (let i = 0; i < 12; i++) {
      if (!chart.hasStarInPalace(i, '天同')) continue
      if (chart.getPalaceDiZhi(i) !== '戌') continue

      // 加吉格引动条件（含见吉多判断）
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
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
    for (let i = 0; i < 12; i++) {
      const stars = chart.getStarsInPalace(i)
      // 有主星
      if (stars.length === 0) continue

      const sf = getSanFangSiZheng(chart, i)

      // 同时见地空和地劫
      const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
      const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
      if (!hasKong || !hasJie) continue

      // 主星庙旺
      const mainStarMiaoWang = stars.some((s) => isMiaoWang(s.brightness))
      if (!mainStarMiaoWang) continue

      // 加吉格引动条件
      if (!isJiGeYinDong(chart, i)) continue

      return true
    }
    return false
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
    // 检查每个宫位的三方四正
    for (let i = 0; i < 12; i++) {
      const sf = getSanFangSiZheng(chart, i)

      // 检查每一来源是否在命造三方四正集齐化禄+化权+化科
      const sources = ['命造', '父亲', '母亲']
      for (const source of sources) {
        const hasHuaLu = sf.some((idx) => chart.hasSihuaInPalace(idx, '化禄', source))
        const hasHuaQuan = sf.some((idx) => chart.hasSihuaInPalace(idx, '化权', source))
        const hasHuaKe = sf.some((idx) => chart.hasSihuaInPalace(idx, '化科', source))

        if (hasHuaLu && hasHuaQuan && hasHuaKe) return true
      }
    }
    return false
  },
}

/** 中吉格局列表（33条，×1.3） */
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
]
