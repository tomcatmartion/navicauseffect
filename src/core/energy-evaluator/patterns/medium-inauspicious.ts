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
  hasClampStars,
  hasMinStarsInSanFang,
  isAnchorPalaceEmpty,
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
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '紫微')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 不见左右
    const hasZuoYou = sf.some((idx) =>
      chart.hasStarInPalace(idx, '左辅') || chart.hasStarInPalace(idx, '右弼'),
    )
    if (hasZuoYou) return false

    // 羊陀火铃之一同宫
    const shaInPalace = SI_SHA.some((s) => chart.hasStarInPalace(mingIdx, s))
    if (!shaInPalace) return false

    // 三方再见其一（排除同宫）
    const otherSf = sf.filter((idx) => idx !== mingIdx)
    const shaInSf = otherSf.filter((idx) =>
      SI_SHA.some((s) => chart.hasStarInPalace(idx, s)),
    )
    if (shaInSf.length === 0) return false

    // 三方有化忌或陀罗宫凶
    const hasHuaJi = hasSihuaInSanFang(chart, mingIdx, '化忌')
    const hasTuoLuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    if (!hasHuaJi && !hasTuoLuo) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
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
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '紫微') || !chart.hasStarInPalace(mingIdx, '贪狼')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '卯' && zhi !== '酉' && zhi !== '子' && zhi !== '午') return false

    // 羊陀火铃之一同宫
    if (!SI_SHA.some((s) => chart.hasStarInPalace(mingIdx, s))) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 三方四正见丙级桃花星
    const hasPeach = sf.some((idx) =>
      chart.getAuxStarsInPalace(idx).some((s) => PEACH_STARS.includes(s)),
    )
    if (!hasPeach) return false

    // 桃花星宫见化忌或煞星或贪狼化忌
    const tanHuaJi = chart.hasStarSihua('贪狼', '化忌')
    const peachPalaceJi = sf.some((idx) =>
      chart.getAuxStarsInPalace(idx).some((s) => PEACH_STARS.includes(s)) &&
      chart.hasSihuaInPalace(idx, '化忌'),
    )
    if (!tanHuaJi && !peachPalaceJi && !chart.hasSihuaInPalace(mingIdx, '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
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
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞') || !chart.hasStarInPalace(mingIdx, '破军')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '卯' && zhi !== '酉') return false

    // 廉贞化忌
    if (chart.hasStarSihua('廉贞', '化忌')) {
      if (isXiongGeYinDong(chart, mingIdx)) return true
    }

    // 昌曲化忌（不喜昌曲）
    const hasChangHuaJi = chart.hasStarSihua('文昌', '化忌')
    const hasQuHuaJi = chart.hasStarSihua('文曲', '化忌')
    if (hasChangHuaJi || hasQuHuaJi) {
      if (isXiongGeYinDong(chart, mingIdx)) return true
    }

    // 破军化禄时贪狼化忌煞多仍破败
    if (chart.hasStarSihua('破军', '化禄') && chart.hasStarSihua('贪狼', '化忌')) {
      if (isXiongGeYinDong(chart, mingIdx)) return true
    }

    return false
  },
}

// ═══════════════════════════════════════════════════════════════════
// 武曲类
// ═══════════════════════════════════════════════════════════════════

