/**
 * 格局库
 * 包含格局的成格条件与引动条件
 */

import type { PatternCategory } from '../types';
import type { Chart, Palace, StarName, Branch } from '../types/chart';
import type { PatternMatch } from '../types/analysis';
import { getOppositeBranch, getTriadBranches, getFlankBranches } from '../utils/spatial';

/**
 * 格局定义
 */
export interface Pattern {
  name: string;
  category: PatternCategory;
  type: 'natal' | 'decennial' | 'annual'; // 原局/大限/流年
  scope: 'chart' | 'palace'; // 图表级 vs 宫位级
  description: string;
  check: (chart: Chart, palace?: Palace) => boolean;
  effect: string;
}

/**
 * 辅助函数：检查星曜是否在宫位中
 */
function hasStarInPalace(palace: Palace, starName: StarName): boolean {
  return palace.stars.some(s => s.name === starName);
}

/**
 * 辅助函数：检查宫位中是否有化禄（通过 star.huaType）
 */
function hasHuaLuInPalace(palace: Palace): boolean {
  return palace.stars.some(s => s.huaType === 'lu');
}

/**
 * 辅助函数：检查指定地支的宫位中是否有化禄
 */
function hasHuaLuInBranch(chart: Chart, branch: Branch): boolean {
  return hasHuaLuInPalace(chart.palaces[branch]);
}

/**
 * 辅助函数：检查宫位中是否有化忌（通过 star.huaType）
 */
function hasHuaJiInPalace(palace: Palace): boolean {
  return palace.stars.some(s => s.huaType === 'ji');
}

/**
 * 辅助函数：检查指定地支的宫位中是否有化忌
 */
function hasHuaJiInBranch(chart: Chart, branch: Branch): boolean {
  return hasHuaJiInPalace(chart.palaces[branch]);
}

/**
 * 辅助函数：检查宫位中是否有禄存
 */
function hasLucunInPalace(palace: Palace): boolean {
  return palace.stars.some(s => s.name === '禄存');
}

/**
 * 辅助函数：检查指定地支的宫位中是否有禄存
 */
function hasLucunInBranch(chart: Chart, branch: Branch): boolean {
  return hasLucunInPalace(chart.palaces[branch]);
}

/**
 * 辅助函数：检查星曜是否在命盘中的指定地支
 */
function hasStarInBranch(chart: Chart, starName: StarName, branch: Branch): boolean {
  const palace = chart.palaces[branch];
  return palace && palace.stars.some(s => s.name === starName);
}

/**
 * 大吉格局
 */
