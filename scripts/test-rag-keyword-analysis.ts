/**
 * RAG 关键词命中率深入分析
 * 检查最终 knowledgeText（完整内容）中的关键词覆盖情况
 */
import "dotenv/config";
import { AnalysisCategory } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { retrieveLogicdocForAnalysisDetailed } from "../src/lib/rag/logicdoc-retrieval";

const astrolabeData: Record<string, unknown> = {
  soul: "紫微",
  body: "天机",
  gender: "MALE",
  solarDate: "1990-01-15",
  lunarDate: "己巳年十二月十九",
  palaces: [
    { name: "命宫", majorStars: [{ name: "紫微" }, { name: "天府" }] },
    { name: "夫妻宫", majorStars: [{ name: "太阳" }] },
    { name: "子女宫", majorStars: [{ name: "武曲" }, { name: "破军" }] },
    { name: "疾厄宫", majorStars: [{ name: "廉贞" }, { name: "七杀" }] },
    { name: "财帛宫", majorStars: [{ name: "天同" }] },
    { name: "官禄宫", majorStars: [{ name: "巨门" }] },
  ],
};

// 全部7个分类的完整测试
const tests = [
  {
    category: "PERSONALITY" as AnalysisCategory,
    question: "请分析命主的性格特点、为人处世的方式，以及行为模式。",
    userAsk: "请分析我的性格特点，命宫紫微天府坐守，我是什么样的人？",
    expectedKeywords: ["命宫", "性格", "天府", "紫微", "左辅", "天魁", "为人", "行为模式"],
  },
  {
    category: "FORTUNE" as AnalysisCategory,
    question: "请分析命主未来十年的大运走势，包括事业、财运、健康各方面的运势变化。",
    userAsk: "我想了解未来十年的整体运势如何？需要注意什么？",
    expectedKeywords: ["大限", "流年", "运势", "事业", "财运", "行运", "十年"],
  },
  {
    category: "MARRIAGE" as AnalysisCategory,
    question: "请分析命主的感情婚姻状况，夫妻宫太阳坐守，未来感情运势如何？",
    userAsk: "我想了解感情婚姻状况，夫妻宫太阳坐守怎么样？",
    expectedKeywords: ["夫妻宫", "感情", "婚姻", "太阳", "桃花", "配偶", "伴侣"],
  },
  {
    category: "CAREER" as AnalysisCategory,
    question: "请分析命主的事业职业发展，官禄宫巨门坐守，职场发展需要注意什么？",
    userAsk: "我想了解事业发展状况，工作和职业方面有什么建议？",
    expectedKeywords: ["官禄宫", "事业", "巨门", "工作", "职业", "升职", "跳槽"],
  },
  {
    category: "HEALTH" as AnalysisCategory,
    question: "请分析命主的健康状况，疾厄宫廉贞七杀同宫，需要注意哪些健康问题？",
    userAsk: "我想了解身体健康状况，疾厄宫廉贞七杀同宫有什么说法？",
    expectedKeywords: ["疾厄宫", "健康", "廉贞", "七杀", "身体", "疾病", "养生"],
  },
  {
    category: "PARENT_CHILD" as AnalysisCategory,
    question: "请分析命主与子女的关系，子女宫武曲破军同宫，亲子缘分如何？教育要注意什么？",
    userAsk: "请问亲子关系如何？子女宫武曲破军同宫，与子女的缘分怎样？",
    expectedKeywords: ["子女宫", "亲子", "武曲", "破军", "父母", "教育", "子女"],
  },
  {
    category: "EMOTION" as AnalysisCategory,
    question: "请分析命主的感情情绪状态，夫妻宫太阳坐守，感情方面容易有哪些困扰？",
    userAsk: "我想了解感情方面的困扰，夫妻宫太阳坐守，情绪和感情要注意什么？",
    expectedKeywords: ["夫妻宫", "感情", "太阳", "情绪", "桃花", "婚姻", "伴侣"],
  },
];

async function main() {
  console.log("🔍 RAG 关键词命中深入分析\n");

  for (const t of tests) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`📋 ${t.category}`);
    console.log(`问: ${t.userAsk.slice(0, 40)}...`);
    console.log(`─`.repeat(60));

    const detail = await retrieveLogicdocForAnalysisDetailed(prisma, {
      family: "1536",
      category: t.category,
      astrolabeData,
      categoryPrompt: t.question,
      userSupplement: t.userAsk,
      topk: 15,
      maxChars: 14000,
    });

    // 在完整 knowledgeText 中检查关键词
    const knowledgeText = detail.knowledgeText;
    const results: { kw: string; hit: boolean; count: number; sample?: string }[] = [];

    for (const kw of t.expectedKeywords) {
      const regex = new RegExp(kw, 'g');
      const matches = knowledgeText.match(regex);
      const count = matches ? matches.length : 0;
      results.push({
        kw,
        hit: count > 0,
        count,
      });
    }

    const hitCount = results.filter(r => r.hit).length;
    console.log(`\n关键词命中: ${hitCount}/${t.expectedKeywords.length}`);
    for (const r of results) {
      const icon = r.hit ? "✅" : "❌";
      console.log(`  ${icon} "${r.kw}" 出现 ${r.count} 次`);
    }

    // 检查星曜名是否在知识文本中（这些是关键实体的）
    const palaceStars = ["紫微", "天府", "太阳", "武曲", "破军", "廉贞", "七杀", "巨门", "天同"];
    console.log(`\n星曜覆盖:`);
    for (const star of palaceStars) {
      const count = (knowledgeText.match(new RegExp(star, 'g')) || []).length;
      if (count > 0) {
        console.log(`  ✅ ${star} × ${count}`);
      }
    }

    // 文件分布
    const fileHits = new Map<string, number>();
    for (const h of detail.meta.hits) {
      const prev = fileHits.get(h.sourceFile) || 0;
      fileHits.set(h.sourceFile, prev + 1);
    }
    console.log(`\n文件分布 (${detail.meta.totalHits}块):`);
    for (const [file, count] of [...fileHits.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${file}: ${count}块`);
    }

    // 字数统计
    console.log(`\n字数: ${knowledgeText.length} / ${detail.meta.totalChars}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
