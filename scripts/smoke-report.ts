/**
 * 报告生成端到端冒烟（紫微化验证）
 * 登录 → 查命主/模板 → POST 生成 → 检查报告内容是否紫微（无八字术语）
 * 运行: npx tsx scripts/smoke-report.ts
 */
import "dotenv/config";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3333";
const USER = process.env.SMOKE_USERNAME || "admin";
const PASS = process.env.SMOKE_PASSWORD || "ffffff";

function parseSetCookie(headers: Headers): string {
  const getSetCookie = headers.getSetCookie?.();
  if (getSetCookie?.length) return getSetCookie.map(s => s.split(";")[0]).join("; ");
  const sc = headers.get("set-cookie");
  if (!sc) return "";
  return (Array.isArray(sc) ? sc : [sc]).map(s => s.split(";")[0]).join("; ");
}

async function login(): Promise<string> {
  let cookie = "";
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
  const c1 = parseSetCookie(csrfRes.headers);
  if (c1) cookie = c1;
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) throw new Error("无 csrfToken");
  const body = new URLSearchParams({ username: USER, password: PASS, csrfToken, callbackUrl: "/", redirect: "false" }).toString();
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    redirect: "manual",
  });
  const c2 = parseSetCookie(loginRes.headers);
  if (c2) cookie = c2;
  return cookie;
}

async function main() {
  console.log("登录中...");
  const cookie = await login();
  console.log("登录 ok\n");

  // 确保 admin 有命主（prisma 直连，绕过 API 认证限制）
  const { prisma } = await import("../src/lib/db");
  const adminUser = await prisma.user.findFirst({ where: { username: USER } });
  if (!adminUser) { console.log("✗ 无 admin 用户"); return; }
  let identity = await prisma.identity.findFirst({ where: { userId: adminUser.id }, select: { id: true, name: true, birthday: true } });
  if (!identity) {
    console.log("admin 无命主，创建测试命主...");
    identity = await prisma.identity.create({
      data: { userId: adminUser.id, name: "测试李某", gender: "FEMALE", birthday: "1992-08-15 16:00", birthCity: "北京", region: "北京", relation: "SELF", isActive: true },
      select: { id: true, name: true, birthday: true },
    });
    console.log(`已创建：${identity.name}`);
  }
  await prisma.$disconnect();
  console.log(`命主：${identity.name}（${identity.birthday}）`);

  // 查模板，优先选字数少的（快）
  const tplRes = await fetch(`${BASE}/api/report-templates`, { headers: { Cookie: cookie } });
  type Tpl = { id: string; name: string; slug: string; pointCost: number; isActive: boolean };
  const tplRaw = (await tplRes.json()) as { basicTemplates?: Tpl[]; advancedTemplates?: Tpl[] } | Tpl[];
  const tplJson = Array.isArray(tplRaw) ? tplRaw : [...(tplRaw.basicTemplates ?? []), ...(tplRaw.advancedTemplates ?? [])];
  const active = tplJson; // API 已按 isActive:true 过滤
  if (!active?.length) {
    console.log("⚠ 无可用报告模板，跳过测试（需 seed 模板）");
    return;
  }
  // 优先选轻量模板
  const preferred = active.find(t => ["lucky-tips", "academic", "past-life", "love-atlas"].includes(t.slug)) ?? active[0];
  console.log(`模板：${preferred.name}（${preferred.slug}，${preferred.pointCost} 星币）\n`);

  // POST 生成报告
  console.log("生成报告中（AI 调用，请等待）...");
  const t0 = Date.now();
  const genRes = await fetch(`${BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ templateId: preferred.id, identityId: identity.id }),
  });
  const genJson = (await genRes.json()) as { report?: { status: string; content?: string; errorMessage?: string }; error?: string };
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`生成耗时：${dt}s，HTTP ${genRes.status}`);

  if (genJson.error) {
    console.log(`✗ 生成失败：${genJson.error}`);
    return;
  }
  const report = genJson.report;
  if (!report || report.status !== "COMPLETED" || !report.content) {
    console.log(`✗ 报告未完成：status=${report?.status} err=${report?.errorMessage}`);
    return;
  }

  // 解析 content（JSON chapters）
  let contentText = "";
  try {
    const parsed = JSON.parse(report.content) as { chapters: Array<{ title: string; content: string }> };
    contentText = parsed.chapters.map(c => `${c.title}\n${c.content}`).join("\n\n");
  } catch {
    contentText = report.content;
  }

  console.log(`\n═══ 报告内容检查（共 ${contentText.length} 字）═══`);
  // 紫微词
  const ziweiTerms = ["命宫", "夫妻宫", "官禄宫", "财帛宫", "大限", "紫微", "天府", "四化", "化禄", "化忌", "流年", "三方四正"];
  const ziweiHits = ziweiTerms.filter(t => contentText.includes(t));
  console.log(`✓ 紫微术语命中（${ziweiHits.length}/${ziweiTerms.length}）：${ziweiHits.slice(0, 8).join("、")}`);
  // 八字词（不应出现）
  const baziTerms = ["十神", "比肩", "劫财", "食神", "伤官", "偏财", "正财", "偏印", "正印", "大运", "用神", "喜忌", "日主", "纳音"];
  const baziHits = baziTerms.filter(t => contentText.includes(t));
  console.log(baziHits.length ? `✗ ⚠ 仍含八字术语：${baziHits.join("、")}` : `✓ 无八字术语污染`);

  // 章节预览
  try {
    const parsed = JSON.parse(report.content) as { chapters: Array<{ title: string }> };
    console.log(`\n章节：${parsed.chapters.map(c => c.title).join(" | ")}`);
  } catch { /* ignore */ }

  console.log(`\n${baziHits.length === 0 && ziweiHits.length >= 3 ? "✓ 报告紫微化验证通过" : "△ 需人工复核"}`);
}

main().catch(e => { console.error("异常:", e); process.exit(1); });