const MAJOR_LUCKY_PATTERNS: Pattern[] = [
  {
    scope: 'palace',
    name: '双禄夹',
    category: '大吉',
    type: 'natal',
    description: '目标宫位左右两侧各有化禄或禄存',
    check: (chart, palace) => {
      if (!palace) return false;
      const [flank1, flank2] = getFlankBranches(palace.branch);
      // 两侧各有禄（化禄或禄存均可）
      const hasLuOnFlank1 = hasHuaLuInBranch(chart, flank1) || hasLucunInBranch(chart, flank1);
      const hasLuOnFlank2 = hasHuaLuInBranch(chart, flank2) || hasLucunInBranch(chart, flank2);
      return hasLuOnFlank1 && hasLuOnFlank2;
    },
    effect: '护佑格局，凶限时能守住底线，不易彻底崩盘',
  },
  {
    scope: 'chart',
    name: '禄马交驰',
    category: '大吉',
    type: 'natal',
    description: '禄存与天马同宫或对照',
    check: (chart) => {
      // 检查禄存与天马的位置关系
      let lucunBranch: Branch | undefined;
      let tianmaBranch: Branch | undefined;

      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        const palace = chart.palaces[branch];
        if (palace.stars.some(s => s.name === '禄存')) {
          lucunBranch = branch;
        }
        if (palace.stars.some(s => s.name === '天马')) {
          tianmaBranch = branch;
        }
      }

      if (!lucunBranch || !tianmaBranch) return false;

      // 同宫或对宫
      return lucunBranch === tianmaBranch || lucunBranch === getOppositeBranch(tianmaBranch);
    },
    effect: '财运动态来财，奔波中有财，利于异地发展',
  },
  {
    scope: 'chart',
    name: '府相朝元',
    category: '大吉',
    type: 'natal',
    description: '天府与天相在三合或对照宫',
    check: (chart) => {
      // 检查天府与天相是否在三合或对照宫
      let tianfuBranch: Branch | undefined;
      let tianxiangBranch: Branch | undefined;

      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        const palace = chart.palaces[branch];
        if (palace.stars.some(s => s.name === '天府')) {
          tianfuBranch = branch;
        }
        if (palace.stars.some(s => s.name === '天相')) {
          tianxiangBranch = branch;
        }
      }

      if (!tianfuBranch || !tianxiangBranch) return false;

      // 检查是否在三合宫
      const [triad1, triad2] = getTriadBranches(tianfuBranch);
      if (triad1 === tianxiangBranch || triad2 === tianxiangBranch) return true;

      // 检查是否在对照宫
      return tianxiangBranch === getOppositeBranch(tianfuBranch);
    },
    effect: '综合管理能力强，财经稳健，有格局',
  },
  {
    scope: 'chart',
    name: '紫府朝垣',
    category: '大吉',
    type: 'natal',
    description: '紫微与天府在三合或对照宫',
    check: (chart) => {
      // 检查紫微与天府是否在三合四正
      let ziweiBranch: Branch | undefined;
      let tianfuBranch: Branch | undefined;

      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        const palace = chart.palaces[branch];
        if (palace.stars.some(s => s.name === '紫微')) {
          ziweiBranch = branch;
        }
        if (palace.stars.some(s => s.name === '天府')) {
          tianfuBranch = branch;
        }
      }

      if (!ziweiBranch || !tianfuBranch) return false;

      // 检查是否在三合宫
      const [triad1, triad2] = getTriadBranches(ziweiBranch);
      if (triad1 === tianfuBranch || triad2 === tianfuBranch) return true;

      // 检查是否在对照宫
      return tianfuBranch === getOppositeBranch(ziweiBranch);
    },
    effect: '权贵格局，领导力强，利于从政或管理',
  },
  {
    scope: 'palace',
    name: '阳梁昌禄',
    category: '大吉',
    type: 'natal',
    description: '太阳、天梁、文昌、化禄同宫',
    check: (chart, palace) => {
      if (!palace) return false;
      // 检查太阳、天梁、文昌同宫，且其中一颗有化禄
      const stars = palace.stars;
      const hasSun = stars.some(s => s.name === '太阳');
      const hasLiang = stars.some(s => s.name === '天梁');
      const hasChang = stars.some(s => s.name === '文昌');
      const hasLu = stars.some(s => s.huaType === 'lu');

      return hasSun && hasLiang && hasChang && hasLu;
    },
    effect: '科甲名声格，适合学术教育公职',
  },
  {
    scope: 'chart',
    name: '三奇嘉会',
    category: '大吉',
    type: 'natal',
    description: '化禄、化权、化科汇聚于命宫三方四正',
    check: (chart) => {
      // 使用生年四化（chart.birthHua），检查三方四正是否齐全
      const mingBranch = chart.mingPalace;
      const oppositeBranch = getOppositeBranch(mingBranch);
      const [triad1, triad2] = getTriadBranches(mingBranch);

      // 命宫三方四正的地支集合
      const keyBranches = new Set([mingBranch, oppositeBranch, triad1, triad2]);

      let hasLu = false;
      let hasQuan = false;
      let hasKe = false;

      for (const branch of keyBranches) {
        const palace = chart.palaces[branch];
        for (const star of palace.stars) {
          if (star.huaType === 'lu') hasLu = true;
          if (star.huaType === 'quan') hasQuan = true;
          if (star.huaType === 'ke') hasKe = true;
        }
      }

      return hasLu && hasQuan && hasKe;
    },
    effect: '主富贵双全，才华出众，名利兼收',
  },
];

/**
 * 中吉格局
 */
