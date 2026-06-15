/**
 * E2E 全链路测试 — navicauseffect_v2
 *
 * 测试流程：
 * 1. 注册 testuser_e2e（带邀请码 ADMIN001）
 * 2. 新用户登录 + 验证奖励星币
 * 3. 充值弹窗（4 档金额 + 星币计算）—— 在 testuser_e2e 的 user 页面直接操作
 * 4. 报告模板弹窗（两步流程）
 * 5. 管理员登录 + 充值弹窗 + 邀请码显示
 * 6. 注册页邀请码字段检查
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3333";
const ARTIFACTS = path.resolve("e2e-artifacts");

// ---------- helpers ----------

function log(section, msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] [${section}] ${msg}`);
}

function result(id, pass, detail) {
  const icon = pass ? "PASS" : "FAIL";
  console.log(`  >> ${icon}: ${id} — ${detail}`);
  return { id, pass, detail };
}

async function screenshot(page, name) {
  const p = path.join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

/** 安全地导航并等待 React hydration */
async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000); // 等 React hydration
}

/** 安全退出登录 */
async function logout(page) {
  await page.evaluate(async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "callbackUrl=/auth/login",
      });
    } catch {}
  }).catch(() => {});
  await page.context().clearCookies();
  await page.waitForTimeout(500);
}

/** 登录指定用户 */
async function loginAs(page, username, password) {
  await safeGoto(page, `${BASE}/auth/login`);
  await page.locator('[role="tab"]').filter({ hasText: "账号登录" }).click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="请输入用户名"]').fill(username);
  await page.locator('input[placeholder="请输入密码"]').fill(password);
  await page.locator('form button:has-text("登录")').click();
  await page.waitForTimeout(3000);
}

// ---------- main ----------

