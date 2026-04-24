/**
 * 检查 KB_事项宫位知识库 和 KB_互动关系取象规则 在索引中的实际标签
 */
import "dotenv/config";
import { ZVecOpen } from "@zvec/zvec";
import { getLogicdocCollectionPath } from "../src/lib/zvec/paths";

async function main() {
  const path1536 = getLogicdocCollectionPath("1536");
  const col = ZVecOpen(path1536, { readOnly: true });

  console.log("=== KB_事项宫位知识库 的实际 biz_modules 标签 ===");
  const kbFiles = ["KB_事项宫位知识库_V1.1.docx"];
  const seen = new Set<string>();

  for (const filename of kbFiles) {
    let count = 0;
    for (let i = 0; i < 200; i++) {
      const id = `logicdoc/${filename}_${i}`;
      const docs = col.fetchSync(id);
      const doc = docs[id];
      if (doc?.fields?.biz_modules) {
        const tag = String(doc.fields.biz_modules);
        if (!seen.has(tag)) {
          seen.add(tag);
          console.log(`  chunk ${i}: biz_modules = "${tag}"`);
        }
        count++;
      }
    }
    console.log(`  共 ${count} 个已索引 chunk`);
  }

  console.log("\n=== KB_互动关系取象规则 的实际 biz_modules 标签 ===");
  const kgFiles = ["KB_互动关系取象规则_V1.2.docx"];
  seen.clear();

  for (const filename of kgFiles) {
    let count = 0;
    for (let i = 0; i < 200; i++) {
      const id = `logicdoc/${filename}_${i}`;
      const docs = col.fetchSync(id);
      const doc = docs[id];
      if (doc?.fields?.biz_modules) {
        const tag = String(doc.fields.biz_modules);
        if (!seen.has(tag)) {
          seen.add(tag);
          console.log(`  chunk ${i}: biz_modules = "${tag}"`);
        }
        count++;
      }
    }
    console.log(`  共 ${count} 个已索引 chunk`);
  }

  console.log("\n=== 各文件的 palaces 标签 ===");
  for (const filename of [...kbFiles, ...kgFiles]) {
    let hasPalaces = false;
    for (let i = 0; i < 200; i++) {
      const id = `logicdoc/${filename}_${i}`;
      const docs = col.fetchSync(id);
      const doc = docs[id];
      if (doc?.fields?.palaces) {
        hasPalaces = true;
        console.log(`  ${filename}: 有 palaces 字段`);
        break;
      }
    }
    if (!hasPalaces) {
      console.log(`  ${filename}: 无 palaces 字段`);
    }
  }

  col.closeSync();
}

main().catch(console.error);
