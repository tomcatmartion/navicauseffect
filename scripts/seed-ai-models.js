/**
 * 大模型配置说明（与 MiniMax / 智谱一致）：
 * - 密钥、baseUrl、modelId 只应保存在数据库表 **ai_model_configs**（管理后台「AI 模型」/admin/models）。
 * - 本脚本不再从环境变量读取或写入任何 API Key，避免密钥出现在配置文件或部署环境里。
 *
 * install.sh 仍会调用本脚本：仅打印提示后正常退出。
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const n = await prisma.aIModelConfig.count();
  console.log(
    n > 0
      ? `  当前库中已有 ${n} 条 AI 模型配置（来自管理后台或历史数据），未做变更。`
      : "  库中尚无 AI 模型配置：请登录管理后台「AI 模型」(/admin/models) 添加 MiniMax / 智谱 / DeepSeek 等并填写密钥。",
  );
  console.log("\n✓ seed-ai-models.js 完成（密钥仅存 ai_model_configs，勿写 .env）");
}

main()
  .catch((e) => {
    console.error("执行失败:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
