/**
 * 五虎遁表（年上起月法）：由生年干定寅宫天干，顺布十二宫宫干。
 * 太岁宫宫干 = 以生年干查本表、取太岁宫地支所在列之天干（与 SKILL_宫位原生能级评估「父母太岁宫遁干」算法一致）。
 */

import type { Stem, Branch } from '../types';
import { BRANCH_ORDER } from '../types';

/**
 * 五虎遁表
 * 甲/己年（起丙）、乙/庚年（起戊）、丙/辛年（起庚）、丁/壬年（起壬）、戊/癸年（起甲）
 */
export const FIVE_TIGER: Record<string, Partial<Record<Branch, Stem>>> = {
  '甲': { 寅: '丙', 卯: '丁', 辰: '戊', 巳: '己', 午: '庚', 未: '辛', 申: '壬', 酉: '癸', 戌: '甲', 亥: '乙', 子: '丙', 丑: '丁' },
  '己': { 寅: '丙', 卯: '丁', 辰: '戊', 巳: '己', 午: '庚', 未: '辛', 申: '壬', 酉: '癸', 戌: '甲', 亥: '乙', 子: '丙', 丑: '丁' },
  '乙': { 寅: '戊', 卯: '己', 辰: '庚', 巳: '辛', 午: '壬', 未: '癸', 申: '甲', 酉: '乙', 戌: '丙', 亥: '丁', 子: '戊', 丑: '己' },
  '庚': { 寅: '戊', 卯: '己', 辰: '庚', 巳: '辛', 午: '壬', 未: '癸', 申: '甲', 酉: '乙', 戌: '丙', 亥: '丁', 子: '戊', 丑: '己' },
  '丙': { 寅: '庚', 卯: '辛', 辰: '壬', 巳: '癸', 午: '甲', 未: '乙', 申: '丙', 酉: '丁', 戌: '戊', 亥: '己', 子: '庚', 丑: '辛' },
  '辛': { 寅: '庚', 卯: '辛', 辰: '壬', 巳: '癸', 午: '甲', 未: '乙', 申: '丙', 酉: '丁', 戌: '戊', 亥: '己', 子: '庚', 丑: '辛' },
  '丁': { 寅: '壬', 卯: '癸', 辰: '甲', 巳: '乙', 午: '丙', 未: '丁', 申: '戊', 酉: '己', 戌: '庚', 亥: '辛', 子: '壬', 丑: '癸' },
  '壬': { 寅: '壬', 卯: '癸', 辰: '甲', 巳: '乙', 午: '丙', 未: '丁', 申: '戊', 酉: '己', 戌: '庚', 亥: '辛', 子: '壬', 丑: '癸' },
  '戊': { 寅: '甲', 卯: '乙', 辰: '丙', 巳: '丁', 午: '戊', 未: '己', 申: '庚', 酉: '辛', 戌: '壬', 亥: '癸', 子: '甲', 丑: '乙' },
  '癸': { 寅: '甲', 卯: '乙', 辰: '丙', 巳: '丁', 午: '戊', 未: '己', 申: '庚', 酉: '辛', 戌: '壬', 亥: '癸', 子: '甲', 丑: '乙' },
};

/**
 * 天干顺序
 */
export const STEM_ORDER: Stem[] = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
];

/**
 * 天干地支配对（六十甲子）
 */
export const SIXTY_JIAZI: Array<{ stem: Stem; branch: Branch; index: number }> = [];
let stemIdx = 0;
let branchIdx = 0;
for (let i = 0; i < 60; i++) {
  SIXTY_JIAZI.push({
    stem: STEM_ORDER[stemIdx],
    branch: BRANCH_ORDER[branchIdx],
    index: i,
  });
  stemIdx = (stemIdx + 1) % 10;
  branchIdx = (branchIdx + 1) % 12;
}

/**
 * 根据生年干支获取年份在六十甲子中的索引
 */
export function getYearIndex(stem: Stem, branch: Branch): number {
  const item = SIXTY_JIAZI.find(item => item.stem === stem && item.branch === branch);
  return item?.index ?? 0;
}

/**
 * 根据年份获取干支
 */
export function getYearStemBranch(year: number): { stem: Stem; branch: Branch } {
  // 1984年是甲子年，索引为0
  const baseYear = 1984;
  const offset = ((year - baseYear) % 60 + 60) % 60;
  return SIXTY_JIAZI[offset];
}

/**
 * 根据生年干和宫位地支取该宫宫干（五虎遁）
 */
