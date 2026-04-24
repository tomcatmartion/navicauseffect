/**
 * 命盘数据中文 key 格式化模块（极致压缩版）
 * 将 iztro 的英文 key JSON 转为紧凑的中文 key 格式，减少发给大模型的 token 量。
 *
 * 输出结构：
 * - 命盘（formatChartCn）：基础信息 + 十二宫（星耀/四化/大限/长生等） + 10大限（四化+化入）
 * - 运限（formatHoroscopeCn）：大限/流年/小限运星 + 四化+化入
 *
 * 压缩策略：
 * 1. 无缩进 JSON，空值省略
 * 2. 星耀括号标注法："廉贞(庙)禄"、"天相(旺)"、"天魁科"、"右弼"
 * 3. Key 缩短：宫位→宫、天干→干、地支→支
 * 4. 四化星用"化入"映射：AI 无需推导即可知道四化落宫
 */

// ============================================================
// 常量
// ============================================================

/** 天干 → 四化星（禄/权/科/忌） */
const SI_HUA_TABLE: Record<string, [string, string, string, string]> = {
  甲: ["廉贞", "破军", "武曲", "太阳"],
  乙: ["天机", "天梁", "紫微", "太阴"],
  丙: ["天同", "天机", "文昌", "廉贞"],
  丁: ["太阴", "天同", "天机", "巨门"],
  戊: ["贪狼", "太阴", "右弼", "天机"],
  己: ["武曲", "贪狼", "天梁", "文曲"],
  庚: ["太阳", "武曲", "太阴", "天同"],
  辛: ["巨门", "太阳", "文曲", "文昌"],
  壬: ["天梁", "紫微", "左辅", "武曲"],
  癸: ["破军", "巨门", "太阴", "贪狼"],
};

const SI_HUA_LABELS = ["禄", "权", "科", "忌"] as const;

/** iztro 宫序：0=命宫→11=兄弟 */
const PALACE_ORDER = [
  "命宫", "父母", "福德", "田宅", "官禄", "仆役",
  "迁移", "疾厄", "财帛", "子女", "夫妻", "兄弟",
] as const;

// ============================================================
// 内部函数 — 命盘
// ============================================================

