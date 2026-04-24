/**
 * 大限流年计算工具
 * 计算大限、流年、小限的起运和顺逆
 */

import { Gender, type Decennial, type Annual, type MinorLimit, type Branch, type Stem, type PalaceName } from '../types';
import { BRANCH_ORDER, BRANCH_INDEX } from '../types';
import { getDunGan, getHuaByStem } from '../data/fiveTiger';
import { getPalaceNameByBranch } from './spatial';

/**
 * 计算大限起运年龄
 * 根据命宫地支和性别计算大限起运年龄
 */
export function getDecennialStartAge(
  mingPalace: Branch,
  gender: Gender,
  lunarYear: number
): number {
  // 阳男阴女：顺行，起运年龄 = (命宫地支索引 + 2) / 2
  // 阴女阳男：逆行，起运年龄 = (12 - 命宫地支索引 + 2) / 2

  const mingIdx = BRANCH_INDEX[mingPalace];
  const yearStem = getYearStem(lunarYear);
  const isYang = ['甲', '丙', '戊', '庚', '壬'].includes(yearStem);
  const isYangYear = isYang;

  // 阳男阴女顺行，阴男阳女逆行
  const isForward = (gender === Gender.Male && isYangYear) || (gender === Gender.Female && !isYangYear);

  if (isForward) {
    // 顺行
    return Math.floor((mingIdx + 2) / 2);
  } else {
    // 逆行
    return Math.floor((12 - mingIdx + 1) / 2);
  }
}

/**
 * 获取年份天干
 */
export function getYearStem(year: number): Stem {
  const stems: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const baseYear = 1984; // 甲子年
  const offset = ((year - baseYear) % 10 + 10) % 10;
  return stems[offset];
}

/**
 * 获取年份地支
 */
export function getYearBranch(year: number): Branch {
  const baseYear = 1984; // 甲子年
  const offset = ((year - baseYear) % 12 + 12) % 12;
  return BRANCH_ORDER[offset];
}

/**
 * 计算所有大限
 */
export function calculateDecennials(
  mingPalace: Branch,
  gender: Gender,
  lunarYear: number
): Decennial[] {
  const startAge = getDecennialStartAge(mingPalace, gender, lunarYear);
  const yearStem = getYearStem(lunarYear);
  const isYang = ['甲', '丙', '戊', '庚', '壬'].includes(yearStem);
  const isYangYear = isYang;

  // 阳男阴女顺行，阴男阳女逆行
  const isForward = (gender === Gender.Male && isYangYear) || (gender === Gender.Female && !isYangYear);

  const mingIdx = BRANCH_INDEX[mingPalace];
  const decennials: Decennial[] = [];

  // 计算十大限
  let currentAge = startAge;
  let currentIdx = mingIdx;

  for (let i = 1; i <= 10; i++) {
    const branch = BRANCH_ORDER[currentIdx];
    const palace = getPalaceNameByBranch(mingPalace, branch);
    const stem = getDunGan(yearStem, branch);
    const hua = getHuaByStem(stem);

    // 大限年龄跨度：每限10年
    const ageEnd = currentAge + 9;

    decennials.push({
      index: i,
      ageRange: [currentAge, ageEnd],
      palace,
      branch,
      stem,
      hua,
    });

    // 移动到下一个宫位
    if (isForward) {
      currentIdx = (currentIdx + 1) % 12;
    } else {
      currentIdx = (currentIdx - 1 + 12) % 12;
    }

    currentAge = ageEnd + 1;
  }

  return decennials;
}

/**
 * 获取当前大限
 */
export function getCurrentDecennial(
  decennials: Decennial[],
  currentAge: number
): Decennial | undefined {
  return decennials.find(d => currentAge >= d.ageRange[0] && currentAge <= d.ageRange[1]);
}

/**
 * 计算流年
 */
export function calculateAnnual(
  mingPalace: Branch,
  year: number
): Annual {
  const branch = getYearBranch(year);
  const stem = getYearStem(year);
  const palace = getPalaceNameByBranch(mingPalace, branch);
  const hua = getHuaByStem(stem);

  return {
    year,
    branch,
    stem,
    palace,
    hua,
  };
}

/**
 * 计算小限
 * 男顺女逆，从寅宫起1岁
 */
export function calculateMinorLimit(
  age: number,
  gender: Gender
): MinorLimit {
  // 寅宫起1岁
  const yinIdx = BRANCH_INDEX['寅'];

  let idx: number;
  if (gender === Gender.Male) {
    // 男顺行
    idx = (yinIdx + age - 1) % 12;
  } else {
    // 女逆行
    idx = (yinIdx - age + 1 + 12) % 12;
  }

  const branch = BRANCH_ORDER[idx];
  const palace: PalaceName = '命宫'; // 简化，实际需要根据命宫推算

  return {
    age,
    palace,
    branch,
  };
}

/**
 * 获取当前所在的大限和流年信息
 */
export function getCurrentLimitInfo(
  mingPalace: Branch,
  gender: Gender,
  lunarYear: number,
  currentAge: number,
  targetYear: number
): {
  decennial: Decennial | undefined;
  annual: Annual;
  minor: MinorLimit;
} {
  const decennials = calculateDecennials(mingPalace, gender, lunarYear);
  const decennial = getCurrentDecennial(decennials, currentAge);
  const annual = calculateAnnual(mingPalace, targetYear);
  const minor = calculateMinorLimit(currentAge, gender);

  return {
    decennial,
    annual,
    minor,
  };
}

/**
 * 判断是否在大限交运期
 * 交运期前后各一年
 */
export function isTransitionPeriod(
  decennials: Decennial[],
  currentAge: number,
  tolerance: number = 1
): boolean {
  for (let i = 0; i < decennials.length; i++) {
    const d = decennials[i];
    if (Math.abs(currentAge - d.ageRange[0]) <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * 获取大限交运年份
 */
export function getTransitionYear(
  decennial: Decennial,
  lunarYear: number
): number {
  // 简化计算：假设出生年份 + 大限起始年龄
  // 实际需要考虑节气等因素
  return lunarYear + decennial.ageRange[0];
}

/**
 * 计算命盘行运总结
 */
export function analyzeDecennialTrend(
  decennials: Decennial[],
  currentAge: number
): {
  current: {
    index: number;
    ageRange: [number, number];
    remaining: number;
  };
  next?: {
    index: number;
    ageRange: [number, number];
    startYear: number;
  };
  past: number;
  total: number;
} {
  const currentIdx = decennials.findIndex(d =>
    currentAge >= d.ageRange[0] && currentAge <= d.ageRange[1]
  );

  const current = currentIdx >= 0 ? decennials[currentIdx] : undefined;

  if (!current) {
    return {
      current: {
        index: 0,
        ageRange: [0, 0],
        remaining: 0,
      },
      past: 0,
      total: 100,
    };
  }

  const remaining = current.ageRange[1] - currentAge;
  const next = currentIdx < decennials.length - 1 ? decennials[currentIdx + 1] : undefined;

  return {
    current: {
      index: current.index,
      ageRange: current.ageRange,
      remaining,
    },
    next: next ? {
      index: next.index,
      ageRange: next.ageRange,
      startYear: 0, // 需要外部计算
    } : undefined,
    past: currentIdx,
    total: 10,
  };
}
