/**
 * 自测：Embedding 管理端配置读写与 readPrevApiKey 解析（与 /api/admin/embedding-config 同源逻辑）
 * 运行: npx tsx scripts/test-embedding-config-persist.ts
 */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  EMBEDDING_CONFIG_KEY_1024,
  EMBEDDING_CONFIG_KEY_1536,
} from "../src/lib/zvec/constants";
import {
  getEmbeddingConfigStoredShape,
  readPrevApiKeyFromStoredJson,
  readPrevEmbeddingFieldsFromStoredJson,
} from "../src/lib/zvec/embedding-config";

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ 未设置 DATABASE_URL，跳过 DB 轮次");
    process.exit(1);
  }

  // 1) 纯函数：Json 以字符串形式返回时仍能读到 apiKey
  const strPayload = JSON.stringify({
    apiKey: "key-from-string-json",
    baseUrl: "https://api.example/v1",
    modelId: "m",
  });
  assert(
    readPrevApiKeyFromStoredJson(strPayload) === "key-from-string-json",
    "readPrevApiKeyFromStoredJson(string JSON)"
  );
  assert(
    readPrevApiKeyFromStoredJson(JSON.parse(strPayload) as object) ===
      "key-from-string-json",
    "readPrevApiKeyFromStoredJson(object)"
  );
  assert(
    readPrevApiKeyFromStoredJson({ api_key: "snake" }) === "snake",
    "readPrev api_key snake_case"
  );
  const full = readPrevEmbeddingFieldsFromStoredJson(
    JSON.stringify({
      base_url: "https://u",
      model_id: "mid",
      apiKey: "k",
    })
  );
  assert(
    full.baseUrl === "https://u" && full.modelId === "mid" && full.groupId === "",
    "readPrev fields"
  );
  assert(
    readPrevEmbeddingFieldsFromStoredJson(
      JSON.stringify({ baseUrl: "a", modelId: "m", apiKey: "k", group_id: "g1" })
    ).groupId === "g1",
    "readPrev group_id snake"
  );
  console.log("✅ readPrevApiKey / readPrevEmbeddingFields 单元断言通过");

  // 2) DB：写入 → getEmbeddingConfigStoredShape → 再读行合并 Key
  const snap1536 = await prisma.adminConfig.findUnique({
    where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
  });
  const snap1024 = await prisma.adminConfig.findUnique({
    where: { configKey: EMBEDDING_CONFIG_KEY_1024 },
  });

  const test1536 = {
    baseUrl: "https://persist-test-1536.local/v1",
    modelId: "persist-model-1536",
    apiKey: "persist-secret-1536",
    groupId: "persist-group-1536",
  };
  const test1024 = {
    baseUrl: "https://persist-test-1024.local/v1",
    modelId: "persist-model-1024",
    apiKey: "persist-secret-1024",
    groupId: "",
  };

  await prisma.$transaction([
    prisma.adminConfig.upsert({
      where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
      create: {
        configKey: EMBEDDING_CONFIG_KEY_1536,
        configValue: test1536,
      },
      update: { configValue: test1536 },
    }),
    prisma.adminConfig.upsert({
      where: { configKey: EMBEDDING_CONFIG_KEY_1024 },
      create: {
        configKey: EMBEDDING_CONFIG_KEY_1024,
        configValue: test1024,
      },
      update: { configValue: test1024 },
    }),
  ]);

  const shape1536 = await getEmbeddingConfigStoredShape(prisma, "1536");
  const shape1024 = await getEmbeddingConfigStoredShape(prisma, "1024");
  assert(shape1536?.baseUrl === test1536.baseUrl, "shape1536.baseUrl");
  assert(shape1536?.modelId === test1536.modelId, "shape1536.modelId");
  assert(shape1536?.hasApiKey === true, "shape1536.hasApiKey");
  assert(shape1536?.groupId === test1536.groupId, "shape1536.groupId");
  assert(shape1024?.baseUrl === test1024.baseUrl, "shape1024.baseUrl");
  assert(shape1024?.hasApiKey === true, "shape1024.hasApiKey");
  assert(shape1024?.groupId === "", "shape1024.groupId");
  console.log("✅ getEmbeddingConfigStoredShape 与库一致");

  const row1536 = await prisma.adminConfig.findUnique({
    where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
  });
  assert(
    readPrevApiKeyFromStoredJson(row1536?.configValue) === test1536.apiKey,
    "readPrev after upsert"
  );

  // 3) 恢复原配置（或删除本轮新建）
  if (snap1536) {
    await prisma.adminConfig.update({
      where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
      data: {
        configValue: snap1536.configValue as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.adminConfig.delete({
      where: { configKey: EMBEDDING_CONFIG_KEY_1536 },
    });
  }
  if (snap1024) {
    await prisma.adminConfig.update({
      where: { configKey: EMBEDDING_CONFIG_KEY_1024 },
      data: {
        configValue: snap1024.configValue as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.adminConfig.delete({
      where: { configKey: EMBEDDING_CONFIG_KEY_1024 },
    });
  }
  console.log("✅ 已恢复 embedding 两行原状（或删除测试行）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