// ─── 4. 因财持刀 ──────────────────────────────────────────────
// 武曲七杀擎羊同宫或武曲擎羊同宫 + 武曲化忌 + 加凶格
const yinCaiChiDao: PatternPredicate = {
  name: '因财持刀',
  level: '中凶',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    // 命宫必须有武曲
    if (!chart.hasStarInPalace(mingIdx, '武曲')) return false
    // 必须有擎羊或七杀
    if (!chart.hasStarInPalace(mingIdx, '擎羊') && !chart.hasStarInPalace(mingIdx, '七杀')) return false

    // 武曲化忌
    if (!chart.hasStarSihua('武曲', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 6. 寡宿 ──────────────────────────────────────────────────
// 武曲火星或铃星同宫 + 武曲化忌 + 加凶格
const guaSu: PatternPredicate = {
  name: '寡宿',
  level: '中凶',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲')) return false
    // 火星或铃星同宫
    if (!chart.hasStarInPalace(mingIdx, '火星') && !chart.hasStarInPalace(mingIdx, '铃星')) return false

    // 武曲化忌
    if (!chart.hasStarSihua('武曲', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
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
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天机') || !chart.hasStarInPalace(mingIdx, '巨门')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '卯') return false

    // 天机化忌或巨门化忌
    if (!chart.hasStarSihua('天机', '化忌') && !chart.hasStarSihua('巨门', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
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
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴')) return false

    // 铃星同宫或三方四正
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasLingXing = sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
    if (!hasLingXing) return false

    // 太阴化忌
    if (!chart.hasStarSihua('太阴', '化忌')) return false

    return true
  },
}

// ─── 9. 人离财散 ──────────────────────────────────────────────
// 太阴擎羊或太阴陀罗同宫 + 太阴化忌（擎羊>陀罗严重）
const renLiCaiSan: PatternPredicate = {
  name: '人离财散',
  level: '中凶',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '太阴')) return false
    // 擎羊或陀罗同宫
    if (!chart.hasStarInPalace(mingIdx, '擎羊') && !chart.hasStarInPalace(mingIdx, '陀罗')) return false

    // 太阴化忌
    if (!chart.hasStarSihua('太阴', '化忌')) return false

    return true
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
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '破军')) return false
    if (!chart.hasStarInPalace(mingIdx, '文曲')) return false

    // 昌曲化忌
    if (!chart.hasStarSihua('文昌', '化忌') && !chart.hasStarSihua('文曲', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 11. 火贪横破 ─────────────────────────────────────────────
// 火星贪狼或铃星贪狼同宫 + 贪狼化忌或同宫化忌 + 加凶格
const huoTanHengPo: PatternPredicate = {
  name: '火贪横破',
  level: '中凶',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '贪狼')) return false
    // 火星或铃星同宫
    if (!chart.hasStarInPalace(mingIdx, '火星') && !chart.hasStarInPalace(mingIdx, '铃星')) return false

    // 贪狼化忌或同宫化忌
    if (!chart.hasStarSihua('贪狼', '化忌') && !chart.hasSihuaInPalace(mingIdx, '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 机梁同类
// ═══════════════════════════════════════════════════════════════════

// ─── 12. 机梁羊刑克见孤 ───────────────────────────────────────
// 天机天梁擎羊/陀罗在命宫三方四正范围内至少3颗即成格
// 不需要化忌引动，如果化忌引动则更凶
const jiLiangYangXingKeJianGu: PatternPredicate = {
  name: '机梁羊刑克见孤',
  level: '中凶',
  category: '机梁同',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 统计三方四正中天机、天梁、擎羊、陀罗的出现数量
    const targetStars = ['天机', '天梁', '擎羊', '陀罗']
    let count = 0
    for (const star of targetStars) {
      if (sf.some((idx) => chart.hasStarInPalace(idx, star))) {
        count++
      }
    }

    // 至少3颗在命宫三方四正
    return count >= 3
  },
}

// ═══════════════════════════════════════════════════════════════════
// 其他类
// ═══════════════════════════════════════════════════════════════════

// ─── 13. 半空折翅 ─────────────────────────────────────────────
// 命宫三方四正同时见空劫 + 命宫主星落陷 + 加凶格
const banKongZheChi: PatternPredicate = {
  name: '半空折翅',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return false
    const mainStarLuoXian = stars.some((s) => isLuoXian(s.brightness))
    if (!mainStarLuoXian) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 同时见地空和地劫
    const hasKong = sf.some((idx) => chart.hasStarInPalace(idx, '地空'))
    const hasJie = sf.some((idx) => chart.hasStarInPalace(idx, '地劫'))
    if (!hasKong || !hasJie) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 14. 火铃夹命 ─────────────────────────────────────────────
// 火星铃星夹命宫
// 命宫主星落陷
const huoLingJiaMing: PatternPredicate = {
  name: '火铃夹命',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 火星铃星夹命宫
    if (!hasClampStars(chart, mingIdx, '火星', '铃星')) return false

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return true
    return stars.some((s) => isLuoXian(s.brightness))
  },
}

// ─── 15. 空劫夹命 ─────────────────────────────────────────────
// 地空地劫夹命宫
// 命宫主星落陷
const kongJieJiaMing: PatternPredicate = {
  name: '空劫夹命',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 地空地劫夹命宫
    if (!hasClampStars(chart, mingIdx, '地空', '地劫')) return false

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return true
    return stars.some((s) => isLuoXian(s.brightness))
  },
}

// ─── 16. 马落空亡 ─────────────────────────────────────────────
// 天马与地空或地劫同宫
// 命宫主星落陷
const maLuoKongWang: PatternPredicate = {
  name: '马落空亡',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 天马与地空或地劫同宫
    if (!chart.hasStarInPalace(mingIdx, '天马')) return false
    if (!chart.hasStarInPalace(mingIdx, '地空') && !chart.hasStarInPalace(mingIdx, '地劫')) return false

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return true
    return stars.some((s) => isLuoXian(s.brightness))
  },
}

// ─── 17. 梁马飘荡 ─────────────────────────────────────────────
// 天梁天马同宫，且命宫无主星
// 三方四正煞多（>=2颗）
const liangMaPiaoDang: PatternPredicate = {
  name: '梁马飘荡',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 天梁天马同宫
    if (!chart.hasStarInPalace(mingIdx, '天梁') || !chart.hasStarInPalace(mingIdx, '天马')) return false

    // 命宫无主星
    if (!isAnchorPalaceEmpty(chart)) return false

    // 三方四正煞多（>=2颗）
    const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']
    return hasMinStarsInSanFang(chart, mingIdx, shaXing, 2)
  },
}

// ─── 18. 命无正曜 ─────────────────────────────────────────────
// 命宫无主星
// 三方四正煞多（>=2颗）
const mingWuZhengYao: PatternPredicate = {
  name: '命无正曜',
  level: '小凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 命宫无主星
    if (!isAnchorPalaceEmpty(chart)) return false

    // 三方四正煞多（>=2颗）
    const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']
    return hasMinStarsInSanFang(chart, mingIdx, shaXing, 2)
  },
}

// ─── 19. 日月藏辉 ─────────────────────────────────────────────
// 太阳太阴落陷且被煞星冲破
// 三方四正煞星多（>=2颗）
const riYueCangHui: PatternPredicate = {
  name: '日月藏辉',
  level: '中凶',
  category: '日月',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 三方四正有太阳和太阴
    const hasTaiYang = sf.some((idx) => chart.hasStarInPalace(idx, '太阳'))
    const hasTaiYin = sf.some((idx) => chart.hasStarInPalace(idx, '太阴'))
    if (!hasTaiYang || !hasTaiYin) return false

    // 太阳太阴落陷
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

    // 三方四正煞星多（>=2颗）
    const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']
    return hasMinStarsInSanFang(chart, mingIdx, shaXing, 2)
  },
}

