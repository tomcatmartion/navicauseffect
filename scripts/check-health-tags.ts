/**
 * 检查标签细化效果：哪些块被打上了"健康"标签、"运势"标签
 */
import "dotenv/config";
import { ZVecOpen } from "@zvec/zvec";
import { ensureZvecInitialized } from "../src/lib/zvec/init-zvec";
import { getLogicdocCollectionPath } from "../src/lib/zvec/paths";
import { prisma } from "../src/lib/db";

ensureZvecInitialized();
const col = ZVecOpen(getLogicdocCollectionPath("1536"), { readOnly: true });

const results = col.querySync({
  fieldName: "embedding",
  vector: new Array(1536).fill(0).map(() => Math.random()),
  topk: 82,
  outputFields: ["text", "source_file", "biz_modules", "palaces"],
  params: { indexType: 1, ef: 200 },
}) as Array<{ fields?: Record<string, unknown> }>;

// 1. KB_事项宫位知识库 中标记含"健康"的块
console.log("=== KB_事项宫位知识库 中标记含'健康'的块 ===");
let hc = 0;
for (const r of results) {
  const file = String(r.fields?.source_file ?? "");
  if (!file.includes("事项宫位")) continue;
  const tags = (r.fields?.biz_modules ?? []) as string[];
  if (!tags.includes("健康")) continue;
  hc++;
  const text = String(r.fields?.text ?? "");
  const palaces = (r.fields?.palaces ?? []) as string[];
  console.log(`\n健康块 #${hc} | 标签: ${tags.join(",")} | 宫位: ${palaces.join(",")}`);
  console.log(text.slice(0, 200).replace(/\n/g, " "));
}

// 2. SKILL_事项与限运分析 中标记含"健康"的块
console.log("\n\n=== SKILL_事项与限运分析 中标记含'健康'的块 ===");
let sc = 0;
for (const r of results) {
  const file = String(r.fields?.source_file ?? "");
  if (!file.includes("SKILL_事项")) continue;
  const tags = (r.fields?.biz_modules ?? []) as string[];
  if (!tags.includes("健康")) continue;
  sc++;
  const text = String(r.fields?.text ?? "");
  const palaces = (r.fields?.palaces ?? []) as string[];
  console.log(`\n健康块 #${sc} | 标签: ${tags.join(",")} | 宫位: ${palaces.join(",")}`);
  console.log(text.slice(0, 200).replace(/\n/g, " "));
}

// 3. 运势标签泛滥情况
console.log("\n\n=== 各文件标记含'运势'的块数 ===");
const yMap = new Map<string, number>();
for (const r of results) {
  const file = String(r.fields?.source_file ?? "");
  const tags = (r.fields?.biz_modules ?? []) as string[];
  if (tags.includes("运势")) yMap.set(file, (yMap.get(file) ?? 0) + 1);
}
for (const [f, c] of [...yMap.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${f}: ${c}块`);
}

col.closeSync();
prisma.$disconnect();
