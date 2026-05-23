/**
 * M2: 格局判定 — 大凶格局（14条）
 *
 * 大凶格局成立后倍率为 × 0.5
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

// ═══════════════════════════════════════════════════════════════════
// 紫微类
// ═══════════════════════════════════════════════════════════════════

// ─── 1. 君臣不义 ──────────────────────────────────────────────
// 紫微/破军/天相在命宫辰戌丑未 + 不见左右 + 三方羊陀见一且火铃见一
// + 三方有化忌或陀罗宫凶 + 加凶格
const junChenBuYi: PatternPredicate = {
  name: '君臣不义',
  level: '大凶',
  category: '紫微',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const hasZi = chart.hasStarInPalace(mingIdx, '紫微')
    const hasPo = chart.hasStarInPalace(mingIdx, '破军')
    const hasXiang = chart.hasStarInPalace(mingIdx, '天相')
    if (!hasZi && !hasPo && !hasXiang) return false

    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (!['辰', '戌', '丑', '未'].includes(zhi)) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 不见左右
    const hasZuoYou = sf.some((idx) =>
      chart.hasStarInPalace(idx, '左辅') || chart.hasStarInPalace(idx, '右弼'),
    )
    if (hasZuoYou) return false

    // 三方羊陀见一
    const hasYangTuo = sf.some((idx) =>
      chart.hasStarInPalace(idx, '擎羊') || chart.hasStarInPalace(idx, '陀罗'),
    )
    // 三方火铃见一
    const hasHuoLing = sf.some((idx) =>
      chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'),
    )
    if (!hasYangTuo || !hasHuoLing) return false

    // 三方有化忌或陀罗宫凶
    const hasHuaJi = hasSihuaInSanFang(chart, mingIdx, '化忌')
    const hasTuoLuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    if (!hasHuaJi && !hasTuoLuo) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 廉贞类
// ═══════════════════════════════════════════════════════════════════

// ─── 2. 刑囚夹印 ──────────────────────────────────────────────
// 廉贞三方四正见天相和擎羊 / 同宫最凶 + 廉贞化忌 + 见火铃 + 加凶格
const xingQiuJiaYin: PatternPredicate = {
  name: '刑囚夹印',
  level: '大凶',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 三方四正见天相和擎羊
    const hasXiang = sf.some((idx) => chart.hasStarInPalace(idx, '天相'))
    const hasYang = sf.some((idx) => chart.hasStarInPalace(idx, '擎羊'))
    if (!hasXiang || !hasYang) return false

    // 廉贞化忌
    if (!chart.hasStarSihua('廉贞', '化忌')) return false

    // 见火铃
    const hasHuoLing = sf.some((idx) =>
      chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'),
    )
    if (!hasHuoLing) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 3. 绝处逢死 ──────────────────────────────────────────────
// 廉贞贪狼在命宫亥或巳 + 廉贞/贪狼化忌 + 见昌曲火铃更凶 + 加凶格
const jueChuFengSi: PatternPredicate = {
  name: '绝处逢死',
  level: '大凶',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞') || !chart.hasStarInPalace(mingIdx, '贪狼')) return false
    const zhi = chart.getPalaceDiZhi(mingIdx)
    if (zhi !== '亥' && zhi !== '巳') return false

    // 廉贞或贪狼化忌
    if (!chart.hasStarSihua('廉贞', '化忌') && !chart.hasStarSihua('贪狼', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 4. 路上埋尸 ──────────────────────────────────────────────
// 廉贞七杀擎羊在丑/未同宫 / 命身廉贞七杀 + 限运引动 + 见火铃 + 加凶格
const luShangMaiShi: PatternPredicate = {
  name: '路上埋尸',
  level: '大凶',
  category: '廉贞',
  evaluate(chart) {
    // 场景1：廉贞七杀擎羊在丑/未同宫（命宫）
    const mingIdx = chart.anchorPalaceIndex
    if (chart.hasStarInPalace(mingIdx, '廉贞') && chart.hasStarInPalace(mingIdx, '七杀') && chart.hasStarInPalace(mingIdx, '擎羊')) {
      const zhi = chart.getPalaceDiZhi(mingIdx)
      if (zhi === '丑' || zhi === '未') {
        const sf = getSanFangSiZheng(chart, mingIdx)
        const hasHuoLing = sf.some((idx) =>
          chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'),
        )
        if (hasHuoLing && isXiongGeYinDong(chart, mingIdx)) return true
      }
    }

    // 场景2：命身分居廉贞七杀 + 擎羊在三方四正
    const shenIdx = chart.shenGongIndex
    const hasLianMing = chart.hasStarInPalace(mingIdx, '廉贞')
    const hasShaShen = chart.hasStarInPalace(shenIdx, '七杀')
    const hasShaMing = chart.hasStarInPalace(mingIdx, '七杀')
    const hasLianShen = chart.hasStarInPalace(shenIdx, '廉贞')

    if ((hasLianMing && hasShaShen) || (hasShaMing && hasLianShen)) {
      const sf = getSanFangSiZheng(chart, mingIdx)
      const hasYang = sf.some((idx) => chart.hasStarInPalace(idx, '擎羊'))
      if (hasYang) {
        const hasHuoLing = sf.some((idx) =>
          chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'),
        )
        if (hasHuoLing && isXiongGeYinDong(chart, mingIdx)) return true
      }
    }

    return false
  },
}

// ─── 5. 丧命天折 ──────────────────────────────────────────────
// 廉贞文昌/文曲命宫同宫 + 廉贞化忌/昌曲化忌 + 见火铃更凶 + 加凶格
const sangMingTianZhe: PatternPredicate = {
  name: '丧命天折',
  level: '大凶',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞')) return false
    const hasChang = chart.hasStarInPalace(mingIdx, '文昌')
    const hasQu = chart.hasStarInPalace(mingIdx, '文曲')
    if (!hasChang && !hasQu) return false

    // 廉贞化忌或昌曲化忌
    const hasHuaJi =
      chart.hasStarSihua('廉贞', '化忌') ||
      chart.hasStarSihua('文昌', '化忌') ||
      chart.hasStarSihua('文曲', '化忌')
    if (!hasHuaJi) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 6. 财与囚仇 ──────────────────────────────────────────────
// 廉贞武曲三方相会 + 廉贞/武曲化忌 + 羊陀火铃各见其一 + 加囚格
const caiYuQiuChou: PatternPredicate = {
  name: '财与囚仇',
  level: '大凶',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 武曲三方相会
    if (!sf.some((idx) => chart.hasStarInPalace(idx, '武曲'))) return false

    // 廉贞或武曲化忌
    if (!chart.hasStarSihua('廉贞', '化忌') && !chart.hasStarSihua('武曲', '化忌')) return false

    // 羊陀火铃各见其一（擎羊或陀罗 + 火星或铃星）
    const hasYangTuo =
      chart.hasStarInPalace(mingIdx, '擎羊') || chart.hasStarInPalace(mingIdx, '陀罗') ||
      sf.some((idx) => chart.hasStarInPalace(idx, '擎羊') || chart.hasStarInPalace(idx, '陀罗'))
    const hasHuoLing =
      chart.hasStarInPalace(mingIdx, '火星') || chart.hasStarInPalace(mingIdx, '铃星') ||
      sf.some((idx) => chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'))
    if (!hasYangTuo || !hasHuoLing) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 7. 自缢投河 ──────────────────────────────────────────────
// 廉贞破军火铃在酉宫 + 破军化禄时贪狼化忌煞多仍破败 / 廉贞化忌 / 昌曲化忌
// + 不喜昌曲 + 加凶格
const ziYiTouHe: PatternPredicate = {
  name: '自缢投河',
  level: '大凶',
  category: '廉贞',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '廉贞') || !chart.hasStarInPalace(mingIdx, '破军')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '酉') return false

    // 火星或铃星同宫或三方四正
    const sf = getSanFangSiZheng(chart, mingIdx)
    const hasHuoLing = sf.some((idx) =>
      chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'),
    )
    if (!hasHuoLing) return false

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

// ─── 8. 因财被劫 ──────────────────────────────────────────────
// 武曲七杀火星在卯酉同宫或三合（同宫最凶）+ 武曲化忌 + 加凶格
const yinCaiBeiJie: PatternPredicate = {
  name: '因财被劫',
  level: '大凶',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 七杀和火星同宫或三合
    const hasQiSha = sf.some((idx) => chart.hasStarInPalace(idx, '七杀'))
    const hasHuoXing = sf.some((idx) => chart.hasStarInPalace(idx, '火星'))
    if (!hasQiSha || !hasHuoXing) return false

    // 卯酉地支（检查武曲所在宫或三合宫中有卯酉）
    const zhi = chart.getPalaceDiZhi(mingIdx)
    const sfInMaoYou = sf.some((idx) => {
      const z = chart.getPalaceDiZhi(idx)
      return z === '卯' || z === '酉'
    })
    if (zhi !== '卯' && zhi !== '酉' && !sfInMaoYou) return false

    // 武曲化忌
    if (!chart.hasStarSihua('武曲', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 9. 限至投河 ──────────────────────────────────────────────
// 武曲铃星陀罗文昌同宫或三方四正 + 武曲化忌 + 加凶格
const xianZhiTouHe: PatternPredicate = {
  name: '限至投河',
  level: '大凶',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 铃星、陀罗、文昌须同宫或三方四正
    const hasLing = sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
    const hasTuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    const hasChang = sf.some((idx) => chart.hasStarInPalace(idx, '文昌'))
    if (!hasLing || !hasTuo || !hasChang) return false

    // 武曲化忌
    if (!chart.hasStarSihua('武曲', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 10. 武破离宗 ─────────────────────────────────────────────
// 武曲破军在亥 + 破军化禄时贪狼化忌煞多仍破败 / 武曲化忌 / 昌曲化忌
// + 不喜昌曲 + 加凶格
const wuPoLiZong: PatternPredicate = {
  name: '武破离宗',
  level: '大凶',
  category: '武曲',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '武曲') || !chart.hasStarInPalace(mingIdx, '破军')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '亥') return false

    // 武曲化忌
    if (chart.hasStarSihua('武曲', '化忌')) {
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
// 巨门类
// ═══════════════════════════════════════════════════════════════════

// ─── 11. 巨机破荡1 ────────────────────────────────────────────
// 天机巨门在酉 + 不喜见昌曲火铃 + 加凶格
const juJiPoDang1: PatternPredicate = {
  name: '巨机破荡1',
  level: '大凶',
  category: '巨门',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '天机') || !chart.hasStarInPalace(mingIdx, '巨门')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '酉') return false

    // 加凶格引动（不喜见昌曲火铃体现在煞多于吉）
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 12. 巨火羊终身缢死 ───────────────────────────────────────
// 巨门+火星/铃星之一+擎羊/陀罗之一 + 巨门化忌 + 加凶格
const juHuoYangZhongShenYiSi: PatternPredicate = {
  name: '巨火羊终身缢死',
  level: '大凶',
  category: '巨门',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '巨门')) return false

    const sf = getSanFangSiZheng(chart, mingIdx)

    // 火星或铃星之一
    const hasHuoOrLing = sf.some((idx) =>
      chart.hasStarInPalace(idx, '火星') || chart.hasStarInPalace(idx, '铃星'),
    )
    if (!hasHuoOrLing) return false

    // 擎羊或陀罗之一
    const hasYangOrTuo = sf.some((idx) =>
      chart.hasStarInPalace(idx, '擎羊') || chart.hasStarInPalace(idx, '陀罗'),
    )
    if (!hasYangOrTuo) return false

    // 巨门化忌
    if (!chart.hasStarSihua('巨门', '化忌')) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ═══════════════════════════════════════════════════════════════════
// 杀破狼类
// ═══════════════════════════════════════════════════════════════════

// ─── 13. 众水东流格 ───────────────────────────────────────────
// 破军文曲/文昌在卯宫同宫 + 廉贞/昌曲化忌 + 加凶格
const zhongShuiDongLiu: PatternPredicate = {
  name: '众水东流格',
  level: '大凶',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '破军')) return false
    if (chart.getPalaceDiZhi(mingIdx) !== '卯') return false
    if (!chart.hasStarInPalace(mingIdx, '文曲') && !chart.hasStarInPalace(mingIdx, '文昌')) return false

    // 廉贞化忌或昌曲化忌
    const hasHuaJi =
      chart.hasStarSihua('廉贞', '化忌') ||
      chart.hasStarSihua('文昌', '化忌') ||
      chart.hasStarSihua('文曲', '化忌')
    if (!hasHuaJi) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 14. 离正位而颠倒粉身碎骨格 ───────────────────────────────
// 文昌/文曲贪狼命宫同宫 + 贪狼化忌/昌曲化忌 + 加凶格
const liZhengWeiErDianDao: PatternPredicate = {
  name: '离正位而颠倒粉身碎骨格',
  level: '大凶',
  category: '杀破狼',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    if (!chart.hasStarInPalace(mingIdx, '贪狼')) return false
    if (!chart.hasStarInPalace(mingIdx, '文昌') && !chart.hasStarInPalace(mingIdx, '文曲')) return false

    // 贪狼化忌或昌曲化忌
    const hasHuaJi =
      chart.hasStarSihua('贪狼', '化忌') ||
      chart.hasStarSihua('文昌', '化忌') ||
      chart.hasStarSihua('文曲', '化忌')
    if (!hasHuaJi) return false

    // 加凶格引动
    if (!isXiongGeYinDong(chart, mingIdx)) return false

    return true
  },
}

// ─── 15. 羊陀夹命 ─────────────────────────────────────────────
// 擎羊陀罗夹命宫
// 命宫主星落陷
const yangTuoJiaMing: PatternPredicate = {
  name: '羊陀夹命',
  level: '大凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 擎羊陀罗夹命宫
    if (!hasClampStars(chart, mingIdx, '擎羊', '陀罗')) return false

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return true // 无主星也算落陷
    return stars.some((s) => isLuoXian(s.brightness))
  },
}

// ─── 16. 刑忌夹印 ─────────────────────────────────────────────
// 天相受擎羊化忌夹制
// 天相落陷
const xingJiJiaYin: PatternPredicate = {
  name: '刑忌夹印',
  level: '大凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex

    // 命宫有天相
    if (!chart.hasStarInPalace(mingIdx, '天相')) return false

    // 天相落陷
    const stars = chart.getStarsInPalace(mingIdx)
    const tianXiang = stars.find((s) => s.star === '天相')
    if (!tianXiang || !isLuoXian(tianXiang.brightness)) return false

    // 擎羊化忌夹命宫（左右邻宫分别是擎羊和化忌）
    const [leftIdx, rightIdx] = chart.getFlankingIndices(mingIdx)
    const leftHasQingYang = chart.hasStarInPalace(leftIdx, '擎羊')
    const rightHasQingYang = chart.hasStarInPalace(rightIdx, '擎羊')
    const leftHasHuaJi = chart.hasSihuaInPalace(leftIdx, '化忌')
    const rightHasHuaJi = chart.hasSihuaInPalace(rightIdx, '化忌')

    // 左擎羊右化忌 或 左化忌右擎羊
    return (leftHasQingYang && rightHasHuaJi) || (leftHasHuaJi && rightHasQingYang)
  },
}

// ─── 17. 极居卯酉 ─────────────────────────────────────────────
// 紫微贪狼在卯酉同宫
// 三方四正煞星多（>=2颗）
const jiJuMaoYou: PatternPredicate = {
  name: '极居卯酉',
  level: '大凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const zhi = chart.getPalaceDiZhi(mingIdx)

    // 紫微贪狼在卯酉同宫
    if (zhi !== '卯' && zhi !== '酉') return false
    if (!chart.hasStarInPalace(mingIdx, '紫微') || !chart.hasStarInPalace(mingIdx, '贪狼')) return false

    // 三方四正煞星多（>=2颗）
    const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']
    return hasMinStarsInSanFang(chart, mingIdx, shaXing, 2)
  },
}

// ─── 18. 巨机化酉 ─────────────────────────────────────────────
// 巨门天机在酉宫同宫且化忌
// 三方四正煞星多（>=2颗）
const juJiHuaYou: PatternPredicate = {
  name: '巨机化酉',
  level: '大凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const zhi = chart.getPalaceDiZhi(mingIdx)

    // 巨门天机在酉宫同宫
    if (zhi !== '酉') return false
    if (!chart.hasStarInPalace(mingIdx, '巨门') || !chart.hasStarInPalace(mingIdx, '天机')) return false

    // 化忌（巨门或天机化忌）
    const hasHuaJi = chart.hasStarSihua('巨门', '化忌') || chart.hasStarSihua('天机', '化忌')
    if (!hasHuaJi) return false

    // 三方四正煞星多（>=2颗）
    const shaXing = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']
    return hasMinStarsInSanFang(chart, mingIdx, shaXing, 2)
  },
}

// ─── 19. 铃昌陀武 ─────────────────────────────────────────────
// 铃星文昌陀罗武曲同宫或会照
// 命宫主星落陷
const lingChangTuoWu: PatternPredicate = {
  name: '铃昌陀武',
  level: '大凶',
  category: '其他',
  evaluate(chart) {
    const mingIdx = chart.anchorPalaceIndex
    const sf = getSanFangSiZheng(chart, mingIdx)

    // 铃星文昌陀罗武曲同宫或会照（三方四正范围内）
    const hasLing = sf.some((idx) => chart.hasStarInPalace(idx, '铃星'))
    const hasChang = sf.some((idx) => chart.hasStarInPalace(idx, '文昌'))
    const hasTuo = sf.some((idx) => chart.hasStarInPalace(idx, '陀罗'))
    const hasWu = sf.some((idx) => chart.hasStarInPalace(idx, '武曲'))
    if (!hasLing || !hasChang || !hasTuo || !hasWu) return false

    // 命宫主星落陷
    const stars = chart.getStarsInPalace(mingIdx)
    if (stars.length === 0) return true
    return stars.some((s) => isLuoXian(s.brightness))
  },
}

/** 大凶格局列表（19条，×0.5） */
export const greatInauspiciousPatterns: PatternPredicate[] = [
  junChenBuYi,
  xingQiuJiaYin,
  jueChuFengSi,
  luShangMaiShi,
  sangMingTianZhe,
  caiYuQiuChou,
  ziYiTouHe,
  yinCaiBeiJie,
  xianZhiTouHe,
  wuPoLiZong,
  juJiPoDang1,
  juHuoYangZhongShenYiSi,
  zhongShuiDongLiu,
  liZhengWeiErDianDao,
  yangTuoJiaMing,
  xingJiJiaYin,
  jiJuMaoYou,
  juJiHuaYou,
  lingChangTuoWu,
]
