/**
 * 导出三个问题的完整召回切片内容到 Markdown 文件
 */
import "dotenv/config";
import { AnalysisCategory } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { retrieveLogicdocForAnalysisDetailed } from "../src/lib/rag/logicdoc-retrieval";
import { writeFileSync } from "fs";

const astrolabeData: Record<string, unknown> = {
  soul: "紫微",
  body: "天机",
  gender: "MALE",
  solarDate: "1990-01-15",
  lunarDate: "己巳年十二月十九",
  palaces: [
    { name: "命宫", majorStars: [{ name: "紫微" }, { name: "天府" }], minorStars: [{ name: "左辅" }, { name: "天魁" }] },
    { name: "兄弟宫", majorStars: [{ name: "天机" }], minorStars: [{ name: "擎羊" }] },
    { name: "夫妻宫", majorStars: [{ name: "太阳" }], minorStars: [{ name: "天马" }] },
    { name: "子女宫", majorStars: [{ name: "武曲" }, { name: "破军" }], minorStars: [] },
    { name: "财帛宫", majorStars: [{ name: "天同" }], minorStars: [{ name: "禄存" }] },
    { name: "疾厄宫", majorStars: [{ name: "廉贞" }, { name: "七杀" }], minorStars: [{ name: "陀罗" }] },
    { name: "迁移宫", majorStars: [{ name: "太阴" }], minorStars: [{ name: "火星" }] },
    { name: "交友宫", majorStars: [{ name: "贪狼" }], minorStars: [{ name: "铃星" }] },
    { name: "官禄宫", majorStars: [{ name: "巨门" }], minorStars: [{ name: "文曲" }] },
    { name: "田宅宫", majorStars: [{ name: "天相" }], minorStars: [] },
    { name: "福德宫", majorStars: [{ name: "天梁" }], minorStars: [{ name: "天钺" }] },
    { name: "父母宫", majorStars: [{ name: "天同" }], minorStars: [{ name: "右弼" }] },
  ],
};

const tests = [
  {
    category: "HEALTH" as AnalysisCategory,
    title: "身体健康",
    question: "我想了解身体健康状况，疾厄宫廉贞七杀同宫有什么说法，需要注意哪些健康问题？",
  },
  {
    category: "PARENT_CHILD" as AnalysisCategory,
    title: "亲子关系",
    question: "请问亲子关系如何？子女宫武曲破军同宫，与子女的缘分怎样？教育方面要注意什么？",
  },
  {
    category: "MARRIAGE" as AnalysisCategory,
    title: "感情婚姻",
    question: "我想了解感情婚姻状况，夫妻宫太阳坐守怎么样？未来感情运如何？",
  },
];

async function main() {
  const sections: string[] = [];

  sections.push(`# RAG 召回切片内容报告`);
  sections.push(`\n> 生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  sections.push(`> 命盘：1990-01-15 男命，命宫紫微天府，疾厄宫廉贞七杀，子女宫武曲破军，夫妻宫太阳`);

  for (const t of tests) {
    console.log(`正在检索：${t.title}...`);

    const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
      family: "1536",
      category: t.category,
      astrolabeData,
      categoryPrompt: t.question,
      userSupplement: t.question,
    });

    sections.push(`\n---\n`);
    sections.push(`## ${t.title}（${t.category}）`);
    sections.push(`\n**用户问题**：${t.question}`);
    sections.push(`\n**过滤链**：${detail.meta.filterSteps.map(s => `${s.label}(${s.hitCount})`).join(" → ")}`);
    sections.push(`\n**命中**：${detail.meta.totalHits} 块，总字数 ${detail.meta.totalChars}，topK=${detail.meta.topk}，截断=${detail.meta.truncated}`);

    // 文件分布统计
    const fileDist = new Map<string, { count: number; mainCount: number }>();
    for (const h of detail.meta.hits) {
      if (!fileDist.has(h.sourceFile)) fileDist.set(h.sourceFile, { count: 0, mainCount: 0 });
      const stat = fileDist.get(h.sourceFile)!;
      stat.count++;
      if (h.textLength > 500) stat.mainCount++;
    }
    sections.push(`\n**文件分布**：`);
    sections.push(`\n| 文件 | 主要块 | 含邻接块 |`);
    sections.push(`|------|--------|----------|`);
    for (const [file, stat] of [...fileDist.entries()].sort((a, b) => b[1].mainCount - a[1].mainCount)) {
      sections.push(`| ${file} | ${stat.mainCount} | ${stat.count} |`);
    }

    // 完整切片内容
    sections.push(`\n### 召回切片详情\n`);
    for (const h of detail.meta.hits) {
      const isNeighbor = h.textLength <= 500;
      sections.push(`#### 片段 #${h.index} — ${h.sourceFile}${isNeighbor ? " （邻接上下文）" : ""}`);
      sections.push(`\n\`\`\``);
      sections.push(h.preview);
      sections.push(`\`\`\`\n`);
    }
  }

  await prisma.$disconnect();

  const outPath = "planfiles/rag-recall-report.md";
  writeFileSync(outPath, sections.join("\n"), "utf-8");
  console.log(`\n✅ 已输出到 ${outPath}`);
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
