/**
 * 调试 PARENT_CHILD 检索问题
 * 分析为什么"子女宫"等关键词零命中
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  retrieveLogicdocForAnalysisDetailed,
  buildRagQueryText,
  buildRagQueryVariants,
} from "../src/lib/rag/logicdoc-retrieval";
import { AnalysisCategory } from "@prisma/client";

const astrolabeData: Record<string, unknown> = {
  soul: "紫微",
  body: "天机",
  gender: "MALE",
  solarDate: "1990-01-15",
  palaces: [
    { name: "命宫", majorStars: [{ name: "紫微" }, { name: "天府" }] },
    { name: "子女宫", majorStars: [{ name: "武曲" }, { name: "破军" }] },
    { name: "夫妻宫", majorStars: [{ name: "太阳" }] },
    { name: "疾厄宫", majorStars: [{ name: "廉贞" }, { name: "七杀" }] },
  ],
};

async function main() {
  const category: AnalysisCategory = "PARENT_CHILD";
  const question = "请问亲子关系如何？子女宫武曲破军同宫，与子女的缘分怎样？";
  const categoryPrompt = "请分析命主与子女的关系，子女宫武曲破军同宫，亲子缘分如何？教育要注意什么？";

  console.log("🔍 PARENT_CHILD 检索调试\n");

  // 1. 查看构建的检索 query
  console.log("=== 构建的检索 Query ===\n");
  const singleQuery = buildRagQueryText(category, categoryPrompt, astrolabeData, undefined, question);
  console.log("主 Query:");
  console.log(singleQuery.slice(0, 500));
  console.log("\n---\n");

  const variants = buildRagQueryVariants(category, categoryPrompt, astrolabeData, undefined, question);
  console.log(`共 ${variants.length} 个 Query 变体:\n`);
  for (let i = 0; i < variants.length; i++) {
    console.log(`变体 ${i + 1} (${variants[i].length}字):`);
    console.log(variants[i].slice(0, 300));
    console.log("\n");
  }

  // 2. 检查"子女宫"这个词是否在 query 中
  console.log("=== 关键词检查 ===");
  console.log(`"子女宫" 在 query 中: ${singleQuery.includes("子女宫")}`);
  console.log(`"亲子" 在 query 中: ${singleQuery.includes("亲子")}`);
  console.log(`"子女" 在 query 中: ${singleQuery.includes("子女")}`);
  console.log(`"教育" 在 query 中: ${singleQuery.includes("教育")}`);

  // 3. 查看 CATEGORY_QUERY_ENHANCE 配置
  console.log("\n=== CATEGORY_QUERY_ENHANCE ===");
  const enhance = ["亲子", "感情", "互动", "性格", "通用", "always"];
  console.log(`PARENT_CHILD 配置: ${enhance.join(", ")}`);
  console.log("问题: '子女宫'、'教育' 不在增强词中！");

  // 4. 直接检索测试
  console.log("\n=== 直接向量检索测试 ===");

  // 不带任何过滤的检索
  const noFilter = await retrieveLogicdocForAnalysisDetailed(prisma, {
    family: "1536",
    category,
    astrolabeData,
    categoryPrompt,
    userSupplement: question,
    topk: 5,
    maxChars: 5000,
  });

  console.log("\n无过滤 top5 命中:");
  for (const h of noFilter.meta.hits.slice(0, 5)) {
    console.log(`  - ${h.sourceFile} (${h.textLength}字)`);
    console.log(`    预览: ${h.preview.slice(0, 100)}...`);
  }

  // 检查命中内容是否包含"子女宫"
  const allText = noFilter.knowledgeText;
  console.log(`\n无过滤结果中 "子女宫" 出现: ${(allText.match(/子女宫/g) || []).length} 次`);
  console.log(`无过滤结果中 "亲子" 出现: ${(allText.match(/亲子/g) || []).length} 次`);
  console.log(`无过滤结果中 "子女" 出现: ${(allText.match(/子女/g) || []).length} 次`);

  await prisma.$disconnect();
}

main().catch(console.error);
