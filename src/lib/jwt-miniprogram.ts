/**
 * 小程序专用 JWT 签发与验证
 *
 * 与 NextAuth session 完全独立：
 * - NextAuth 用 httpOnly cookie 存 jwt（H5/Web 端用）
 * - 小程序用 localStorage 存这个独立 token（请求时加 Authorization: Bearer）
 *
 * 签名密钥复用 NEXTAUTH_SECRET，避免引入新环境变量。
 * 用 jose（已随 NextAuth v5 安装，edge runtime 兼容，无 native binding）。
 */

import { SignJWT, jwtVerify } from "jose";

const SECRET = process.env.NEXTAUTH_SECRET || "dev-fallback-secret-change-in-prod";
const ISSUER = "navicauseffect-miniprogram";
const AUDIENCE = "miniprogram-client";
const EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60; // 30 天

const secretKey = new TextEncoder().encode(SECRET);

export interface MiniprogramTokenPayload {
  userId: string;
  openid: string;
}

/**
 * 签发小程序专用 JWT
 */
export async function signMiniprogramToken(
  payload: MiniprogramTokenPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${EXPIRES_IN_SECONDS}s`)
    .sign(secretKey);
}

/**
 * 验证小程序 JWT
 * @returns payload 或 null（无效/过期）
 */
export async function verifyMiniprogramToken(
  token: string,
): Promise<MiniprogramTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const userId = payload.userId as string | undefined;
    const openid = payload.openid as string | undefined;
    if (!userId || !openid) return null;
    return { userId, openid };
  } catch {
    return null;
  }
}

/**
 * 从 Authorization 头部提取并验证 token
 * 兼容 "Bearer xxx" 格式
 */
export async function extractMiniprogramUser(
  authHeader: string | null,
): Promise<MiniprogramTokenPayload | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyMiniprogramToken(match[1]);
}
