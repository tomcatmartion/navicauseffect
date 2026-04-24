import { createHash } from "crypto";

/** 长词优先，避免「天」误匹配（供 RAG 关键词抽取等复用） */
export const STAR_NAMES: string[] = [
  "紫微",
  "天机",
  "太阳",
  "武曲",
  "天同",
  "廉贞",
  "天府",
  "太阴",
  "贪狼",
  "巨门",
  "天相",
  "天梁",
  "七杀",
  "破军",
  "文昌",
  "文曲",
  "左辅",
  "右弼",
  "天魁",
  "天钺",
  "擎羊",
  "陀罗",
  "禄存",
  "天马",
  "火星",
  "铃星",
  "地空",
  "地劫",
  "化禄",
  "化权",
  "化科",
  "化忌",
  "红鸾",
  "天喜",
  "天姚",
  "咸池",
].sort((a, b) => b.length - a.length);

export const PALACE_NAMES = [
  "命宫",
  "兄弟宫",
  "夫妻宫",
  "子女宫",
  "财帛宫",
  "疾厄宫",
  "迁移宫",
  "交友宫",
  "仆役宫",
  "官禄宫",
  "事业宫",
  "田宅宫",
  "福德宫",
  "父母宫",
].sort((a, b) => b.length - a.length);

const ENERGY_PATTERN = /庙|旺|利|得|平|陷/g;
const TIME_SCOPE_PATTERN = /原局|大限|流年|小限/g;

export interface ChunkExtractedMeta {
  stars: string[];
  palaces: string[];
  /** 庙 / 旺 / 利 / 得 / 平 / 陷（对应需求的 energy_level 多值） */
  energy_levels: string[];
  /** 原局 / 大限 / 流年 / 小限（对应 time_scope 多值） */
  time_scopes: string[];
  content_hash: string;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** 从块文本硬提取紫微语义锚点（星曜、宫位、庙旺利陷、时限词） */
export function extractChunkMetadata(text: string): ChunkExtractedMeta {
  const stars: string[] = [];
  for (const name of STAR_NAMES) {
    if (text.includes(name)) stars.push(name);
  }

  const palaces: string[] = [];
  for (const p of PALACE_NAMES) {
    if (text.includes(p)) palaces.push(p);
  }

  const energy_levels = [...text.matchAll(ENERGY_PATTERN)].map((m) => m[0]);
  const time_scopes = [...text.matchAll(TIME_SCOPE_PATTERN)].map((m) => m[0]);

  return {
    stars: [...new Set(stars)],
    palaces: [...new Set(palaces)],
    energy_levels: [...new Set(energy_levels)],
    time_scopes: [...new Set(time_scopes)],
    content_hash: sha256Hex(text),
  };
}

/** 稳定块 ID：源文件相对路径 + 块序号 */
export function stableChunkId(sourceRelPath: string, chunkIndex: number): string {
  return sha256Hex(`${sourceRelPath}\0${chunkIndex}`);
}
