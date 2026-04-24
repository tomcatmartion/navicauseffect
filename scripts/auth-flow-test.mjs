/**
 * 自测：登录后带 callbackUrl 跳转 + 访问 /admin 不再被要求登录
 * 运行: node scripts/auth-flow-test.mjs [BASE_URL]
 * 默认 BASE_URL=http://localhost:3000
 */
const BASE = process.env.BASE_URL || process.argv[2] || "http://localhost:3000";

function parseSetCookie(headers) {
  const getSetCookie = headers.getSetCookie?.();
  if (getSetCookie?.length) {
    return getSetCookie.map((s) => s.split(";")[0]).join("; ");
  }
  const setCookie = headers.get?.("set-cookie") || headers["set-cookie"];
  if (!setCookie) return "";
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.map((s) => s.split(";")[0]).join("; ");
}

async function run() {
  let cookieHeader = "";
  const opts = (method, body, extraHeaders = {}) => ({
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...extraHeaders,
    },
    body,
    redirect: "manual",
  });

  console.log("1. GET /api/auth/csrf ...");
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    method: "GET",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    redirect: "manual",
  });
  const setCookie1 = parseSetCookie(csrfRes.headers);
  if (setCookie1) cookieHeader = setCookie1;
  const csrfJson = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfJson?.csrfToken ?? csrfJson?.token ?? "";
  if (!csrfToken) {
    console.log("   fail: no csrfToken in response", csrfJson);
    process.exit(1);
  }
  console.log("   ok, csrfToken received");

  const testPassword = process.env.ADMIN_PASSWORD || "changeme";
  console.log(`2. POST /api/auth/callback/credentials (admin/${testPassword}, callbackUrl=/admin) ...`);
  const body = new URLSearchParams({
    username: "admin",
    password: testPassword,
    csrfToken,
    callbackUrl: "/admin",
    redirect: "false",
  }).toString();
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, opts("POST", body));
  const setCookie2 = parseSetCookie(loginRes.headers);
  if (setCookie2) {
    cookieHeader = cookieHeader ? `${cookieHeader}; ${setCookie2}` : setCookie2;
  }
  const loginJson = await loginRes.json().catch(() => ({}));
  const okStatus = loginRes.status === 200 || loginRes.status === 302;
  if (!okStatus || (loginRes.status === 200 && loginJson?.error)) {
    console.log("   fail: status=" + loginRes.status, loginJson);
    process.exit(1);
  }
  if (!cookieHeader) {
    console.log("   warn: no cookie in response");
  }
  console.log("   ok, login response " + loginRes.status);

  console.log("3. GET /admin (with session cookie) ...");
  const adminRes = await fetch(`${BASE}/admin`, {
    method: "GET",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    redirect: "manual",
  });
  const location = adminRes.headers.get("location") || "";
  const redirectToLogin = adminRes.status >= 300 && adminRes.status < 400 && location.includes("/auth/login");
  if (redirectToLogin) {
    console.log("   fail: redirected to login (middleware did not see session)");
    console.log("   status:", adminRes.status, "location:", location);
    process.exit(1);
  }
  if (adminRes.status !== 200) {
    console.log("   fail: status=" + adminRes.status, location || "");
    process.exit(1);
  }
  const html = await adminRes.text();
  if (html.includes("账号登录") && html.includes("用户名")) {
    console.log("   fail: response is login page (session not recognized)");
    process.exit(1);
  }
  if (!html.includes("管理后台") && !html.includes("admin")) {
    console.log("   warn: response may not be admin page (no expected text)");
  }
  console.log("   ok, /admin returned 200 with admin content");

  console.log("\nAll checks passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
