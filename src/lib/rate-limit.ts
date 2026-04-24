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

  const limit = userId ? 5 : 3;

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
  await pipeline.exec();
}
