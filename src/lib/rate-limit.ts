import { redis } from "./redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export async function checkDailyLimit(
  userId: string | null,
  ip: string,
  membershipPlan: string
): Promise<RateLimitResult> {
  if (membershipPlan === "MONTHLY" || membershipPlan === "QUARTERLY" || membershipPlan === "YEARLY") {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }

  const today = new Date().toISOString().split("T")[0];
  const key = userId
    ? `daily_limit:user:${userId}:${today}`
    : `daily_limit:ip:${ip}:${today}`;

  const limit = userId ? 100 : 5;

  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  return { allowed: true, remaining: limit - count, limit };
}

export async function incrementDailyUsage(
  userId: string | null,
  ip: string
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const key = userId
    ? `daily_limit:user:${userId}:${today}`
    : `daily_limit:ip:${ip}:${today}`;

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 86400);
  // eslint-disable-next-line no-restricted-globals -- redis pipeline.exec() not child_process
  await pipeline.exec();
}

/**
 * 通用分钟级频率限制（防刷，如支付下单 5 次/分钟）
 *
 * 与 checkDailyLimit 区别：
 *   - 时间窗口短（默认 60s）
 *   - 不区分会员/非会员，所有用户一致
 *   - 用完即 increment（check + consume 一体），调用更简洁
 *
 * @param identifier  唯一标识（userId / ip / openid）
 * @param limit       窗口内允许次数
 * @param windowSec   窗口大小（秒），默认 60
 * @returns { allowed, remaining, retryAfter }
 */
export async function checkMinuteRateLimit(
  identifier: string,
  limit: number,
  windowSec = 60
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const key = `rate_limit:min:${identifier}`;
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, windowSec);
  // eslint-disable-next-line no-restricted-globals -- redis pipeline.exec() not child_process
  const results = await pipeline.exec();
  const count = (results?.[0]?.[1] as number) ?? 1;

  if (count > limit) {
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: ttl > 0 ? ttl : windowSec,
    };
  }
  return { allowed: true, remaining: limit - count, retryAfter: 0 };
}
