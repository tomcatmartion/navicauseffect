/**
 * 检查索引中实际存在的文件列表
 */
import "dotenv/config";
import { ZVecOpen } from "@zvec/zvec";
import { getLogicdocCollectionPath } from "../src/lib/zvec/paths";

async function main() {
  const path1536 = getLogicdocCollectionPath("1536");
  const col = ZVecOpen(path1536, { readOnly: true });

  console.log("=== 索引中的所有文件 ===");
  const files = new Set<string>();

  // 尝试不同的前缀
  for (const prefix of ["sysfiles/sysknowledge/", "logicdoc/", "KB_", "SKILL_"]) {
    const allIds = (col as unknown as { _ids?: string[] })._ids;
    if (allIds) {
      for (const id of allIds) {
        if (id.includes("事项宫位") || id.includes("互动关系")) {
          console.log(`  找到: ${id}`);
          // 提取文件名
          const match = id.match(/^(?:sysfiles\/sysknowledge\/|logicdoc\/)?([^_]+)_/);
          if (match) {
            files.add(match[2]);
          }
        }
      }
    }
  }

  // 尝试遍历一些 chunk 来找文件名
  console.log("\n=== 通过遍历 chunk 找文件名 ===");
  const sampleIds = [
    "logicdoc/KB_事项宫位知识库_V1.1.docx_0",
    "logicdoc/KB_事项宫位知识库_V1.1_0",
    "KB_事项宫位知识库_V1.1.docx_0",
    "KB_事项宫位知识库_V1.1_0",
  ];

  for (const id of sampleIds) {
    const docs = col.fetchSync(id);
    const doc = docs[id];
    if (doc?.fields?.source_file) {
      console.log(`  ${id} -> source_file = ${doc.fields.source_file}`);
    } else {
      console.log(`  ${id} -> 无数据`);
    }
  }

  // 尝试 fetch 任何包含 "事项" 的 id
  console.log("\n=== 尝试 fetch 任何包含'事项'的 id ===");
  const keys = Object.keys(col);
  console.log(`  collection keys 数量: ${keys.length}`);
  if (keys.length > 0) {
    console.log(`  前10个 keys: ${keys.slice(0, 10).join(", ")}`);
  }

  col.closeSync();
}

main().catch(console.error);
