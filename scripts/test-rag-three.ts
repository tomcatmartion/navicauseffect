/**
 * RAG 召回验证脚本：身体健康 / 亲子关系 / 感情婚姻
 * 输出每个问题的召回报告：命中文件分布、块内容预览、覆盖评估
 */
import "dotenv/config";
import { AnalysisCategory } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { retrieveLogicdocForAnalysisDetailed } from "../src/lib/rag/logicdoc-retrieval";

// 模拟一个真实的命盘数据
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

// 三个测试问题
const tests = [
  {
    category: "HEALTH" as AnalysisCategory,
    question: "我想了解身体健康状况，疾厄宫廉贞七杀同宫有什么说法，需要注意哪些健康问题？",
    expectedKeywords: ["疾厄", "健康", "身体", "疾病", "凶格", "凶限", "廉贞"],
    coreFiles: ["SKILL_事项与限运分析", "KB_事项宫位知识库", "SKILL_宫位原生能级评估"],
    unwantedFiles: ["KB_互动关系取象规则", "SKILL_互动关系"],
  },
  {
    category: "PARENT_CHILD" as AnalysisCategory,
    question: "请问亲子关系如何？子女宫武曲破军同宫，与子女的缘分怎样？教育方面要注意什么？",
    expectedKeywords: ["子女", "亲子", "父母", "家庭", "入卦", "互动"],
    coreFiles: ["SKILL_互动关系", "KB_互动关系取象规则"],
    unwantedFiles: [],
  },
  {
    category: "MARRIAGE" as AnalysisCategory,
    question: "我想了解感情婚姻状况，夫妻宫太阳坐守怎么样？未来感情运如何？",
    expectedKeywords: ["感情", "婚姻", "夫妻", "桃花", "入卦", "互动"],
    coreFiles: ["SKILL_互动关系", "KB_互动关系取象规则"],
    unwantedFiles: [],
  },
];

async function main() {
  let allPassed = true;

  for (const t of tests) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`📋 ${t.category}：「${t.question.slice(0, 30)}…」`);
    console.log(`${"═".repeat(60)}`);

    const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
      family: "1536",
      category: t.category,
      astrolabeData,
      categoryPrompt: t.question,
      userSupplement: t.question,
    });

    // 过滤链
    console.log(`\n🔍 过滤链：${detail.meta.filterSteps.map(s => `${s.label}(${s.hitCount})`).join(" → ")}`);

    // 文件分布（不含邻接块）
    const mainHits = detail.meta.hits.filter(h => h.textLength > 500);
    const neighborHits = detail.meta.hits.filter(h => h.textLength <= 500);
    const fileDist = new Map<string, number>();
    for (const h of mainHits) {
      fileDist.set(h.sourceFile, (fileDist.get(h.sourceFile) ?? 0) + 1);
    }

    console.log(`\n📂 主要块文件分布（共${mainHits.length}块，邻接块${neighborHits.length}块）：`);
    const sortedFiles = [...fileDist.entries()].sort((a, b) => b[1] - a[1]);
    for (const [file, count] of sortedFiles) {
      const isCore = t.coreFiles.some(f => file.includes(f));
      const isUnwanted = t.unwantedFiles.some(f => file.includes(f));
      const icon = isUnwanted ? "❌" : isCore ? "✅" : "➖";
      console.log(`  ${icon} ${file} × ${count}`);
    }

    // 核心文件覆盖检查
    const missingCores = t.coreFiles.filter(
      f => ![...fileDist.keys()].some(k => k.includes(f))
    );
    if (missingCores.length) {
      console.log(`\n⚠️ 缺少核心文件：${missingCores.join(", ")}`);
      allPassed = false;
    }

    // 不需要的文件检查
    const unwantedPresent = t.unwantedFiles.filter(
      f => [...fileDist.keys()].some(k => k.includes(f))
    );
    if (unwantedPresent.length) {
      console.log(`\n⚠️ 出现不应有的文件：${unwantedPresent.join(", ")}`);
      allPassed = false;
    }

    // 关键词命中检查
    const allText = detail.meta.hits.map(h => h.preview).join(" ");
    const keywordHits = t.expectedKeywords.filter(kw => allText.includes(kw));
    const keywordMisses = t.expectedKeywords.filter(kw => !allText.includes(kw));
    console.log(`\n🏷️ 关键词命中：${keywordHits.length}/${t.expectedKeywords.length}`);
    if (keywordMisses.length) {
      console.log(`  未命中：${keywordMisses.join(", ")}`);
    }

    // 前3块预览
    console.log(`\n📄 前3块内容预览：`);
    for (const h of mainHits.slice(0, 3)) {
      console.log(`  ── [${h.sourceFile}] (len=${h.textLength})`);
      console.log(`  ${h.preview.slice(0, 100).replace(/\n/g, " ")}…`);
    }

    // 总结
    const coreCoverage = t.coreFiles.filter(f => [...fileDist.keys()].some(k => k.includes(f))).length;
    const score = (coreCoverage / t.coreFiles.length) * 50 +
                  (keywordHits.length / t.expectedKeywords.length) * 50;
    const pass = score >= 60 && missingCores.length === 0 && unwantedPresent.length === 0;
    console.log(`\n${pass ? "✅ 通过" : "❌ 未通过"} — 核心文件覆盖 ${coreCoverage}/${t.coreFiles.length}，关键词命中 ${keywordHits.length}/${t.expectedKeywords.length}，综合分 ${score.toFixed(0)}`);

    if (!pass) allPassed = false;
  }

  await prisma.$disconnect();

  console.log(`\n${"═".repeat(60)}`);
  console.log(allPassed ? "🎉 三个问题全部通过验证！" : "⚠️ 存在未通过的问题，需要进一步优化");
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
