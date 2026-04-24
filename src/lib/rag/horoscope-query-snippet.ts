/**
 * 从命盘页传入的运限 JSON 抽取检索用短句（大限 / 小限 / 流年等），
 * 不依赖 iztro 运行时方法，仅读可序列化字段。
 */
export function buildHoroscopeQuerySnippet(
  horoscopeData: Record<string, unknown> | undefined
): string {
  if (!horoscopeData || typeof horoscopeData !== "object") return "";

  const lines: string[] = [];

  const solar = horoscopeData.solarDate;
  const lunar = horoscopeData.lunarDate;
  if (typeof solar === "string" && solar) lines.push(`推运阳历：${solar}`);
  if (typeof lunar === "string" && lunar) lines.push(`推运农历：${lunar}`);

  const pickItem = (label: string, key: string) => {
    const v = horoscopeData[key];
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    const o = v as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.name === "string") parts.push(o.name);
    if (typeof o.heavenlyStem === "string" && typeof o.earthlyBranch === "string") {
      parts.push(`${o.heavenlyStem}${o.earthlyBranch}`);
    }
    if (typeof o.index === "number") parts.push(`宫序${o.index}`);
    if (key === "age" && typeof o.nominalAge === "number") {
      parts.push(`虚岁${o.nominalAge}`);
    }
    if (parts.length) lines.push(`${label}：${parts.join(" ")}`);
  };

  pickItem("大限", "decadal");
  pickItem("小限", "age");
  pickItem("流年", "yearly");
  pickItem("流月", "monthly");

  return lines.join("；").slice(0, 600);
}
