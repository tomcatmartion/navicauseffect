/**
 * 压力测试：模拟 5 个长 chunk 一起打标，检查是否超长度
 * 用法：npx tsx scripts/stress-tagger.ts
 */
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

// 5 段真实长度的 chunk（每段 ~600-800 字）
const CHUNKS = [
  `天同是福星，天生乐观主义，一生安祥，注重生活情趣和精神物质享受，象小孩子一样，较懒散，贪吃贪玩，浪费，喜无拘无束的休闲生活，知足常乐；衣食不缺，但不能发大财（性格的关系，过得去就懒得再动）；一生本主过得愉快，外表不见愁容，但逢空劫则主多幻想。天同入命，多情绪，属意志薄弱者，很保守，与世无争，不为名利权势而争，不会太冲刺，不是很有作为。无论做什么事情都只能做到一定的程度，并不是出类拔萃的人才。原局无煞，喜行七杀的限年以激发。加咸池，本主桃花，但逢天空而无桃花性质，反增精神空虚，心性不定，浮荡虚荣。加八座可增加其仁慈及懒散的性情。命宫天同福星，入庙，八座同宫，落宫帝旺，本主衣禄福寿，可惜逢天空、小耗、伏兵，福气大减，虚名虚利。虽化禄，逢天空反为吉处藏凶，增惰性、精神空虚和事业不利。故命宫本宫不算吉。先天运势不力，但仍不失安闲稳定。天同逢天空，主灵感好，与五术较为有缘。身宫入事业宫，主星天机陷弱，虽化权而无力，更加地劫、寡宿，主凶。天德在此，对富贵无助，只能起到减少灾厄的作用而已，所以本宫应算为凶，尤其事业不利。天同与天机分守身命，很可能从事宗教、艺术工作；逢空劫、空亡，又无禄马吉星来拱，平凡孤独贫寒的一生，多是孤独僧道之命。`,

  `贪狼星以肝胆病和肾病为主，易见肝旺胆虚，肝风抽搐，肝肿腹胀，脾胃不和，惊恐，皮肤病，痔疮，性病，白癣疯，肾脏，早泄，腰痛，尿频，耳呜，气虚目昏，生殖器病，脚的毛病，白带，因肾脏病引发的心脏病。易有疑难杂症，原因不明，不易治愈。加煞忌，有肾病、性病。加羊或陀，易得性病。火星同，痔疮。与羊陀巨杀交并，因酒色致病，或外伤、手术等灾。羊火同，痔漏、肝炎。陀铃同，脓血症。火铃同，胆病，再见天刑天月则主肝病。加桃花星，风流病。会廉贞化忌，男遗精，重者阳痿早泄，女经血多，甚则血崩，若见天虚阴煞天伤更确切。对宫廉贞会，加火星为肝阳上亢，肾水不足。与文曲化忌同宫，眼疾。女命见四煞，头痛眩晕，易得带发炎的经痛或子宫病。庙旺少病。加吉一生平安。加煞，上述病症易发。加煞昌曲，肾脏泌尿系统病，神经痛。失陷，灾病常伴，上述病症易发生，易患神经痛或关节炎。加吉灾病较轻。加煞，上述病症较重，亦易患痔疮、肾亏阳痿、泌尿系统病。加火铃亦易患眼疾。加昌曲擎羊，容易有外伤。加煞再见天刑，开刀手术。`,

  `命身宫坐太阴，失陷，面色白闰，眉清目秀，脸蛋形稍长形而肉薄。太阴失陷，外表文静，内心好动，外表诚实，内里藏奸，孤僻阴沉，多疑，奸猾狡诈，善于阴谋权术。聪明博学，小心谨慎。加文昌，更增其才华谋略。加铃星，更阴沉，但可使失陷阴柔软弱的太阴刚强起来。对宫太阳文曲，虽失陷，但多少能改善太阴阴柔之气，扶起其阳刚之气。加入红鸾大耗，淫荡而喜投机，奢侈浪费，异性缘佳，得女人之助而成功，多感情困扰，会突然间大破败。火局人入辰宫为泄气，但亦属东南木火之方位，不为凶。命身同宫，命运大起大落，一生比较辛劳动荡。命身宫太阴辰宫失陷，太阳戍宫冲照，为日月反背，刑克父母，求谋难遂，离祖求谋较好，男本克妻，但逢太阴化禄，利母不利父，也利妻子，能激发其上进心；财星化禄，虽陷地亦主财源广进；再得铃星助其冲破天罗地网的束缚，变得有谋有勇，权威出众。但单从命宫看，仍属于平常之人。`,

  `太阳在巳守命，太阴在亥冲照，因太阳陷地，不吉，多主事业不利，男女性情不定，喜怒无常，虽有食禄而不能耐久，奔波劳碌。亥宫陷，为人较消极，生活散漫，思虑多，优柔寡断，先勤后懒，人缘差，不合群，一生多是非，辛苦劳碌，成败多端，富贵不耐久，幼年父亲有病灾。出外离祖较好。加吉拱或化吉则变得积极，经奋斗可有成就，主富。化权禄也不美，只宜顾问和守成；三奇佳会则主富贵。加煞，辛劳，孤寡贫穷残疾；逢擎羊，浪费成性；羊陀加桃花星，男女淫邪。甲生人下局，贫贱，发也不耐久。太阳的事业，旺地可在政界、大企业、文化界。适合竞争性强及动性大的行业，如推销、外交、能源、电力、动力、汽车、检察、律师、燃料、电器、经理、主管等。太阳在人，为男人、父、夫、子、政界、老板、经理、主管、律师、服务员。在身体为眼睛、血液循环、心脏、大肠。`,

  `武曲星为财星，入命主人面色青白或青黑，圆长面型，猫眼。性格刚毅勇敢，正直无私，心性淡泊，勤奋努力，有责任心，重信义，处事果断，有冲劲和魄力。但性急，固执，傲慢，多学少成。太阴同宫，有艺术才华，对钱财敏感，善于理财，进财顺利，能成为富有人家。加煞忌，孤克刑伤，因财持刀。武曲入命，一生事业多起伏，钱财来来去去。庙旺，名利双收。落陷，财务纠纷较多，事业多波折。武曲化禄，财运亨通，经商可致富。化权，有权威，事业有成。化科，有名气，得贵人助。化忌，财务损失，事业受挫，纠纷多。武曲在财帛宫，为大吉，一生不缺钱用。在事业宫，适合金融、财经、会计、出纳、银行、证券、保险、贸易、五金、机械等行业。武曲在六亲宫位，主刑克，与六亲缘薄，尤其不利配偶和父亲。加煞忌更凶，恐有生离死别之兆。`,
];

