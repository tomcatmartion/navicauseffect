/**
 * 查询当前激活的 AI 模型
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const configs = await prisma.aiModelConfig.findMany({
    where: { isActive: true },
    select: { provider: true, modelId: true, isDefault: true }
  });
  console.log('Active AI models:');
  for (const c of configs) {
    const defaultMark = c.isDefault ? ' [DEFAULT]' : '';
    console.log(`  Provider: ${c.provider}, Model: ${c.modelId}${defaultMark}`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