const MEDIUM_LUCKY_PATTERNS: Pattern[] = [
  {
    scope: 'palace',
    name: '左辅右弼同宫',
    category: '中吉',
    type: 'natal',
    description: '左辅与右弼同宫',
    check: (chart, palace) => {
      if (!palace) return false;
      const stars = palace.stars.map(s => s.name);
      return stars.includes('左辅') && stars.includes('右弼');
    },
    effect: '助力强大，处事稳重，多贵人相助',
  },
  {
    scope: 'palace',
    name: '昌曲同宫',
    category: '中吉',
    type: 'natal',
    description: '文昌与文曲同宫',
    check: (chart, palace) => {
      if (!palace) return false;
      const stars = palace.stars.map(s => s.name);
      return stars.includes('文昌') && stars.includes('文曲');
    },
    effect: '才华横溢，文艺气质，利于考试成名',
  },
  {
    scope: 'palace',
    name: '魁钺同宫',
    category: '中吉',
    type: 'natal',
    description: '天魁与天钺同宫',
    check: (chart, palace) => {
      if (!palace) return false;
      const stars = palace.stars.map(s => s.name);
      return stars.includes('天魁') && stars.includes('天钺');
    },
    effect: '贵人运强，遇事有助，利于社交发展',
  },
  {
    scope: 'chart',
    name: '月朗天门',
    category: '中吉',
    type: 'natal',
    description: '太阴在亥宫',
    check: (chart) => {
      const haiPalace = chart.palaces['亥'];
      return haiPalace.stars.some(s => s.name === '太阴');
    },
    effect: '清贵之格，主名声、财气，女性尤佳',
  },
  {
    scope: 'chart',
    name: '明珠出海',
    category: '中吉',
    type: 'natal',
    description: '太阴在亥宫守命，三合有太阳在卯宫',
    check: (chart) => {
      const haiPalace = chart.palaces['亥'];
      const maoPalace = chart.palaces['卯'];
      const hasTaiyinInHai = haiPalace.stars.some(s => s.name === '太阴');
      const hasTaiyangInMao = maoPalace.stars.some(s => s.name === '太阳');
      // 太阴在亥宫，太阳在卯宫，且命宫在亥
      return hasTaiyinInHai && hasTaiyangInMao && chart.mingPalace === '亥';
    },
    effect: '才华出众，清秀明亮，利于文艺',
  },
];

/**
 * 辅助函数：检查煞星是否在指定地支的宫位中
 */
function hasShaStarInBranch(chart: Chart, starName: StarName, branch: Branch): boolean {
  const palace = chart.palaces[branch];
  return palace.stars.some(s => s.name === starName);
}

/**
 * 小吉格局
 */
const MINOR_LUCKY_PATTERNS: Pattern[] = [
  {
    scope: 'chart',
    name: '文桂文华',
    category: '小吉',
    type: 'natal',
    description: '昌曲夹命',
    check: (chart) => {
      const mingPalace = chart.palaces[chart.mingPalace];
      // 检查夹宫是否有昌曲
      const [flank1, flank2] = getFlankBranches(mingPalace.branch);
      const hasChang = hasStarInBranch(chart, '文昌', flank1) || hasStarInBranch(chart, '文昌', flank2);
      const hasQu = hasStarInBranch(chart, '文曲', flank1) || hasStarInBranch(chart, '文曲', flank2);
      return hasChang && hasQu;
    },
    effect: '主文采斐然，利于考试',
  },
  {
    scope: 'chart',
    name: '天乙贵人',
    category: '小吉',
    type: 'natal',
    description: '天魁或天钺入命宫',
    check: (chart) => {
      const mingPalace = chart.palaces[chart.mingPalace];
      return mingPalace.stars.some(s => s.name === '天魁' || s.name === '天钺');
    },
    effect: '贵人运佳，遇事有助',
  },
];

/**
 * 大凶格局
 */
