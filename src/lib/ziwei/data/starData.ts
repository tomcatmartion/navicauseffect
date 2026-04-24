/**
 * 星曜基本数据
 * 包含十四主星、六吉星、六煞星的属性和分值
 */

import { StarType } from '../types';
import type { StarName } from '../types';

/**
 * 星曜基本属性
 */
export interface StarAttr {
  name: StarName;
  type: StarType;
  element: '木' | '火' | '土' | '金' | '水';
  polarity: '阳' | '阴' | '阴阳';
  score: number;              // 固定分值
  category: 'major' | 'lucky' | 'unlucky' | 'hua' | 'other';
  description: string;        // 星曜特性描述
}

/**
 * 十四主星数据
 */
export const MAJOR_STARS: StarAttr[] = [
  {
    name: '紫微',
    type: 'major' as StarType,
    element: '土',
    polarity: '阳',
    score: 0,
    category: 'major',
    description: '帝星，主贵气、领导力、权威，化气为尊',
  },
  {
    name: '天机',
    type: 'major' as StarType,
    element: '木',
    polarity: '阴',
    score: 0,
    category: 'major',
    description: '智慧星，主思虑、策划、变通，化气为善',
  },
  {
    name: '太阳',
    type: 'major' as StarType,
    element: '火',
    polarity: '阳',
    score: 0,
    category: 'major',
    description: '夫星，主发散、热情、声望，化气为贵',
  },
  {
    name: '武曲',
    type: 'major' as StarType,
    element: '金',
    polarity: '阳',
    score: 0,
    category: 'major',
    description: '财星，主财运、决断、行动，化气为刚',
  },
  {
    name: '天同',
    type: 'major' as StarType,
    element: '水',
    polarity: '阴',
    score: 0,
    category: 'major',
    description: '福星，主福气、协调、享受，化气为福',
  },
  {
    name: '廉贞',
    type: 'major' as StarType,
    element: '火',
    polarity: '阴',
    score: 0,
    category: 'major',
    description: '囚星，主是非、精密、感情，化气为囚',
  },
  {
    name: '天府',
    type: 'major' as StarType,
    element: '土',
    polarity: '阳',
    score: 0,
    category: 'major',
    description: '库星，主财库、稳重、管理，化气为令',
  },
  {
    name: '太阴',
    type: 'major' as StarType,
    element: '水',
    polarity: '阴',
    score: 0,
    category: 'major',
    description: '富星，主财富、细腻、情感，化气为富',
  },
  {
    name: '贪狼',
    type: 'major' as StarType,
    element: '木',
    polarity: '阳' as '阳' | '阴',
    score: 0,
    category: 'major',
    description: '桃花星，主欲望、机谋、交际，化气为桃花',
  },
  {
    name: '巨门',
    type: 'major' as StarType,
    element: '水',
    polarity: '阴' as '阳' | '阴',
    score: 0,
    category: 'major',
    description: '暗星，主口舌、怀疑、分析，化气为暗',
  },
  {
    name: '天相',
    type: 'major' as StarType,
    element: '水',
    polarity: '阴',
    score: 0,
    category: 'major',
    description: '印星，主辅佐、契约、justice，化气为印',
  },
  {
    name: '天梁',
    type: 'major' as StarType,
    element: '土',
    polarity: '阳',
    score: 0,
    category: 'major',
    description: '荫星，主庇荫、医药、督导，化气为荫',
  },
  {
    name: '七杀',
    type: 'major' as StarType,
    element: '金' as '木' | '火' | '土' | '金' | '水',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: 0,
    category: 'major',
    description: '将星，主权谋、奋斗、肃杀，化气为将',
  },
  {
    name: '破军',
    type: 'major' as StarType,
    element: '水',
    polarity: '阴' as '阳' | '阴' | '阴阳',
    score: 0,
    category: 'major',
    description: '耗星，主突破、消耗、冲锋，化气为耗',
  },
];

/**
 * 六吉星数据
 */
export const LUCKY_STARS: StarAttr[] = [
  {
    name: '左辅',
    type: 'lucky' as StarType,
    element: '土',
    polarity: '阳',
    score: 0.5,
    category: 'lucky',
    description: '辅佐星，主助力、稳重、持续',
  },
  {
    name: '右弼',
    type: 'lucky' as StarType,
    element: '土',
    polarity: '阴',
    score: 0.5,
    category: 'lucky',
    description: '辅佐星，主助力、圆融、协调',
  },
  {
    name: '文昌',
    type: 'lucky' as StarType,
    element: '金',
    polarity: '阴' as '阳' | '阴',
    score: 0.5,
    category: 'lucky',
    description: '文星，主才华、文学、考试',
  },
  {
    name: '文曲',
    type: 'lucky' as StarType,
    element: '水',
    polarity: '阴',
    score: 0.5,
    category: 'lucky',
    description: '文星，主文艺、机敏、口才',
  },
  {
    name: '天魁',
    type: 'lucky' as StarType,
    element: '火',
    polarity: '阳',
    score: 0.5,
    category: 'lucky',
    description: '贵人星，主贵人、机遇、助力',
  },
  {
    name: '天钺',
    type: 'lucky' as StarType,
    element: '火',
    polarity: '阴',
    score: 0.5,
    category: 'lucky',
    description: '贵人星，主贵人、解厄、助力',
  },
];

