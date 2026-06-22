/**
 * 微信小程序后端集成：jscode2session + access_token 缓存
 *
 * 双模式：
 * - 真实模式：WECHAT_MINIPROGRAM_APP_ID 配置时调用微信开放平台 API
 * - mock 模式：未配置时返回 fake openid，便于本地/测试独立运行
 */

import { redis } from "@/lib/redis";

const APPID = process.env.WECHAT_MINIPROGRAM_APP_ID || "";
const SECRET = process.env.WECHAT_MINIPROGRAM_APP_SECRET || "";

/** mock 模式开关（默认 true，配置 APPID+SECRET 后自动关闭） */
const MOCK_MODE =
  process.env.WECHAT_MINIPROGRAM_MOCK !== "false" &&
  (!APPID || !SECRET);

export interface Jscode2SessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
}

/**
 * 小程序 code → openid + session_key
 *
 * 真实：调用 https://api.weixin.qq.com/sns/jscode2session
 * mock：返回稳定的 fake openid（同 code 同 openid，便于测试）
 */
export async function jscode2session(code: string): Promise<Jscode2SessionResult> {
  if (MOCK_MODE) {
    const fakeOpenid = "mock_" + simpleHash(code).slice(0, 16);
    return {
      openid: fakeOpenid,
      session_key: "mock_session_key_" + Date.now(),
    };
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", APPID);
  url.searchParams.set("secret", SECRET);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url, { method: "GET" });
  const data = (await res.json()) as {
    openid?: string;
    session_key?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode || !data.openid) {
    throw new Error(
      `jscode2session 失败: ${data.errcode || "unknown"} ${data.errmsg || ""}`,
    );
  }

  return {
    openid: data.openid,
    session_key: data.session_key!,
    unionid: data.unionid,
  };
}

/**
 * 获取小程序全局 access_token（带 Redis 缓存，TTL 7000s）
 *
 * 用于服务端调用其他微信 API（如订阅消息、生成小程序码等）
 * mock 模式返回 fake token
 */
export async function getMiniprogramAccessToken(): Promise<string> {
  const cacheKey = "wechat:miniprogram:access_token";

  if (MOCK_MODE) {
    return "mock_access_token_" + Date.now();
  }

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", APPID);
  url.searchParams.set("secret", SECRET);

  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode || !data.access_token) {
    throw new Error(
      `getAccessToken 失败: ${data.errcode || "unknown"} ${data.errmsg || ""}`,
    );
  }

  // 微信返回 expires_in=7200，提前 200s 刷新避免临界过期
  const ttl = Math.min((data.expires_in || 7200) - 200, 7000);
  await redis.setex(cacheKey, ttl, data.access_token);
  return data.access_token;
}

/**
 * 当前是否为 mock 模式（用于调试/日志）
 */
export function isMiniprogramMockMode(): boolean {
  return MOCK_MODE;
}

// ─── 工具 ──────────────────────────────────────────────────────────────────

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  // 转 hex 字符串，保证稳定
  return Math.abs(hash).toString(16).padStart(8, "0") + input.length.toString(16);
}