const MAJOR_UNLUCKY_PATTERNS: Pattern[] = [
  {
    scope: 'palace',
    name: '羊陀夹忌',
    category: '大凶',
    type: 'natal',
    description: '擎羊、陀罗夹化忌',
    check: (chart) => {
      // 找到化忌所在宫位，检查夹宫是否有擎羊和陀罗
      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        if (hasHuaJiInBranch(chart, branch)) {
          const [flank1, flank2] = getFlankBranches(branch);
          const qingyangOnOneSide = hasShaStarInBranch(chart, '擎羊', flank1) && hasShaStarInBranch(chart, '陀罗', flank2);
          const qingyangOnOtherSide = hasShaStarInBranch(chart, '擎羊', flank2) && hasShaStarInBranch(chart, '陀罗', flank1);
          if (qingyangOnOneSide || qingyangOnOtherSide) {
            return true;
          }
        }
      }
      return false;
    },
    effect: '致命凶格，被夹者必受重创，刑伤灾祸',
  },
  {
    scope: 'palace',
    name: '刑囚夹印',
    category: '大凶',
    type: 'natal',
    description: '天相被擎羊、陀罗夹',
    check: (chart) => {
      // 找到天相所在宫位，检查夹宫是否有擎羊和陀罗
      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        if (hasStarInBranch(chart, '天相', branch)) {
          const [flank1, flank2] = getFlankBranches(branch);
          const qingyangOnOneSide = hasShaStarInBranch(chart, '擎羊', flank1) && hasShaStarInBranch(chart, '陀罗', flank2);
          const qingyangOnOtherSide = hasShaStarInBranch(chart, '擎羊', flank2) && hasShaStarInBranch(chart, '陀罗', flank1);
          if (qingyangOnOneSide || qingyangOnOtherSide) {
            return true;
          }
        }
      }
      return false;
    },
    effect: '官非口舌，刑伤纠纷，仕途不利',
  },
  {
    scope: 'chart',
    name: '马头带剑',
    category: '大凶',
    type: 'natal',
    description: '擎羊与天马同宫',
    check: (chart) => {
      // 检查擎羊与天马是否同宫
      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        const palace = chart.palaces[branch];
        const hasQingyang = palace.stars.some(s => s.name === '擎羊');
        const hasTianma = palace.stars.some(s => s.name === '天马');
        if (hasQingyang && hasTianma) {
          return true;
        }
      }
      return false;
    },
    effect: '奔波劳碌，血光之灾，异地不利',
  },
  {
    scope: 'palace',
    name: '刑忌夹印',
    category: '大凶',
    type: 'natal',
    description: '天相被化忌和煞星夹',
    check: (chart) => {
      // 找到天相所在宫位，检查夹宫是否一侧有化忌，另一侧有煞星
      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        if (hasStarInBranch(chart, '天相', branch)) {
          const [flank1, flank2] = getFlankBranches(branch);
          const shaStars: StarName[] = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
          const hasHuaJi1 = hasHuaJiInBranch(chart, flank1);
          const hasHuaJi2 = hasHuaJiInBranch(chart, flank2);
          const hasSha1 = shaStars.some(star => hasShaStarInBranch(chart, star, flank1));
          const hasSha2 = shaStars.some(star => hasShaStarInBranch(chart, star, flank2));
          // 一侧化忌，另一侧煞星
          if ((hasHuaJi1 && hasSha2) || (hasHuaJi2 && hasSha1)) {
            return true;
          }
        }
      }
      return false;
    },
    effect: '官非刑伤，文书纠纷，破财 loss',
  },
];

/**
 * 中凶格局
 */
const MEDIUM_UNLUCKY_PATTERNS: Pattern[] = [
  {
    scope: 'chart',
    name: '空劫夹',
    category: '中凶',
    type: 'natal',
    description: '地空、地劫夹命宫',
    check: (chart) => {
      const mingPalace = chart.palaces[chart.mingPalace];
      // 检查夹宫是否有空劫
      const [flank1, flank2] = getFlankBranches(mingPalace.branch);
      const hasKong = hasShaStarInBranch(chart, '地空', flank1) || hasShaStarInBranch(chart, '地空', flank2);
      const hasJie = hasShaStarInBranch(chart, '地劫', flank1) || hasShaStarInBranch(chart, '地劫', flank2);
      // 两侧分别有地空和地劫
      const kongOnOneSide = hasShaStarInBranch(chart, '地空', flank1) && hasShaStarInBranch(chart, '地劫', flank2);
      const kongOnOtherSide = hasShaStarInBranch(chart, '地空', flank2) && hasShaStarInBranch(chart, '地劫', flank1);
      return kongOnOneSide || kongOnOtherSide;
    },
    effect: '虚华不实，财来财去，须防破财',
  },
  {
    scope: 'chart',
    name: '火铃夹',
    category: '中凶',
    type: 'natal',
    description: '火星、铃星夹命宫',
    check: (chart) => {
      const mingPalace = chart.palaces[chart.mingPalace];
      // 检查夹宫是否有火铃
      const [flank1, flank2] = getFlankBranches(mingPalace.branch);
      const huoOnOneSide = hasShaStarInBranch(chart, '火星', flank1) && hasShaStarInBranch(chart, '铃星', flank2);
      const huoOnOtherSide = hasShaStarInBranch(chart, '火星', flank2) && hasShaStarInBranch(chart, '铃星', flank1);
      return huoOnOneSide || huoOnOtherSide;
    },
    effect: '脾气暴躁，易冲动，须防突发灾害',
  },
  {
    scope: 'chart',
    name: '交禄空亡',
    category: '中凶',
    type: 'natal',
    description: '禄存在空宫',
    check: (chart) => {
      // 检查禄存是否在空宫（无主星的宫位）
      for (const branch of Object.keys(chart.palaces) as Branch[]) {
        const palace = chart.palaces[branch];
        const hasLucun = palace.stars.some(s => s.name === '禄存');
        if (hasLucun) {
          // 检查该宫位是否无主星
          const hasMajorStars = palace.stars.some(s => s.type === 'major');
          if (!hasMajorStars) {
            return true;
          }
        }
      }
      return false;
    },
    effect: '财源受限，委屈求全，双重限缩',
  },
];