export function getDunGan(birthStem: Stem, palaceBranch: Branch): Stem {
  const dunTable = FIVE_TIGER[birthStem];
  return dunTable?.[palaceBranch] ?? '甲';
}

/**
 * 获取连续的宫干序列（以命宫为起点）
 */
export function getPalaceStems(birthStem: Stem, mingPalaceBranch: Branch): Partial<Record<Branch, Stem>> {
  const result: Partial<Record<Branch, Stem>> = {};
  const mingIdx = BRANCH_ORDER.indexOf(mingPalaceBranch);

  // 命宫天干即为生年天干
  result[mingPalaceBranch] = birthStem;

  // 从命宫开始，顺时针排十二宫
  for (let i = 1; i < 12; i++) {
    const branch = BRANCH_ORDER[(mingIdx + i) % 12];
    result[branch] = getDunGan(birthStem, branch);
  }

  return result;
}

/**
 * 天干四化对照表
 */
export const HUA_TABLE: Record<Stem, { lu: string; quan: string; ke: string; ji: string }> = {
  '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  '乙': { lu: '天机', quan: '紫微', ke: '天梁', ji: '太阴' },
  '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  '戊': { lu: '贪狼', quan: '太阴', ke: '天机', ji: '天梁' },
  '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '天府', ji: '武曲' },
  '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' },
};

/**
 * 根据天干获取四化
 */
export function getHuaByStem(stem: Stem): { lu: string | null; quan: string | null; ke: string | null; ji: string | null } {
  const hua = HUA_TABLE[stem];
  return {
    lu: hua?.lu ?? null,
    quan: hua?.quan ?? null,
    ke: hua?.ke ?? null,
    ji: hua?.ji ?? null,
  };
}

/**
 * 根据天干和星曜判断是否四化
 */
export function getHuaType(stem: Stem, starName: string): 'lu' | 'quan' | 'ke' | 'ji' | null {
  const hua = HUA_TABLE[stem];
  if (!hua) return null;

  if (hua.lu === starName) return 'lu';
  if (hua.quan === starName) return 'quan';
  if (hua.ke === starName) return 'ke';
  if (hua.ji === starName) return 'ji';

  return null;
}

/**
 * 禄存随行表（擎羊/陀罗与禄存的相对位置）
 * 禄存所在宫位的：前一宫有擎羊，后一宫有陀罗
 */
export const LUCUN_FOLLOW: Record<Branch, { yang: Branch; tuo: Branch }> = {
  '子': { yang: '亥', tuo: '丑' },
  '丑': { yang: '子', tuo: '寅' },
  '寅': { yang: '丑', tuo: '卯' },
  '卯': { yang: '寅', tuo: '辰' },
  '辰': { yang: '卯', tuo: '巳' },
  '巳': { yang: '辰', tuo: '午' },
  '午': { yang: '巳', tuo: '未' },
  '未': { yang: '午', tuo: '申' },
  '申': { yang: '未', tuo: '酉' },
  '酉': { yang: '申', tuo: '戌' },
  '戌': { yang: '酉', tuo: '亥' },
  '亥': { yang: '戌', tuo: '子' },
};

/**
 * 天魁/天钺对照表
 */
export const KUI_YUE_TABLE: Record<Stem, { kui: Branch; yue: Branch }> = {
  '甲': { kui: '丑', yue: '子' },
  '乙': { kui: '子', yue: '丑' },
  '丙': { kui: '亥', yue: '戌' },
  '丁': { kui: '亥', yue: '戌' },
  '戊': { kui: '卯', yue: '寅' },
  '己': { kui: '寅', yue: '卯' },
  '庚': { kui: '丑', yue: '子' },
  '辛': { kui: '子', yue: '丑' },
  '壬': { kui: '卯', yue: '寅' },
  '癸': { kui: '寅', yue: '卯' },
};

/**
 * 红鸾/天喜对照表（按地支）
 */
export const HONGXIANG_TIANXI_TABLE: Record<Branch, { hong: Branch; xi: Branch }> = {
  '子': { hong: '卯', xi: '酉' },
  '丑': { hong: '寅', xi: '申' },
  '寅': { hong: '丑', xi: '未' },
  '卯': { hong: '子', xi: '午' },
  '辰': { hong: '亥', xi: '巳' },
  '巳': { hong: '戌', xi: '辰' },
  '午': { hong: '酉', xi: '卯' },
  '未': { hong: '申', xi: '寅' },
  '申': { hong: '未', xi: '丑' },
  '酉': { hong: '午', xi: '子' },
  '戌': { hong: '巳', xi: '亥' },
  '亥': { hong: '辰', xi: '戌' },
};