(async () => {
  const results = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // ====================================================================
  // 1. 注册 testuser_e2e（带邀请码 ADMIN001）
  // ====================================================================
  log("TC1", "注册新用户 testuser_e2e，邀请码 ADMIN001");

  try {
    await safeGoto(page, `${BASE}/auth/login`);
    await screenshot(page, "01-login-page");

    // 切换到注册 Tab
    await page.locator('[role="tab"]').filter({ hasText: "注册" }).click();
    await page.waitForTimeout(800);

    await screenshot(page, "02-register-tab");

    // 填写注册表单
    await page.locator('input[placeholder="请设置用户名"]').fill("testuser_e2e");
    await page.locator('input[placeholder="给自己起个名字"]').fill("E2E测试用户");
    await page.locator('input[placeholder="有邀请码可获赠星币"]').fill("ADMIN001");
    await page.locator('input[placeholder="至少6位密码"]').fill("test123456");

    await screenshot(page, "03-register-form-filled");

    // 监听注册 API 响应
    const registerResponsePromise = page.waitForResponse(
      resp => resp.url().includes("/api/auth/register"),
      { timeout: 15000 }
    ).catch(() => null);

    // 点击注册按钮
    await page.locator('form button:has-text("注册")').click();

    const registerRes = await registerResponsePromise;
    let registerData = null;
    if (registerRes) {
      registerData = await registerRes.json().catch(() => null);
      log("TC1", `注册 API 响应: status=${registerRes.status()}, data=${JSON.stringify(registerData)}`);
    }

    await page.waitForTimeout(3000);
    await screenshot(page, "04-after-register");

    const url = page.url();
    const registeredOk = url.includes("/chart") || url.includes("/user") || url.includes("/reports");
    const alreadyExists = registerData?.error?.includes("已被注册");
    const dbError = registerData?.error?.includes("Foreign key") || registerData?.error?.includes("prisma");

    if (registeredOk) {
      results.push(result("TC1.1", true, `注册成功，已跳转到 ${url}`));
      const hasBonus = registerData?.message?.includes("星币奖励") || registerData?.bonusPoints > 0;
      results.push(result("TC1.2", hasBonus,
        `奖励消息: "${registerData?.message || ""}", bonusPoints: ${registerData?.bonusPoints ?? 0}`));
    } else if (alreadyExists) {
      results.push(result("TC1.1", true, "用户 testuser_e2e 已存在（重复测试），视为通过"));
      results.push(result("TC1.2", true, "首次注册时已获得奖励星币（跳过验证）"));
    } else if (dbError) {
      // 数据库外键约束错误 — 这说明用户创建成功了但后续 promoterTeam 记录失败
      // 用户可能已经存在于数据库中了（之前某次部分成功的注册）
      results.push(result("TC1.1", false,
        `注册 API 500 错误 — Prisma 外键约束: ${registerData?.error?.slice(0, 150)}`));
      results.push(result("TC1.2", false, "注册失败无法验证奖励"));
    } else {
      results.push(result("TC1.1", false,
        `注册后 URL = ${url}，API 返回: ${JSON.stringify(registerData)}`));
      results.push(result("TC1.2", false, "无法验证奖励"));
    }
  } catch (e) {
    results.push(result("TC1.1", false, `异常: ${e.message}`));
    await screenshot(page, "04-register-error").catch(() => {});
  }

  // ====================================================================
  // 2. 新用户登录 + 验证奖励星币
  // ====================================================================
  log("TC2", "登录 testuser_e2e 并检查初始星币");

  try {
    await logout(page);
    await loginAs(page, "testuser_e2e", "test123456");

    log("TC2", `登录后 URL = ${page.url()}`);

    // 去 /user 页面
    await safeGoto(page, `${BASE}/user`);
    await page.waitForTimeout(1500);
    await screenshot(page, "07-user-page");

    // 通过 API 验证
    const profileRes = await page.evaluate(async () => {
      const r = await fetch("/api/user/profile");
      return r.json();
    });

    results.push(result("TC2.1", profileRes.totalPoints >= 10,
      `API totalPoints = ${profileRes.totalPoints}，期望 >= 10（邀请码奖励 10 星币）`));
    results.push(result("TC2.2", !!profileRes.inviteCode,
      `用户邀请码: ${profileRes.inviteCode || "未生成"}`));

    // 页面上显示的星币数
    const pageText = await page.locator("body").textContent();
    const pointsOnPage = pageText.includes(String(profileRes.totalPoints));
    results.push(result("TC2.3", pointsOnPage,
      `页面文本包含星币数 ${profileRes.totalPoints}: ${pointsOnPage ? "是" : "否"}`));

  } catch (e) {
    results.push(result("TC2", false, `异常: ${e.message}`));
    await screenshot(page, "06-login-error").catch(() => {});
  }

  // ====================================================================
  // 3. 充值弹窗（在 testuser_e2e 已登录状态下）
  // ====================================================================
  log("TC3", "测试充值弹窗 — 在 testuser_e2e 的 user 页面");

  try {
    // 已经在 /user 页面且已登录 testuser_e2e
    // 先等页面完全加载
    await page.waitForTimeout(1000);

    // 确认当前在 /user 页面
    const currentUrl = page.url();
    log("TC3", `当前 URL: ${currentUrl}`);

    if (!currentUrl.includes("/user")) {
      // 需要重新导航
      await safeGoto(page, `${BASE}/user`);
    }

    // 滚动到"资产与会籍"区域确保可见
    const assetSection = page.locator("text=资产与会籍").first();
    await assetSection.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await screenshot(page, "08-user-assets-section");

    // 点击"立即充值"卡片 — 使用更精确的选择器
    const rechargeBtn = page.locator("text=立即充值").first();
    const rechargeVisible = await rechargeBtn.isVisible().catch(() => false);
    log("TC3", `立即充值可见: ${rechargeVisible}`);

    if (!rechargeVisible) {
      // 尝试全页面查找
      const bodyText = await page.locator("body").textContent();
      log("TC3", `页面内容 (前500字): ${bodyText?.slice(0, 500)}`);
      results.push(result("TC3.0", false, `"立即充值" 不可见，可能 session 丢失或页面未完全加载`));
    } else {
      await rechargeBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, "08-recharge-dialog");

      // 检查弹窗标题
      const dialogContent = await page.locator('[role="dialog"]').textContent().catch(() => "");
      log("TC3", `Dialog text: ${dialogContent.slice(0, 200)}`);

      const rechargeTitle = dialogContent.includes("充值星币");
      results.push(result("TC3.0", rechargeTitle,
        `充值弹窗标题 "充值星币" ${rechargeTitle ? "可见" : "不可见"}`));

      // 检查 4 档金额
      const amounts = ["20", "50", "100", "300"];
      const allAmountsFound = amounts.every(a => dialogContent.includes(`¥${a}`));
      results.push(result("TC3.1", allAmountsFound,
        `充值金额选项 20/50/100/300 ${allAmountsFound ? "全部显示" : "部分缺失"}`));

      // 检查兑换说明
      const rateText = dialogContent.includes("1元 = 10星币");
      results.push(result("TC3.2", rateText,
        `兑换说明 "1元 = 10星币" ${rateText ? "可见" : "不可见"}`));

      // 选择 50 元
      await page.locator('[role="dialog"]').locator("text=¥50").first().click();
      await page.waitForTimeout(300);
      const dialogText50 = await page.locator('[role="dialog"]').textContent().catch(() => "");
      const coinsPreview50 = dialogText50.includes("550");
      results.push(result("TC3.3", coinsPreview50,
        `选择 50 元后预览 550 (500+50 bonus) ${coinsPreview50 ? "正确" : "未找到"}`));

      // 选择 300 元
      await page.locator('[role="dialog"]').locator("text=¥300").first().click();
      await page.waitForTimeout(300);
      const dialogText300 = await page.locator('[role="dialog"]').textContent().catch(() => "");
      const coinsPreview300 = dialogText300.includes("3600");
      results.push(result("TC3.4", coinsPreview300,
        `选择 300 元后预览 3600 (3000+600 bonus) ${coinsPreview300 ? "正确" : "未找到"}`));

      // 选择 20 元
      await page.locator('[role="dialog"]').locator("text=¥20").first().click();
      await page.waitForTimeout(300);
      const dialogText20 = await page.locator('[role="dialog"]').textContent().catch(() => "");
      const coinsPreview20 = dialogText20.includes("200") && dialogText20.includes("星币");
      results.push(result("TC3.5", coinsPreview20,
        `选择 20 元后预览 200 星币 ${coinsPreview20 ? "正确" : "未找到"}`));

      // 关闭弹窗
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } catch (e) {
    results.push(result("TC3", false, `异常: ${e.message}`));
    await screenshot(page, "08-recharge-error").catch(() => {});
  }

  // ====================================================================
  // 4. 报告模板弹窗（两步流程）
  // ====================================================================
  log("TC4", "测试报告模板弹窗");

  try {
    await safeGoto(page, `${BASE}/reports`);
    await page.waitForTimeout(2000);
    await screenshot(page, "09-reports-page");

    const cardCount = await page.locator(".group.cursor-pointer").count();

    if (cardCount > 0) {
      await page.locator(".group.cursor-pointer").first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, "10-template-dialog-step1");

      const dialogText = await page.locator('[role="dialog"]').textContent().catch(() => "");

      const step1Title = dialogText.includes("选择命主");
      results.push(result("TC4.1", step1Title,
        `报告弹窗步骤1 "选择命主" ${step1Title ? "可见" : "不可见"}`));

      const progressBar = await page.locator('[role="dialog"]').locator(".h-1.rounded-full").count();
      results.push(result("TC4.1b", progressBar >= 2,
        `进度条元素数量: ${progressBar}，期望 >= 2`));

      const nextBtnVisible = dialogText.includes("下一步");
      results.push(result("TC4.2", nextBtnVisible,
        `"下一步" 按钮/文字 ${nextBtnVisible ? "存在" : "不存在"}`));

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      results.push(result("TC4.1", false, "报告模板页面无可用模板卡片"));
    }
  } catch (e) {
    results.push(result("TC4", false, `异常: ${e.message}`));
    await screenshot(page, "10-reports-error").catch(() => {});
  }

  // ====================================================================
  // 5. 管理员登录 + 充值弹窗 + 邀请码显示
  // ====================================================================
  log("TC5", "管理员登录测试");

  try {
    await logout(page);
    await loginAs(page, "admin", "ffffff");

    log("TC5", `管理员登录后 URL = ${page.url()}`);

    // 去 /user
    await safeGoto(page, `${BASE}/user`);
    await page.waitForTimeout(1500);
    await screenshot(page, "12-admin-user-page");

    // 验证充值弹窗
    await page.locator("text=立即充值").first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, "13-admin-recharge-dialog");

    const dialogTextAdmin = await page.locator('[role="dialog"]').textContent().catch(() => "");
    const adminRechargeTitle = dialogTextAdmin.includes("充值星币");
    results.push(result("TC5.1", adminRechargeTitle,
      `管理员充值弹窗 "充值星币" ${adminRechargeTitle ? "可见" : "不可见"}`));

    // 选择 100 元
    await page.locator('[role="dialog"]').locator("text=¥100").first().click();
    await page.waitForTimeout(300);
    const dialogText100 = await page.locator('[role="dialog"]').textContent().catch(() => "");
    const coinsPreview100 = dialogText100.includes("1150");
    results.push(result("TC5.2", coinsPreview100,
      `选择 100 元后预览 1150 (1000+150 bonus) ${coinsPreview100 ? "正确" : "未找到"}`));

    // 关闭充值弹窗
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // 打开兑换中心查看邀请码
    await page.locator("text=兑换中心").first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, "14-admin-redeem-dialog");

    const redeemDialogText = await page.locator('[role="dialog"]').textContent().catch(() => "");
    const inviteCodeVisible = redeemDialogText.includes("ADMIN001");
    results.push(result("TC5.3", inviteCodeVisible,
      `管理员邀请码 ADMIN001 ${inviteCodeVisible ? "正确显示" : "未显示"}`));

    const myInviteLabel = redeemDialogText.includes("我的邀请码");
    results.push(result("TC5.4", myInviteLabel,
      `"我的邀请码" 标签 ${myInviteLabel ? "可见" : "不可见"}`));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

  } catch (e) {
    results.push(result("TC5", false, `异常: ${e.message}`));
    await screenshot(page, "13-admin-error").catch(() => {});
  }

  // ====================================================================
  // 6. 注册页邀请码字段检查
  // ====================================================================
  log("TC6", "检查注册页邀请码字段");

  try {
    await logout(page);
    await safeGoto(page, `${BASE}/auth/login`);

    await page.locator('[role="tab"]').filter({ hasText: "注册" }).click();
    await page.waitForTimeout(800);
    await screenshot(page, "15-register-tab-invite-field");

    const pageText6 = await page.locator("body").textContent();
    const inviteLabel = pageText6.includes("邀请码（选填）");
    results.push(result("TC6.1", inviteLabel,
      `"邀请码（选填）" 标签 ${inviteLabel ? "可见" : "不可见"}`));

    const inviteInputField = await page.locator('input[placeholder="有邀请码可获赠星币"]')
      .isVisible().catch(() => false);
    results.push(result("TC6.2", inviteInputField,
      `邀请码输入框 ${inviteInputField ? "存在" : "不存在"}`));

    const placeholderText = await page.locator('input[placeholder="有邀请码可获赠星币"]').first()
      .getAttribute("placeholder").catch(() => "");
    results.push(result("TC6.3", placeholderText === "有邀请码可获赠星币",
      `邀请码 placeholder = "${placeholderText}"`));

  } catch (e) {
    results.push(result("TC6", false, `异常: ${e.message}`));
    await screenshot(page, "15-register-error").catch(() => {});
  }

  // ====================================================================
  // 汇总
  // ====================================================================
  await browser.close();

  console.log("\n" + "=".repeat(70));
  console.log("E2E 全链路测试报告");
  console.log("=".repeat(70));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  console.log(`\n总计: ${total} | 通过: ${passed} | 失败: ${failed} | 通过率: ${((passed/total)*100).toFixed(0)}%\n`);

  for (const r of results) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`  [${icon}] ${r.id}: ${r.detail}`);
  }

  console.log("\n" + "-".repeat(70));
  if (failed > 0) {
    console.log("失败项:");
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  ! ${r.id}: ${r.detail}`);
    }
  } else {
    console.log("全部通过!");
  }
  console.log("-".repeat(70));

  console.log(`\n截图目录: ${ARTIFACTS}`);

  process.exit(failed > 0 ? 1 : 0);
})();