/**
 * 六煞星数据
 */
export const UNLUCKY_STARS: StarAttr[] = [
  {
    name: '火星',
    type: 'unlucky' as StarType,
    element: '火',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: -0.5,
    category: 'unlucky',
    description: '煞星，主爆发、冲动、突发，化气为刑',
  },
  {
    name: '铃星',
    type: 'unlucky' as StarType,
    element: '火',
    polarity: '阴',
    score: -0.5,
    category: 'unlucky',
    description: '煞星，主阴沉、算计、计较',
  },
  {
    name: '地空',
    type: 'unlucky' as StarType,
    element: '土',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: -0.5,
    category: 'unlucky',
    description: '煞星，主空亡、虚华、失去',
  },
  {
    name: '地劫',
    type: 'unlucky' as StarType,
    element: '土',
    polarity: '阴',
    score: -0.5,
    category: 'unlucky',
    description: '煞星，主劫夺、损失、波折',
  },
  {
    name: '擎羊',
    type: 'unlucky' as StarType,
    element: '金',
    polarity: '阳',
    score: -0.5,
    category: 'unlucky',
    description: '煞星，主刚强、刑伤、明灾，化气为刑',
  },
  {
    name: '陀罗',
    type: 'unlucky' as StarType,
    element: '金',
    polarity: '阴',
    score: -0.5,
    category: 'unlucky',
    description: '煞星，主拖延、纠缠、暗疾，化气为忌',
  },
];

/**
 * 四化星数据
 */
export const HUA_STARS: StarAttr[] = [
  {
    name: '化禄',
    type: 'hua' as StarType,
    element: '木',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: 0.5,
    category: 'hua',
    description: '主顺畅、财禄、机缘',
  },
  {
    name: '化权',
    type: 'hua' as StarType,
    element: '火',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: 0,
    category: 'hua',
    description: '主权势、掌控、竞争',
  },
  {
    name: '化科',
    type: 'hua' as StarType,
    element: '木',
    polarity: '阴',
    score: 0,
    category: 'hua',
    description: '主名声、科名、贵人',
  },
  {
    name: '化忌',
    type: 'hua' as StarType,
    element: '水',
    polarity: '阴' as '阳' | '阴' | '阴阳',
    score: -0.5,
    category: 'hua',
    description: '主执念、欠债、阻滞',
  },
];

/**
 * 其他星曜数据
 */
export const OTHER_STARS: StarAttr[] = [
  {
    name: '禄存',
    type: 'other' as StarType,
    element: '土',
    polarity: '阳',
    score: 0,
    category: 'other',
    description: '主财禄、积蓄、稳健，旺宫+0.3，平宫0，陷宫或空宫-0.3',
  },
  {
    name: '天马',
    type: 'other' as StarType,
    element: '火',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: 0,
    category: 'other',
    description: '主奔波、动态、变动',
  },
  {
    name: '红鸾',
    type: 'other' as StarType,
    element: '水',
    polarity: '阴',
    score: 0,
    category: 'other',
    description: '桃花星，主恋爱、婚姻、喜庆',
  },
  {
    name: '天喜',
    type: 'other' as StarType,
    element: '水',
    polarity: '阳',
    score: 0,
    category: 'other',
    description: '桃花星，主喜庆、缘分、桃花',
  },
  {
    name: '华盖',
    type: 'other' as StarType,
    element: '土',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: 0,
    category: 'other',
    description: '主孤独、才艺、宗教',
  },
  {
    name: '天刑',
    type: 'other' as StarType,
    element: '火',
    polarity: '阳' as '阳' | '阴' | '阴阳',
    score: 0,
    category: 'other',
    description: '主刑伤、法律、自律',
  },
];

/**
 * 所有星曜数据汇总
 */
export const ALL_STARS: StarAttr[] = [
  ...MAJOR_STARS,
  ...LUCKY_STARS,
  ...UNLUCKY_STARS,
  ...HUA_STARS,
  ...OTHER_STARS,
];

/**
 * 根据星名获取星曜属性
 */
export function getStarAttr(name: StarName): StarAttr | undefined {
  return ALL_STARS.find(s => s.name === name);
}

/**
 * 判断是否为主星
 */
export function isMajorStar(name: StarName): boolean {
  const star = getStarAttr(name);
  return star?.category === 'major';
}

/**
 * 获取星曜类型
 */
export function getStarType(name: StarName): StarType {
  const star = getStarAttr(name);
  return star?.type ?? StarType.Other;
}
