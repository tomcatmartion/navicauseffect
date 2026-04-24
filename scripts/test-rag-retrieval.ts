import { PrismaClient } from "@prisma/client";
import { ZVecOpen, ZVecIndexType } from "@zvec/zvec";
import { getEmbeddingConfigForFamily } from "../src/lib/zvec/embedding-config";
import { fetchEmbeddingVector } from "../src/lib/zvec/fetch-embedding";
import { embeddingCollectionDimension } from "../src/lib/zvec/constants";
import { getLogicdocCollectionPath } from "../src/lib/zvec/paths";

const tests: Record<string, { prompt: string; tags: string[] }> = {
  HEALTH: {
    prompt: "请分析命主的健康状况，从疾厄宫出发，结合星曜判断健康隐患",
    tags: ["健康", "always"],
  },
  PARENT_CHILD: {
    prompt: "请分析命主与子女的关系，从子女宫出发，分析亲子互动模式",
    tags: ["亲子", "感情", "互动", "always"],
  },
  MARRIAGE: {
    prompt: "请分析命主的感情婚姻状况，从夫妻宫出发，判断感情模式",
    tags: ["感情", "亲子", "互动", "always"],
  },
};

async function main() {
  const prisma = new PrismaClient();
  const colPath = getLogicdocCollectionPath("1024");
  const col = ZVecOpen(colPath, { readOnly: true });
  const cfg = await getEmbeddingConfigForFamily(prisma, "1024");

  for (const [cat, { prompt, tags }] of Object.entries(tests)) {
    console.log(`\n${"=".repeat(50)}\n${cat}\n${"=".repeat(50)}`);
    const queryText = `【解盘任务】${prompt}\n命主：天相\n命宫主星：天相、天梁`;

    const vector = await fetchEmbeddingVector(cfg, queryText, {
      expectedDimension: embeddingCollectionDimension("1024"),
      callRole: "query",
    });

    const parts = tags.map((t) => `'${t}'`).join(", ");
    const filter = `biz_modules contain_any (${parts})`;
    console.log("过滤:", filter);

    const rows = col.querySync({
      fieldName: "embedding",
      vector,
      topk: 12,
      outputFields: ["source_file", "biz_modules", "palaces", "text"],
      filter,
      params: { indexType: ZVecIndexType.HNSW, ef: 200 },
    });

    console.log(`命中: ${rows.length} 片段\n`);

    // 分类统计
    const bizStats: Record<string, number> = {};
    rows.forEach((r: any) => {
      const bm = String(r.fields?.biz_modules ?? "");
      const label = bm.includes("always") ? "always基础" : bm;
      bizStats[label] = (bizStats[label] || 0) + 1;
    });
    console.log("标签分布:", JSON.stringify(bizStats));

    rows.forEach((r: any, i: number) => {
      const sf = String(r.fields?.source_file ?? "");
      const bm = String(r.fields?.biz_modules ?? "");
      const pal = String(r.fields?.palaces ?? "");
      const preview = String(r.fields?.text ?? "")
        .replace(/\n/g, " ")
        .slice(0, 140);
      console.log(
        `\n  [${i + 1}] ${sf}\n      biz=${bm} | palaces=${pal}`
      );
      console.log(`      ${preview}`);
    });
  }

  col.closeSync();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
