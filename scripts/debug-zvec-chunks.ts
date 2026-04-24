/**
 * 检查 Zvec 索引中实际存储的 chunk 情况
 * 看"子女宫"相关内容的索引分布
 */
import "dotenv/config";
import { ZVecOpen } from "@zvec/zvec";
import { getLogicdocCollectionPath } from "../src/lib/zvec/paths";

async function main() {
  const path1536 = getLogicdocCollectionPath("1536");
  console.log(`索引路径: ${path1536}\n`);

  try {
    const col = ZVecOpen(path1536, { readOnly: true });
    const total = col.totalSync();
    console.log(`总 chunk 数: ${total}\n`);

    // 搜索包含"子女宫"的 chunk
    console.log("=== 搜索包含'子女宫'的 chunks ===");
    let found = 0;
    const seen = new Set<string>();

    for (let i = 0; i < Math.min(total, 500); i++) {
      const id = `logicdoc/SKILL_互动关系_V1.5.docx_${i}`;
      const docs = col.fetchSync(id);
      const doc = docs[id];
      if (doc?.fields?.text) {
        const text = String(doc.fields.text);
        if (text.includes("子女宫") && !seen.has(text.slice(0, 50))) {
          seen.add(text.slice(0, 50));
          found++;
          console.log(`\n[${id}]`);
          console.log(`  前150字: ${text.slice(0, 150).replace(/\n/g, ' ')}`);
        }
      }
    }

    console.log(`\n共找到 ${found} 个含"子女宫"的唯一 chunk`);

    // 搜索包含"亲子"的 chunks
    console.log("\n=== 搜索包含'亲子'的 chunks ===");
    found = 0;
    seen.clear();
    for (let i = 0; i < Math.min(total, 500); i++) {
      const id = `logicdoc/SKILL_互动关系_V1.5.docx_${i}`;
      const docs = col.fetchSync(id);
      const doc = docs[id];
      if (doc?.fields?.text) {
        const text = String(doc.fields.text);
        if (text.includes("亲子") && !seen.has(text.slice(0, 50))) {
          seen.add(text.slice(0, 50));
          found++;
          console.log(`\n[${id}]`);
          console.log(`  前150字: ${text.slice(0, 150).replace(/\n/g, ' ')}`);
        }
      }
    }
    console.log(`\n共找到 ${found} 个含"亲子"的唯一 chunk`);

    // 搜索包含"教育"的 chunks
    console.log("\n=== 搜索包含'教育'的 chunks ===");
    found = 0;
    seen.clear();
    for (let i = 0; i < Math.min(total, 500); i++) {
      const id = `logicdoc/SKILL_互动关系_V1.5.docx_${i}`;
      const docs = col.fetchSync(id);
      const doc = docs[id];
      if (doc?.fields?.text) {
        const text = String(doc.fields.text);
        if (text.includes("教育") && !seen.has(text.slice(0, 50))) {
          seen.add(text.slice(0, 50));
          found++;
          console.log(`\n[${id}]`);
          console.log(`  前150字: ${text.slice(0, 150).replace(/\n/g, ' ')}`);
        }
      }
    }
    console.log(`\n共找到 ${found} 个含"教育"的唯一 chunk`);

    col.closeSync();
  } catch (e) {
    console.error("错误:", e);
  }
}

main().catch(console.error);