// ─── 20. 昌曲化忌 ─────────────────────────────────────────────
// 文昌文曲化忌同宫或会照
// 命宫主星落陷
const changQuHuaJi: PatternPredicate = {
  name: '昌曲化忌',
  level: '中凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 三方四正有文昌或文曲
    const hasChang = sf.some((idx) => chart.hasStarInPalace(idx, '文昌'))
    const hasQu = sf.some((idx) => chart.hasStarInPalace(idx, '文曲'))
    if (!hasChang && !hasQu) return false

    // 文昌或文曲化忌
    const hasChangHuaJi = chart.hasStarSihua('文昌', '化忌')
    const hasQuHuaJi = chart.hasStarSihua('文曲', '化忌')
    if (!hasChangHuaJi && !hasQuHuaJi) return false

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return true
    return stars.some((s) => isLuoXian(s.brightness))
  },
}

/** 中凶格局列表（20条，×0.7） */
export const mediumInauspiciousPatterns: PatternPredicate[] = [
  guJunZaiYe,
  taoHuaFanZhu,
  poZuLiZong,
  yinCaiChiDao,
  guaSu,
  juJiPoDang2,
  shiEGe,
  renLiCaiSan,
  pinShiGe,
  huoTanHengPo,
  jiLiangYangXingKeJianGu,
  banKongZheChi,
  huoLingJiaMing,
  kongJieJiaMing,
  maLuoKongWang,
  liangMaPiaoDang,
  mingWuZhengYao,
  riYueCangHui,
  changQuHuaJi,
]
