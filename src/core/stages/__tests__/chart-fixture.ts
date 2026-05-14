import type { Stage1Input } from '@/core/types'

/** 1990-06-15 午时 男命 — 供 Stage / Hybrid 单测复用 */
export const CHART_FIXTURE: Stage1Input['chartData'] = {
  solarDate: '1990-06-15',
  gender: '男',
  earthlyBranchOfSoulPalace: '寅',
  earthlyBranchOfBodyPalace: '申',
  palaces: [
    {
      name: '命宫',
      earthlyBranch: '寅',
      heavenlyStem: '甲',
      majorStars: [
        { name: '紫微', mutagen: undefined, brightness: 3, type: 'major' },
        { name: '天相', mutagen: undefined, brightness: 4, type: 'major' },
      ],
      minorStars: [
        { name: '左辅', mutagen: undefined, type: 'soft' },
        { name: '右弼', mutagen: undefined, type: 'soft' },
      ],
    },
    {
      name: '父母',
      earthlyBranch: '卯',
      heavenlyStem: '乙',
      majorStars: [{ name: '天机', mutagen: '化禄', brightness: 2, type: 'major' }],
      minorStars: [],
    },
    {
      name: '福德',
      earthlyBranch: '辰',
      heavenlyStem: '丙',
      majorStars: [{ name: '太阳', mutagen: undefined, brightness: 3, type: 'major' }],
      minorStars: [],
    },
    {
      name: '田宅',
      earthlyBranch: '巳',
      heavenlyStem: '丁',
      majorStars: [{ name: '武曲', mutagen: '化科', brightness: 2, type: 'major' }],
      minorStars: [],
    },
    {
      name: '官禄',
      earthlyBranch: '午',
      heavenlyStem: '戊',
      majorStars: [{ name: '天同', mutagen: undefined, brightness: 1, type: 'major' }],
      minorStars: [{ name: '擎羊', mutagen: undefined, type: 'hard' }],
    },
    {
      name: '仆役',
      earthlyBranch: '未',
      heavenlyStem: '己',
      majorStars: [{ name: '廉贞', mutagen: undefined, brightness: 2, type: 'major' }],
      minorStars: [],
    },
    {
      name: '迁移',
      earthlyBranch: '申',
      heavenlyStem: '庚',
      majorStars: [],
      minorStars: [{ name: '天魁', mutagen: undefined, type: 'soft' }],
    },
    {
      name: '疾厄',
      earthlyBranch: '酉',
      heavenlyStem: '辛',
      majorStars: [{ name: '太阴', mutagen: undefined, brightness: 2, type: 'major' }],
      minorStars: [],
    },
    {
      name: '财帛',
      earthlyBranch: '戌',
      heavenlyStem: '壬',
      majorStars: [{ name: '贪狼', mutagen: '化权', brightness: 3, type: 'major' }],
      minorStars: [],
    },
    {
      name: '子女',
      earthlyBranch: '亥',
      heavenlyStem: '癸',
      majorStars: [{ name: '巨门', mutagen: undefined, brightness: 1, type: 'major' }],
      minorStars: [],
    },
    {
      name: '夫妻',
      earthlyBranch: '子',
      heavenlyStem: '甲',
      majorStars: [{ name: '天梁', mutagen: '化忌', brightness: 2, type: 'major' }],
      minorStars: [],
    },
    {
      name: '兄弟',
      earthlyBranch: '丑',
      heavenlyStem: '乙',
      majorStars: [{ name: '七杀', mutagen: undefined, brightness: 3, type: 'major' }],
      minorStars: [{ name: '文昌', mutagen: undefined, type: 'soft' }],
    },
  ],
} as Record<string, unknown>
