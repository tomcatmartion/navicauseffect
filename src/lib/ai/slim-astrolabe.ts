/**
 * 命盘数据精简模块
 * 从 iztro astrolabe 对象中提取 AI 解读所需的最小字段集，
 * 去掉内部方法、scope 标记等冗余数据，减少发给大模型的 token 量。
 * 保留 decadal（大限时间数据）和 ages（小限年龄数组）。
 */

/** 精简后的星曜 */
interface SlimStar {
  name: string;
  type?: string;
  brightness?: string;
  mutagen?: string;
}

/** 精简后的宫位 */
interface SlimPalace {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  majorStars: SlimStar[];
  minorStars: SlimStar[];
  adjectiveStars: SlimStar[];
  decadal?: {
    range: [number, number];
    heavenlyStem: string;
    earthlyBranch: string;
  };
  ages: number[];
  changsheng12?: string;
  boshi12?: string;
}

/** 精简后的命盘 */
export interface SlimAstrolabe {
  solarDate: string;
  lunarDate?: string;
  chineseDate?: string;
  time?: string;
  sign?: string;
  zodiac?: string;
  soul?: string;
  body?: string;
  fiveElementsClass?: string;
  gender?: string;
  palaces: SlimPalace[];
}

/** 提取星曜关键字段 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function slimStar(star: any): SlimStar {
  return {
    name: star.name ?? "",
    type: star.type ?? undefined,
    brightness: star.brightness ?? undefined,
    mutagen: star.mutagen ?? undefined,
  };
}

/** 提取宫位关键字段（保留 decadal + ages） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function slimPalace(palace: any): SlimPalace {
  const result: SlimPalace = {
    name: palace.name ?? "",
    heavenlyStem: palace.heavenlyStem ?? "",
    earthlyBranch: palace.earthlyBranch ?? "",
    isBodyPalace: !!palace.isBodyPalace,
    isOriginalPalace: !!palace.isOriginalPalace,
    majorStars: Array.isArray(palace.majorStars)
      ? palace.majorStars.map(slimStar)
      : [],
    minorStars: Array.isArray(palace.minorStars)
      ? palace.minorStars.map(slimStar)
      : [],
    adjectiveStars: Array.isArray(palace.adjectiveStars)
      ? palace.adjectiveStars.map(slimStar)
      : [],
    ages: Array.isArray(palace.ages) ? palace.ages : [],
  };

  // 保留 decadal
  if (palace.decadal) {
    result.decadal = {
      range: palace.decadal.range ?? [0, 0],
      heavenlyStem: palace.decadal.heavenlyStem ?? "",
      earthlyBranch: palace.decadal.earthlyBranch ?? "",
    };
  }

  // 保留可选的神煞
  if (palace.changsheng12) result.changsheng12 = palace.changsheng12;
  if (palace.boshi12) result.boshi12 = palace.boshi12;

  return result;
}

/**
 * 将完整命盘数据精简为 AI 解读所需的最小结构。
 * 保留 decadal（大限时间数据）和 ages（小限年龄数组）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function slimAstrolabeData(astrolabeData: any): SlimAstrolabe {
  if (!astrolabeData) return { solarDate: "", palaces: [] };

  return {
    solarDate: astrolabeData.solarDate ?? "",
    lunarDate: astrolabeData.lunarDate ?? undefined,
    chineseDate: astrolabeData.chineseDate ?? undefined,
    time: astrolabeData.time ?? undefined,
    sign: astrolabeData.sign ?? undefined,
    zodiac: astrolabeData.zodiac ?? undefined,
    soul: astrolabeData.soul ?? undefined,
    body: astrolabeData.body ?? undefined,
    fiveElementsClass: astrolabeData.fiveElementsClass ?? undefined,
    gender: astrolabeData.gender ?? undefined,
    palaces: Array.isArray(astrolabeData.palaces)
      ? astrolabeData.palaces.map(slimPalace)
      : [],
  };
}
