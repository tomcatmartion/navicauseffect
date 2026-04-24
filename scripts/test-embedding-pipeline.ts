/**
 * Embedding 管线纯函数自测（不调用外网、不依赖 DATABASE_URL）
 * 运行: npx tsx scripts/test-embedding-pipeline.ts
 */
import assert from "node:assert/strict";

import {
  enrichEmbeddingBusinessMessage,
  enrichOpenAiStyleEmbeddingErrorMessage,
} from "../src/lib/zvec/embedding-errors";
import {
  buildEmbeddingPostBody,
  isMinimaxEmbeddingBaseUrl,
} from "../src/lib/zvec/embedding-request-format";
import { buildEmbeddingsRequestUrl } from "../src/lib/zvec/embedding-url";
import {
  extractEmbeddingVectorFromJson,
  throwIfEmbeddingBaseRespError,
} from "../src/lib/zvec/parse-embedding-response";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}`, e);
    throw e;
  }
}

const cfg = (baseUrl: string, groupId?: string) => ({
  baseUrl,
  modelId: "embo-01",
  apiKey: "sk-test",
  ...(groupId ? { groupId } : {}),
});

function main() {
  test("buildEmbeddingsRequestUrl 根路径拼接", () => {
    assert.equal(
      buildEmbeddingsRequestUrl("https://api.openai.com/v1"),
      "https://api.openai.com/v1/embeddings"
    );
    assert.equal(
      buildEmbeddingsRequestUrl("https://x.com/v1/embeddings"),
      "https://x.com/v1/embeddings"
    );
  });

  test("MiniMax 检测与请求体 texts+type", () => {
    assert.equal(isMinimaxEmbeddingBaseUrl("https://api.minimaxi.com/v1"), true);
    assert.equal(isMinimaxEmbeddingBaseUrl("https://api.openai.com/v1"), false);
    const b = buildEmbeddingPostBody(cfg("https://api.minimaxi.com/v1"), "hello", "document");
    assert.deepEqual(b.texts, ["hello"]);
    assert.equal(b.type, "db");
    assert.equal(b.model, "embo-01");
    assert.ok(!("input" in b));
    const q = buildEmbeddingPostBody(cfg("https://api.minimaxi.com/v1"), "q", "query");
    assert.equal(q.type, "query");
  });

  test("OpenAI 形态请求体", () => {
    const prev = process.env.EMBEDDING_OMIT_ENCODING_FORMAT;
    delete process.env.EMBEDDING_OMIT_ENCODING_FORMAT;
    const b = buildEmbeddingPostBody(cfg("https://api.openai.com/v1"), "hi", "document");
    assert.equal(b.input, "hi");
    assert.equal(b.encoding_format, "float");
    if (prev !== undefined) process.env.EMBEDDING_OMIT_ENCODING_FORMAT = prev;
  });

  test("EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY 强制 OpenAI", () => {
    process.env.EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY = "1";
    try {
      const b = buildEmbeddingPostBody(
        cfg("https://api.minimaxi.com/v1"),
        "x",
        "document"
      );
      assert.equal(b.input, "x");
      assert.ok(!("texts" in b));
    } finally {
      delete process.env.EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY;
    }
  });

  test("EMBEDDING_MINIMAX_GROUP_ID 写入 group_id", () => {
    process.env.EMBEDDING_MINIMAX_GROUP_ID = "g-123";
    try {
      const b = buildEmbeddingPostBody(
        cfg("https://api.minimaxi.com/v1"),
        "t",
        "query"
      );
      assert.equal(b.group_id, "g-123");
    } finally {
      delete process.env.EMBEDDING_MINIMAX_GROUP_ID;
    }
  });

  test("cfg.groupId 优先于环境变量", () => {
    process.env.EMBEDDING_MINIMAX_GROUP_ID = "from-env";
    try {
      const b = buildEmbeddingPostBody(
        cfg("https://api.minimaxi.com/v1", "from-cfg"),
        "t",
        "document"
      );
      assert.equal(b.group_id, "from-cfg");
    } finally {
      delete process.env.EMBEDDING_MINIMAX_GROUP_ID;
    }
  });

  test("extractEmbeddingVectorFromJson OpenAI / MiniMax / output", () => {
    const openai = {
      data: [{ embedding: [0.1, 0.2], index: 0 }],
    };
    assert.deepEqual(extractEmbeddingVectorFromJson(openai), [0.1, 0.2]);
    const mm = {
      vectors: [[0.5, 0.6]],
      base_resp: { status_code: 0 },
    };
    assert.deepEqual(extractEmbeddingVectorFromJson(mm), [0.5, 0.6]);
    const dash = {
      output: { embeddings: [{ embedding: [1, 2, 3] }] },
    };
    assert.deepEqual(extractEmbeddingVectorFromJson(dash), [1, 2, 3]);
  });

  test("throwIfEmbeddingBaseRespError 成功不抛 / 失败抛", () => {
    throwIfEmbeddingBaseRespError({ base_resp: { status_code: 0 } });
    throwIfEmbeddingBaseRespError({});
    assert.throws(
      () =>
        throwIfEmbeddingBaseRespError({
          base_resp: { status_code: 1002, status_msg: "insufficient balance" },
        }),
      (err: unknown) =>
        err instanceof Error &&
        /insufficient balance/i.test(err.message) &&
        /充值|计费|余额/.test(err.message)
    );
  });

  test("enrichEmbeddingBusinessMessage 余额提示", () => {
    const s = enrichEmbeddingBusinessMessage(1, "insufficient balance");
    assert.match(s, /充值|余额|计费/);
  });

  test("enrichOpenAiStyleEmbeddingErrorMessage insufficient_quota", () => {
    const s = enrichOpenAiStyleEmbeddingErrorMessage("insufficient_quota");
    assert.match(s, /账单|额度|计费/);
  });

  console.log("\n✅ embedding 管线自测全部通过");
}

main();
