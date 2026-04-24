/**
 * RAG 召回质量全面测试脚本
 * 对全部 7 个 AnalysisCategory 进行详细召回分析，生成与 rag-recall-report.md 类似格式的报告
 *
 * 运行：npx tsx scripts/test-rag-all-recall.ts
 */
import "dotenv/config";
import { AnalysisCategory } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { retrieveLogicdocForAnalysisDetailed } from "../src/lib/rag/logicdoc-retrieval";

// 模拟真实命盘数据（1990-01-15 男命，命中率高）
const astrolabeData: Record<string, unknown> = {
  soul: "紫微",
  body: "天机",
  gender: "MALE",
  solarDate: "1990-01-15",
  lunarDate: "己巳年十二月十九",
  chineseDate: "己巳 丁丑 辛亥 丙寅",
  time: "寅时",
  sign: "摩羯座",
  zodiac: "马",
  fiveElementsClass: "木三局",
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

// 测试用例配置：覆盖全部7个分类
const tests = [
  {
    category: "PERSONALITY" as AnalysisCategory,
    question: "请分析命主的性格特点、为人处世的方式，以及行为模式。",
    userAsk: "请分析我的性格特点，命宫紫微天府坐守，我是什么样的人？",
    expectedKeywords: ["命宫", "性格", "天府", "紫微", "左辅", "天魁"],
    coreFiles: ["SKILL_命主性格定性", "SKILL_宫位原生能级评估"],
  },
  {
    category: "FORTUNE" as AnalysisCategory,
    question: "请分析命主未来十年的大运走势，包括事业、财运、健康各方面的运势变化。",
    userAsk: "我想了解未来十年的整体运势如何？需要注意什么？",
    expectedKeywords: ["大限", "流年", "运势", "事业", "财运", "行运"],
    coreFiles: ["SKILL_事项与限运分析", "KB_事项宫位知识库"],
  },
  {
    category: "MARRIAGE" as AnalysisCategory,
    question: "请分析命主的感情婚姻状况，夫妻宫太阳坐守，未来感情运势如何？",
    userAsk: "我想了解感情婚姻状况，夫妻宫太阳坐守怎么样？",
    expectedKeywords: ["夫妻宫", "感情", "婚姻", "太阳", "桃花", "配偶"],
    coreFiles: ["SKILL_互动关系", "KB_互动关系取象规则", "SKILL_命主性格定性"],
  },
  {
    category: "CAREER" as AnalysisCategory,
    question: "请分析命主的事业职业发展，官禄宫巨门坐守，职场发展需要注意什么？",
    userAsk: "我想了解事业发展状况，工作和职业方面有什么建议？",
    expectedKeywords: ["官禄宫", "事业", "巨门", "工作", "职业", "升职"],
    coreFiles: ["KB_事项宫位知识库", "SKILL_事项与限运分析"],
  },
  {
    category: "HEALTH" as AnalysisCategory,
    question: "请分析命主的健康状况，疾厄宫廉贞七杀同宫，需要注意哪些健康问题？",
    userAsk: "我想了解身体健康状况，疾厄宫廉贞七杀同宫有什么说法？",
    expectedKeywords: ["疾厄宫", "健康", "廉贞", "七杀", "身体", "疾病"],
    coreFiles: ["SKILL_宫位原生能级评估", "KB_事项宫位知识库"],
  },
  {
    category: "PARENT_CHILD" as AnalysisCategory,
    question: "请分析命主与子女的关系，子女宫武曲破军同宫，亲子缘分如何？教育要注意什么？",
    userAsk: "请问亲子关系如何？子女宫武曲破军同宫，与子女的缘分怎样？",
    expectedKeywords: ["子女宫", "亲子", "武曲", "破军", "父母", "教育"],
    coreFiles: ["SKILL_互动关系", "KB_互动关系取象规则", "SKILL_命主性格定性"],
  },
  {
    category: "EMOTION" as AnalysisCategory,
    question: "请分析命主的感情情绪状态，夫妻宫太阳坐守，感情方面容易有哪些困扰？",
    userAsk: "我想了解感情方面的困扰，夫妻宫太阳坐守，情绪和感情要注意什么？",
    expectedKeywords: ["夫妻宫", "感情", "太阳", "情绪", "桃花", "婚姻"],
    coreFiles: ["SKILL_互动关系", "KB_互动关系取象规则", "SKILL_命主性格定性"],
  },
];

interface TestResult {
  category: string;
  passed: boolean;
  score: number;
  coreCoverage: number;
  keywordHitRate: number;
  hits: number;
  totalChars: number;
  topk: number;
  truncated: boolean;
  filterSteps: Array<{ label: string; hitCount: number }>;
  fileDistribution: Array<{ file: string; count: number; isCore: boolean }>;
  missingCores: string[];
  keywordHits: string[];
  keywordMisses: string[];
  firstChunkPreview: string;
  issues: string[];
}

async function runTest(t: typeof tests[0]): Promise<TestResult> {
  const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
    family: "1536",
    category: t.category,
    astrolabeData,
    categoryPrompt: t.question,
    userSupplement: t.userAsk,
    topk: 15,
    maxChars: 14000,
  });

  // 分析文件分布
  const fileDist = new Map<string, number>();
  for (const h of detail.meta.hits) {
    const file = h.sourceFile;
    fileDist.set(file, (fileDist.get(file) ?? 0) + 1);
  }

  const sortedFiles = [...fileDist.entries()].sort((a, b) => b[1] - a[1]);

  // 核心文件覆盖
  const coreFilesFound = t.coreFiles.filter(f =>
    sortedFiles.some(([k]) => k.includes(f))
  );
  const missingCores = t.coreFiles.filter(f =>
    !sortedFiles.some(([k]) => k.includes(f))
  );

  // 关键词命中
  const allText = detail.meta.hits.map(h => h.preview).join(" ");
  const keywordHits = t.expectedKeywords.filter(kw => allText.includes(kw));
  const keywordMisses = t.expectedKeywords.filter(kw => !allText.includes(kw));

  // 综合评分
  const coreCoverage = coreFilesFound.length / t.coreFiles.length;
  const keywordHitRate = keywordHits.length / t.expectedKeywords.length;
  const score = coreCoverage * 50 + keywordHitRate * 50;

  const issues: string[] = [];
  if (missingCores.length > 0) {
    issues.push(`缺少核心文件: ${missingCores.join(", ")}`);
  }
  if (keywordMisses.length > t.expectedKeywords.length * 0.3) {
    issues.push(`关键词命中率较低: ${keywordHits.length}/${t.expectedKeywords.length}`);
  }
  if (detail.meta.totalHits === 0) {
    issues.push("无命中结果");
  }

  const passed = score >= 60 && missingCores.length === 0 && issues.length === 0;

  return {
    category: t.category,
    passed,
    score,
    coreCoverage: coreCoverage * 100,
    keywordHitRate: keywordHitRate * 100,
    hits: detail.meta.totalHits,
    totalChars: detail.meta.totalChars,
    topk: detail.meta.topk,
    truncated: detail.meta.truncated,
    filterSteps: detail.meta.filterSteps,
    fileDistribution: sortedFiles.map(([file, count]) => ({
      file,
      count,
      isCore: t.coreFiles.some(f => file.includes(f)),
    })),
    missingCores,
    keywordHits,
    keywordMisses,
    firstChunkPreview: detail.meta.hits[0]?.preview.slice(0, 150) || "",
    issues,
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("📊 RAG 召回质量全面测试报告");
  console.log(`生成时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  console.log("命盘: 1990-01-15 男命，命宫紫微天府，疾厄宫廉贞七杀");
  console.log("=".repeat(70));

  const results: TestResult[] = [];
  let passCount = 0;
  let failCount = 0;

  for (const t of tests) {
    try {
      const result = await runTest(t);
      results.push(result);

      if (result.passed) {
        passCount++;
        console.log(`\n✅ ${result.category}`);
      } else {
        failCount++;
        console.log(`\n❌ ${result.category}`);
      }
      console.log(`   综合分: ${result.score.toFixed(0)}/100 | 核心文件: ${result.coreCoverage.toFixed(0)}% | 关键词: ${result.keywordHitRate.toFixed(0)}%`);
      console.log(`   命中: ${result.hits}块 | 字数: ${result.totalChars} | topK: ${result.topk}`);

      if (result.issues.length > 0) {
        console.log(`   问题: ${result.issues.join("; ")}`);
      }

      // 文件分布
      const coreFiles = result.fileDistribution.filter(f => f.isCore);
      const otherFiles = result.fileDistribution.filter(f => !f.isCore);
      if (coreFiles.length > 0) {
        console.log(`   核心文件: ${coreFiles.map(f => `${f.file}(${f.count})`).join(", ")}`);
      }
      if (otherFiles.length > 0) {
        console.log(`   其他文件: ${otherFiles.slice(0, 3).map(f => `${f.file}(${f.count})`).join(", ")}${otherFiles.length > 3 ? "..." : ""}`);
      }

    } catch (e) {
      failCount++;
      console.log(`\n❌ ${t.category}: 执行出错 - ${e}`);
    }
  }

  // 汇总
  console.log("\n" + "=".repeat(70));
  console.log("📈 汇总统计");
  console.log("=".repeat(70));
  console.log(`通过: ${passCount}/${tests.length} | 失败: ${failCount}/${tests.length}`);

  // 列出失败项
  const failedResults = results.filter(r => !r.passed);
  if (failedResults.length > 0) {
    console.log("\n⚠️ 需要优化的分类:");
    for (const r of failedResults) {
      console.log(`  - ${r.category}: ${r.issues.join("; ")}`);
    }
  }

  // 过滤链统计
  console.log("\n🔍 各分类过滤链效果:");
  for (const r of results) {
    const steps = r.filterSteps.map(s => `${s.label}(${s.hitCount})`).join(" → ");
    console.log(`  ${r.category}: ${steps}`);
  }

  await prisma.$disconnect();
  console.log("\n测试完成。");
}

main().catch(e => {
  console.error("测试执行失败:", e);
  process.exit(1);
});
