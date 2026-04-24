/**
 * 端到端：7 个 AnalysisCategory 各调用一次 retrieveLogicdocForAnalysis，
 * 校验返回非「向量库无匹配片段」占位文案（需 DATABASE_URL、已配置的 embedding、已建 Zvec 索引）。
 *
 * 运行：npx tsx scripts/test-rag-all-categories.ts
 * 可选：`RAG_TEST_FAMILY=1024` 测 1024 维 collection。
 */
import "dotenv/config";
import { AnalysisCategory } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { retrieveLogicdocForAnalysis } from "../src/lib/rag/logicdoc-retrieval";
import type { EmbeddingDimensionFamily } from "../src/lib/zvec/constants";

const PLACEHOLDER = "向量库无匹配片段";

const mockAstrolabe: Record<string, unknown> = {
  soul: "紫微",
  body: "天机",
  gender: "MALE",
  solarDate: "1990-01-01",
  palaces: [
    { name: "命宫", majorStars: [{ name: "紫微" }, { name: "天府" }] },
    { name: "财帛宫", majorStars: [{ name: "武曲" }] },
    { name: "官禄宫", majorStars: [{ name: "太阳" }] },
  ],
};

async function main() {
  const family = (process.env.RAG_TEST_FAMILY?.trim() as EmbeddingDimensionFamily) || "1536";
  if (family !== "1536" && family !== "1024") {
    console.error("RAG_TEST_FAMILY 须为 1536 或 1024");
    process.exitCode = 1;
    return;
  }

  const categories = Object.values(AnalysisCategory);
  const failures: string[] = [];

  for (const category of categories) {
    const knowledge = await retrieveLogicdocForAnalysis(prisma, {
      family,
      category,
      astrolabeData: mockAstrolabe,
      categoryPrompt: `【自测】${category} 模块解盘任务说明（事业财运/感情等关键词混合）`,
      userSupplement: "请结合命宫与相关宫位简要分析。",
    });
    const bad = knowledge.includes(PLACEHOLDER) || knowledge.trim().length < 80;
    if (bad) {
      failures.push(category);
      console.log(`❌ ${category} len=${knowledge.length} preview=${knowledge.slice(0, 120)}`);
    } else {
      console.log(`✅ ${category} len=${knowledge.length} head=${knowledge.slice(0, 60).replace(/\n/g, " ")}…`);
    }
  }

  await prisma.$disconnect();

  if (failures.length) {
    console.error(`\n未通过: ${failures.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("\n全部 7 个分类 RAG 返回均含有效片段。");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
