/**
 * 诊断脚本：测试 AI 打标三种模式
 * 用法：npx tsx scripts/diagnose-tagger.ts
 */
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

// 用户提供的两段测试文本
const TEST_TEXTS = [
  {
    label: "第一段（健康疾病/贪狼星）",
    text: `陷地有暗疾，性病，妇科病，加煞病重，阴虚阳亏，易有四肢伤残。化权，庙旺病少，陷地轻的糖尿病，水肿，风湿，女月经不调。化科，有病易得良医，庙旺病少；陷地亦易有病，男主痨伤，女主妇科病。化忌，忧郁症，失眠，肾病，膀胱病，糖尿病，尿频。加天虚龙池，晚年重听或耳聋。贪狼星以肝胆病和肾病为主，易见肝旺胆虚，肝风抽搐，肝肿腹胀，脾胃不和，惊恐，皮肤病，痔疮，性病，白癣疯，肾脏，早泄，腰痛，尿频，耳呜，气虚目昏，生殖器病，脚的毛病，白带，因肾脏病引发的心脏病。易有疑难杂症，原因不明，不易治愈。加煞忌，有肾病、性病。加羊或陀，易得性病。火星同，痔疮。与羊陀巨杀交并，因酒色致病，或外伤、手术等灾。`,
  },
  {
    label: "第二段（命例分析/蒋介石）",
    text: `是年必有奇灾大祸，甚则夭折。命例推演，蒋介石的命运分析。命身宫坐太阴，失陷，面色白闰，眉清目秀，脸蛋形稍长形而肉薄。太阴失陷，外表文静，内心好动，外表诚实，内里藏奸，孤僻阴沉，多疑，奸猾狡诈，善于阴谋权术。聪明博学，小心谨慎。加文昌，更增其才华谋略。加铃星，更阴沉，但可使失陷阴柔软弱的太阴刚强起来。对宫太阳文曲，虽失陷，但多少能改善太阴阴柔之气，扶起其阳刚之气。加入红鸾大耗，淫荡而喜投机，奢侈浪费，异性缘佳，得女人之助而成功，多感情困扰，会突然间大破败。先天命数：火局人入辰宫为泄气。命身同宫，命运大起大落，一生比较辛劳动荡。命身宫太阴辰宫失陷，太阳戍宫冲照，为日月反背，刑克父母，求谋难遂，离祖求谋较好，男本克妻。命身宫三方组成科权禄三奇佳会富贵格局，亦为机月同梁格，无凶煞破格，为上等星格。`,
  },
];

async function main() {
  const modelConfig = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  }) ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });

  if (!modelConfig) {
    console.error("❌ 无可用 AI 模型");
    process.exit(1);
  }

  console.log(`模型: ${modelConfig.name} (${modelConfig.provider}/${modelConfig.modelId})`);

  // 加载 systag
  const systagPath = path.join(process.cwd(), "sysfiles/systag");
  const systagFiles = (await readdir(systagPath)).filter((f) => f.endsWith(".json"));
  const tagDefs: Array<{ name: string; desc: string; keywords: string[] }> = [];
  for (const file of systagFiles) {
    const raw = await readFile(path.join(systagPath, file), "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.tags)) tagDefs.push(...parsed.tags);
  }
  console.log(`标签: ${tagDefs.length} 个 → ${tagDefs.map((t) => t.name).join(", ")}`);

  const { createProvider } = await import("../src/lib/ai/index");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = createProvider({
    id: modelConfig.id,
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKeyEncrypted,
    baseUrl: modelConfig.baseUrl,
    modelId: modelConfig.modelId,
  });

  const modes: Array<"system" | "hybrid" | "auto"> = ["system", "hybrid", "auto"];

  for (const testText of TEST_TEXTS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📌 ${testText.label}`);
    console.log(`文本长度: ${testText.text.length} 字`);
    console.log(`${"=".repeat(60)}`);

    for (const mode of modes) {
      console.log(`\n--- ${mode.toUpperCase()} 模式 ---`);

      try {
        // 直接调用 aiTagChunks，和正式代码一致
        const { aiTagChunks } = await import("../src/lib/logicdoc/ai-tagger");
        const tagResult = await aiTagChunks(provider, [testText.text], mode, tagDefs, ["通用"]);

        const tags = tagResult.get(0) ?? [];
        console.log(`标签 (${tags.length} 个): ${tags.join(" | ")}`);
      } catch (e) {
        console.log(`❌ 失败: ${e}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
