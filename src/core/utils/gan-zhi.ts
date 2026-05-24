/**
 * 天干地支与生肖工具函数（纯计算，无副作用，可在前后端共用）
 */
import type { TianGan, DiZhi } from '../types'

const GAN_TABLE: TianGan[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DI_ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const ZODIAC_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

/** 从公历年份提取天干 */
export function yearToGan(year: number): TianGan {
  return GAN_TABLE[((year - 4) % 10 + 10) % 10]
}

/** 从公历年份提取地支 */
export function yearToZhi(year: number): DiZhi {
  return DI_ZHI_ORDER[((year - 4) % 12 + 12) % 12]
}

/** 从公历年份提取生肖名 */
export function yearToZodiac(year: number): string {
  return ZODIAC_ANIMALS[((year - 4) % 12 + 12) % 12]
}
