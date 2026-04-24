/**
 * 检查 embedding 配置
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const row1536 = await prisma.adminConfig.findUnique({
    where: { configKey: "embedding_config_dim1536" }
  });
  const row1024 = await prisma.adminConfig.findUnique({
    where: { configKey: "embedding_config_dim1024" }
  });

  console.log("1536 维 embedding 配置:");
  if (row1536) {
    console.log("  configValue:", row1536.configValue);
  } else {
    console.log("  无配置");
  }

  console.log("\n1024 维 embedding 配置:");
  if (row1024) {
    console.log("  configValue:", row1024.configValue);
  } else {
    console.log("  无配置");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
