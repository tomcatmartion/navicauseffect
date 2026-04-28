/**
 * 初始化 AI 模型配置。
 * 首次部署时由 install.sh 调用，或手动执行：node scripts/seed-ai-models.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MODELS = [
  {
    id: "seed-minimax-default",
    name: "MiniMax-M2.5",
    provider: "minimax",
    apiKeyEncrypted: process.env.MINIMAX_API_KEY || "",
    baseUrl: "https://api.minimaxi.com/v1",
    modelId: "MiniMax-M2.5",
    isActive: true,
    isDefault: true,
  },
  {
    id: "seed-deepseek",
    name: "DeepSeek Chat",
    provider: "deepseek",
    apiKeyEncrypted: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: "https://api.deepseek.com/v1",
    modelId: "deepseek-chat",
    isActive: false,
    isDefault: false,
  },
  {
    id: "seed-zhipu",
    name: "智谱 GLM-4",
    provider: "zhipu",
    apiKeyEncrypted: process.env.ZHIPU_API_KEY || "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    modelId: "glm-4.7",
    isActive: false,
    isDefault: false,
  },
  {
    id: "seed-qwen",
    name: "通义千问",
    provider: "qwen",
    apiKeyEncrypted: process.env.QWEN_API_KEY || "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen-plus",
    isActive: false,
    isDefault: false,
  },
  {
    id: "seed-claude",
    name: "Claude",
    provider: "claude",
    apiKeyEncrypted: process.env.CLAUDE_API_KEY || "",
    baseUrl: "https://api.anthropic.com",
    modelId: "claude-sonnet-4-20250514",
    isActive: false,
    isDefault: false,
  },
];

async function main() {
  for (const model of MODELS) {
    // 跳过没有 API Key 的模型
    if (!model.apiKeyEncrypted) {
      console.log(`  跳过 ${model.name}（未配置 API Key）`);
      continue;
    }
    await prisma.aIModelConfig.upsert({
      where: { id: model.id },
      update: {},
      create: model,
    });
    const status = model.isActive ? "✓ 已激活（默认）" : "  已添加";
    console.log(`  ${status} ${model.name} (${model.provider}/${model.modelId})`);
  }
  console.log("\n✓ AI 模型配置完成");
}

main()
  .catch((e) => {
    console.error("初始化失败:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
