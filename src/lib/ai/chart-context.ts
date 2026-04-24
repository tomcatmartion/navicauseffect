/**
 * 命盘上下文构建模块（共享）
 *
 * 供 /api/analysis/chat 和 /api/analysis/chat-context 共用。
 * 根据用户问题动态组装命盘 + 运限数据，注入 AI prompt。
 */

import { formatChartCnJson, formatHoroscopeItemJson } from "@/lib/ai/format-chart-cn";

// ============================================================
// 辅助函数
// ============================================================

/**
 * 从用户问题中解析目标年份。
 * 支持格式：2028年、明年、后年、去年、前年。
 */
function parseYearFromQuestion(
  question: string,
  currentYear: number = new Date().getFullYear()
): number | null {
  const yearMatch = question.match(/(?:19|20)\d{2}年/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0].replace("年", ""), 10);
    if (year >= 1900 && year <= 2100) return year;
  }
  if (/明年/.test(question)) return currentYear + 1;
  if (/后年/.test(question)) return currentYear + 2;
  if (/去年/.test(question)) return currentYear - 1;
  if (/前年/.test(question)) return currentYear - 2;
  return null;
}

/**
 * 根据目标年份找到对应的大限信息。
 * 从命盘各宫位的 decadal.range 中查找包含目标年龄的大限。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findTargetDecadal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slimmed: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  horoscopeData: any,
  birthYear: number,
  targetYear: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  const age = targetYear - birthYear;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (slimmed?.palaces) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const palace of slimmed.palaces as any[]) {
      if (palace.decadal?.range && Array.isArray(palace.decadal.range)) {
        const [start, end] = palace.decadal.range;
        if (age >= start && age <= end) {
          return palace.decadal;
        }
      }
    }
  }

  // Fallback: 使用当前 horoscopeData 中的 decadal
  return horoscopeData?.decadal || null;
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 从 horoscopeData 中提取实际排盘日期，用于标注。
 * iztro 的 Horoscope 对象包含 solarDate 字段。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHoroscopeDate(horoscopeData: any): string {
  const solarDate = horoscopeData?.solarDate;
  if (typeof solarDate === "string" && solarDate) return solarDate;
  return "当前日期";
}

/**
 * 构建命盘上下文（动态版本，使用中文 key 格式）。
 *
 * 行为：
 * - 始终输出完整命盘数据 + 大限运星
 * - 始终输出当前流年 + 小限（这是 AI 分析的核心输入）
 * - 当用户问到特定年份时：
 *   - 若与 horoscope 排盘年份一致：直接标注目标年份
 *   - 若不一致：标注为"目标年份"，同时注明实际数据来源日期，
 *     避免将当前年份数据误标为目标年份
 *
 * @param slimmed    slimAstrolabeData() 精简后的命盘数据
 * @param horoscopeData  前端传入的运限数据（基于某个特定日期排盘）
 * @param options    question: 用户问题；birthYear: 出生年份
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildChartContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slimmed: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  horoscopeData?: any,
  options?: { question?: string; birthYear?: number }
): string {
  if (!slimmed || !slimmed.palaces?.length) return "";

  const { question = "", birthYear = 0 } = options || {};
  const targetYear = parseYearFromQuestion(question);
  const hasSpecificYear = targetYear !== null;

  // horoscope 实际排盘日期
  const horoDate = extractHoroscopeDate(horoscopeData);
  // 从 horoscope solarDate 提取实际排盘年份
  const horoYear = typeof horoscopeData?.solarDate === "string"
    ? parseInt(horoscopeData.solarDate.substring(0, 4), 10)
    : 0;

  // 使用中文 key 格式输出完整命盘数据（含十二宫 + 大限）
  let context = `## 当前命盘数据\n${formatChartCnJson(slimmed)}`;

  if (!horoscopeData) return context;

  // ---- 始终包含大限运星 ----
  if (horoscopeData.decadal) {
    context += `\n## 大限运星\n`;
    context += formatHoroscopeItemJson(horoscopeData.decadal, slimmed);
  }

  // ---- 始终包含当前流年 + 小限（AI 分析的核心输入） ----
  if (horoscopeData.yearly) {
    const yearLabel = horoYear ? `${horoYear}年` : "当前";
    context += `\n## 流年运星（${yearLabel}）\n`;
    context += formatHoroscopeItemJson(horoscopeData.yearly, slimmed);
  }

  if (horoscopeData.age) {
    const yearLabel = horoYear ? `${horoYear}年` : "当前";
    context += `\n## 小限运星（${yearLabel}）\n`;
    context += formatHoroscopeItemJson(horoscopeData.age, slimmed);
  }

  // ---- 特定年份场景：补充目标大限 ----
  if (hasSpecificYear && targetYear !== horoYear) {
    const targetDecadal = findTargetDecadal(slimmed, horoscopeData, birthYear, targetYear);
    if (targetDecadal) {
      const age = targetYear - birthYear;
      context += `\n## 目标大限（${targetYear}年，${age}岁）\n`;
      context += formatHoroscopeItemJson(targetDecadal, slimmed);
    }
    // 注意：流年和小限是按年变化的，当前 horoscope 数据是基于 ${horoDate} 排盘的，
    // 如果用户问的目标年份与排盘年份不同，需提醒 AI
    context += `\n> 提示：以上流年/小限数据基于${horoDate}排盘，目标年份${targetYear}年的流年/小限可能不同，请基于命盘规则自行推算${targetYear}年的流年天干地支和小限宫位。`;
  }

  return context;
}