async function main() {
  const modelConfig = await prisma.aIModelConfig.findFirst({
    where: { isActive: true, isDefault: true },
  }) ?? await prisma.aIModelConfig.findFirst({ where: { isActive: true } });

  if (!modelConfig) { console.error("❌ 无 AI 模型"); process.exit(1); }

  console.log(`模型: ${modelConfig.name} (${modelConfig.provider})`);

  const systagPath = path.join(process.cwd(), "sysfiles/systag");
  const systagFiles = (await readdir(systagPath)).filter((f) => f.endsWith(".json"));
  const tagDefs: Array<{ name: string; desc: string; keywords: string[] }> = [];
  for (const file of systagFiles) {
    const raw = await readFile(path.join(systagPath, file), "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.tags)) tagDefs.push(...parsed.tags);
  }

  console.log(`\n=== 输入信息 ===`);
  CHUNKS.forEach((c, i) => console.log(`  Chunk ${i}: ${c.length} 字`));
  console.log(`  总计: ${CHUNKS.reduce((s, c) => s + c.length, 0)} 字`);
  console.log(`  标签定义: ${tagDefs.length} 个`);

  const { createProvider } = await import("../src/lib/ai/index");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = createProvider({
    id: modelConfig.id, name: modelConfig.name, provider: modelConfig.provider,
    apiKey: modelConfig.apiKeyEncrypted, baseUrl: modelConfig.baseUrl, modelId: modelConfig.modelId,
  });

  const modes: Array<"system" | "hybrid" | "auto"> = ["system", "hybrid", "auto"];

  for (const mode of modes) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`${mode.toUpperCase()} 模式 — 5 chunks`);
    console.log(`${"=".repeat(50)}`);

    const startMs = Date.now();
    try {
      const { aiTagChunks } = await import("../src/lib/logicdoc/ai-tagger");
      const tagResult = await aiTagChunks(provider, CHUNKS, mode, tagDefs, ["通用"], (b, t) => {
        console.log(`  批次 ${b}/${t} 完成`);
      });
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

      console.log(`\n耗时: ${elapsed}s`);
      console.log(`结果:`);
      for (let i = 0; i < CHUNKS.length; i++) {
        const tags = tagResult.get(i) ?? ["❌ 无标签"];
        console.log(`  [${i}] (${tags.length} 个) ${tags.join(" | ")}`);
      }
      console.log(`总标签数: ${[...tagResult.values()].reduce((s, t) => s + t.length, 0)}`);
    } catch (e) {
      console.log(`❌ 失败: ${e}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