/**
 * 小凶格局
 */
const MINOR_UNLUCKY_PATTERNS: Pattern[] = [
  {
    scope: 'chart',
    name: '借对宫',
    category: '小凶',
    type: 'natal',
    description: '命宫无主星，借对宫星曜',
    check: (chart) => {
      const mingPalace = chart.palaces[chart.mingPalace];
      return mingPalace.stars.filter(s => s.type === 'major').length === 0;
    },
    effect: '吉象减半，凶象更凶，依赖外部环境',
  },
  {
    scope: 'chart',
    name: '孤立无援',
    category: '小凶',
    type: 'natal',
    description: '命宫无吉星，三合宫也无吉星',
    check: (chart) => {
      const mingPalace = chart.palaces[chart.mingPalace];
      const hasLucky = mingPalace.stars.some(s =>
        s.name === '左辅' || s.name === '右弼' ||
        s.name === '文昌' || s.name === '文曲' ||
        s.name === '天魁' || s.name === '天钺'
      );
      return !hasLucky;
    },
    effect: '助力较少，凡事多靠自己',
  },
];

/**
 * 所有格局汇总
 */
export const ALL_PATTERNS: Pattern[] = [
  ...MAJOR_LUCKY_PATTERNS,
  ...MEDIUM_LUCKY_PATTERNS,
  ...MINOR_LUCKY_PATTERNS,
  ...MAJOR_UNLUCKY_PATTERNS,
  ...MEDIUM_UNLUCKY_PATTERNS,
  ...MINOR_UNLUCKY_PATTERNS,
];

/**
 * 按分类获取格局
 */
export function getPatternsByCategory(category: PatternCategory): Pattern[] {
  return ALL_PATTERNS.filter(p => p.category === category);
}

/**
 * 检查命盘中所有成格的格局
 */
export function checkAllPatterns(
  chart: Chart,
  type?: 'natal' | 'decennial' | 'annual'
): PatternMatch[] {
  let patterns = ALL_PATTERNS;

  if (type) {
    patterns = patterns.filter(p => p.type === type);
  }

  const matched: PatternMatch[] = [];

  for (const pattern of patterns) {
    try {
      if (pattern.check(chart)) {
        matched.push({
          name: pattern.name,
          category: pattern.category,
          source: pattern.type,
          description: pattern.description || '',
          effect: getPatternEffect(pattern.category),
        });
      }
    } catch (e) {
      // 检查失败，跳过
    }
  }

  return matched;
}

/**
 * 检查单个宫位的格局
 */
export function checkPalacePatterns(chart: Chart, palace: Palace): Pattern[] {
  const matched: Pattern[] = [];

  for (const pattern of ALL_PATTERNS) {
    try {
      if (pattern.check(chart, palace)) {
        matched.push(pattern);
      }
    } catch (e) {
      // 检查失败，跳过
    }
  }

  return matched;
}

/**
 * 判断格局吉凶
 */
export function getPatternEffect(category: PatternCategory): 'positive' | 'negative' | 'mixed' {
  if (category === '大吉' || category === '中吉' || category === '小吉') {
    return 'positive';
  }
  if (category === '大凶' || category === '中凶' || category === '小凶') {
    return 'negative';
  }
  return 'mixed';
}