/** 星耀 → 紧凑字符串：廉贞(庙)禄 / 天相(旺) / 天魁科 / 右弼 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtStar(star: any): string {
  const name: string = star?.name ?? "";
  const bri: string = star?.brightness ?? "";
  const mut: string = star?.mutagen ?? "";
  let s = name;
  if (bri) s += `(${bri})`;
  if (mut) s += mut;
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtStars(stars: any[] | undefined): string[] {
  if (!Array.isArray(stars)) return [];
  return stars.map(fmtStar);
}

/** 宫位 → 紧凑中文 key 对象 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtPalace(palace: any): Record<string, unknown> {
  const r: Record<string, unknown> = {
    宫: palace.name ?? "",
    干: palace.heavenlyStem ?? "",
    支: palace.earthlyBranch ?? "",
  };

  const 主 = fmtStars(palace.majorStars);
  if (主.length > 0) { r.主星 = 主; } else { r.空宫 = true; }

  if (palace.isBodyPalace) r.身宫 = true;
  if (palace.isOriginalPalace) r.来因 = true;

  const 辅 = fmtStars(palace.minorStars);
  if (辅.length > 0) r.辅星 = 辅;

  const 杂 = fmtStars(palace.adjectiveStars);
  if (杂.length > 0) r.杂耀 = 杂;

  if (palace.changsheng12) r.长生 = palace.changsheng12;
  if (palace.boshi12) r.博士 = palace.boshi12;

  if (palace.decadal) {
    r.限 = [
      palace.decadal.range?.[0] ?? 0,
      palace.decadal.range?.[1] ?? 0,
      palace.decadal.heavenlyStem ?? "",
      palace.decadal.earthlyBranch ?? "",
    ];
  }

  const ages = Array.isArray(palace.ages) ? palace.ages : [];
  if (ages.length > 0) r.小限 = ages;

  return r;
}

// ============================================================
// 内部函数 — 四化 + 化入（命盘和运限共用）
// ============================================================

/**
 * 根据天干计算四化列表和化入映射。
 * @param stem 天干
 * @param palaces 本命十二宫数据（用于查找四化星落宫）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeSiHuaWithPalace(stem: string, palaces: any[]): {
  四化: string[];
  化入: Record<string, string>;
} {
  const stars = SI_HUA_TABLE[stem];
  const 四化: string[] = [];
  const 化入: Record<string, string> = {};

  if (!stars) return { 四化, 化入 };

  for (let j = 0; j < 4; j++) {
    const starName = stars[j];
    const label = `${starName}${SI_HUA_LABELS[j]}`;
    四化.push(label);

    // 查找该星在哪个本命宫（主星+辅星）
    for (let i = 0; i < palaces.length; i++) {
      const np = palaces[i];
      if (!np) continue;
      const all = [
        ...(Array.isArray(np.majorStars) ? np.majorStars : []),
        ...(Array.isArray(np.minorStars) ? np.minorStars : []),
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (all.some((s: any) => s?.name === starName)) {
        化入[label] = np.name ?? "";
        break;
      }
    }
  }

  return { 四化, 化入 };
}

// ============================================================
// 内部函数 — 命盘大限列表
// ============================================================

/** 从本命十二宫的 decadal 字段提取 10 个大限 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDecadalList(palaces: any[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: { palace: any; range: [number, number] }[] = [];

  for (const palace of palaces) {
    const d = palace.decadal;
    if (!d?.range || !Array.isArray(d.range)) continue;
    const key = `${d.range[0]}-${d.range[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ palace, range: d.range });
  }

  entries.sort((a, b) => a.range[0] - b.range[0]);

  return entries.slice(0, 10).map((entry, idx) => {
    const d = entry.palace.decadal;
    const stem: string = d.heavenlyStem ?? "";
    const branch: string = d.earthlyBranch ?? "";
    const { 四化, 化入 } = computeSiHuaWithPalace(stem, palaces);

    const result: Record<string, unknown> = {
      序: idx + 1,
      干支: stem + branch,
      起止: d.range,
      命宫: entry.palace.name ?? "",
      四化,
    };
    if (Object.keys(化入).length > 0) result.化入 = 化入;
    return result;
  });
}

// ============================================================
// 内部函数 — 运限数据（HoroscopeItem）
// ============================================================

/**
 * 格式化单个运限段（大限/流年/小限/流月/流日）。
 * 输出：干支、命宫（本命宫名）、四化+化入、运星、以及各段特有字段。
 *
 * @param item iztro HoroscopeItem
 * @param palaces 本命十二宫（用于计算化入）
 * @param scopeLabel 段落标签（"大限"/"流年"/"小限"等）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtHoroscopeItem(item: any, palaces: any[], scopeLabel: string): Record<string, unknown> | null {
  if (!item) return null;

  const result: Record<string, unknown> = {};
  const stem: string = item.heavenlyStem ?? "";
  const branch: string = item.earthlyBranch ?? "";
  if (stem || branch) result.干支 = stem + branch;

  // 命宫：该运限的命宫对应哪个本命宫
  const scopeIndex: number = item.index ?? -1;
  if (scopeIndex >= 0 && scopeIndex < palaces.length) {
    result.命宫 = palaces[scopeIndex]?.name ?? "";
  }

  // 四化 + 化入（与命盘大限格式一致）
  const { 四化, 化入 } = computeSiHuaWithPalace(stem, palaces);
  if (四化.length > 0) result.四化 = 四化;
  if (Object.keys(化入).length > 0) result.化入 = 化入;

  // 运星：按 palaceNames 映射到宫名，只保留星名
  const names: string[] = item.palaceNames ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const starGroups: any[][] = item.stars ?? [];
  const 运星: Record<string, string | string[]> = {};

  for (let i = 0; i < Math.min(names.length, starGroups.length); i++) {
    const group = starGroups[i];
    if (!Array.isArray(group) || group.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const starNames = group.map((s: any) => s?.name ?? "").filter(Boolean);
    if (starNames.length === 0) continue;
    运星[names[i]] = starNames.length === 1 ? starNames[0] : starNames;
  }
  if (Object.keys(运星).length > 0) result.运星 = 运星;

  // 流年特有：将前12神 / 岁前12神
  if (item.yearlyDecStar) {
    const jiang = item.yearlyDecStar.jiangqian12;
    const sui = item.yearlyDecStar.suiqian12;
    if (Array.isArray(jiang) && jiang.length > 0) result.将前 = jiang;
    if (Array.isArray(sui) && sui.length > 0) result.岁前 = sui;
  }

  // 小限特有：虚岁
  if (item.nominalAge) result.虚岁 = item.nominalAge;

  return Object.keys(result).length > 0 ? result : null;
}

// ============================================================
// 公共函数 — 命盘数据
// ============================================================

/** 将 iztro 命盘数据转为紧凑中文 key 对象 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatChartCn(data: any): Record<string, unknown> {
  if (!data) return { 基础: {}, 十二宫: [], 大限: [] };

  const palaces = Array.isArray(data.palaces) ? data.palaces : [];

  return {
    宫序: PALACE_ORDER.join(","),
    基础: {
      阳历: data.solarDate ?? "",
      农历: data.lunarDate ?? "",
      四柱: data.chineseDate ?? "",
      时辰: data.time ?? "",
      星座: data.sign ?? "",
      生肖: data.zodiac ?? "",
      命主: data.soul ?? "",
      身主: data.body ?? "",
      五行局: data.fiveElementsClass ?? "",
      性别: data.gender ?? "",
    },
    十二宫: palaces.map(fmtPalace),
    大限: buildDecadalList(palaces),
  };
}

/** 命盘数据 → 紧凑 JSON 字符串 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatChartCnJson(data: any): string {
  return JSON.stringify(formatChartCn(data), (_, v) => (v === "" ? undefined : v));
}

// ============================================================
// 公共函数 — 运限数据
// ============================================================

/**
 * 格式化完整运限数据（含大限/流年/小限等）。
 * @param horoscopeData iztro horoscope 输出
 * @param astrolabeData 本命盘数据（用于计算化入映射）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatHoroscopeCn(horoscopeData: any, astrolabeData?: any): Record<string, unknown> {
  if (!horoscopeData) return {};
  const palaces = Array.isArray(astrolabeData?.palaces) ? astrolabeData.palaces : [];

  const result: Record<string, unknown> = {};

  const sections: [string, string][] = [
    ["decadal", "大限"], ["yearly", "流年"], ["age", "小限"],
    ["monthly", "流月"], ["daily", "流日"],
  ];

  for (const [key, label] of sections) {
    if (horoscopeData[key]) {
      const formatted = fmtHoroscopeItem(horoscopeData[key], palaces, label);
      if (formatted) result[label] = formatted;
    }
  }

  return result;
}

/** 完整运限数据 → 紧凑 JSON */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatHoroscopeCnJson(horoscopeData: any, astrolabeData?: any): string {
  return JSON.stringify(formatHoroscopeCn(horoscopeData, astrolabeData), (_, v) => (v === "" ? undefined : v));
}

/** 单个运限段 → 紧凑 JSON（用于 buildChartContext） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatHoroscopeItemJson(item: any, palaces?: any): string {
  const palacesArr = Array.isArray(palaces?.palaces) ? palaces.palaces : (Array.isArray(palaces) ? palaces : []);
  const formatted = fmtHoroscopeItem(item, palacesArr, "");
  return formatted ? JSON.stringify(formatted, (_, v) => (v === "" ? undefined : v)) : "";
}
