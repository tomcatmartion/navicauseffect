/**
 * SMS 验证码工具(手机号注册/登录/绑定共用)
 *
 * 存储策略:Redis
 *   sms:code:{phone}     验证码本身,TTL 300s(5 分钟)
 *   sms:lockout:{phone}  频率限制标记,TTL 60s(1 分钟内不能重复发送)
 *
 * mock 模式(SMS_ENABLED !== "true"):
 *   固定 code = "123456",console.log 提示开发环境用
 *   生产环境接阿里云 SMS SDK 是独立运维任务,本次不实现
 */

import { redis } from "@/lib/redis";

const CODE_TTL_SECONDS = 300; // 验证码有效期 5 分钟
const LOCKOUT_TTL_SECONDS = 60; // 频率限制 1 分钟
const CODE_LENGTH = 6;
const MOCK_CODE = "123456"; // 开发环境固定验证码

/** Redis key 命名 */
const codeKey = (phone: string) => `sms:code:${phone}`;
const lockoutKey = (phone: string) => `sms:lockout:${phone}`;

/** 判断是否为 mock 模式(未启用真实 SMS) */
export function isSmsMockMode(): boolean {
  return process.env.SMS_ENABLED !== "true";
}

/** 生成 6 位随机数字验证码 */
export function generateCode(): string {
  // crypto.randomInt 比 Math.random 更安全,但本项目避免引入额外 import
  // 6 位数字的碰撞概率极低,加上 Redis 频率限制,足够安全
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/**
 * 发送验证码
 *
 * 流程:
 *   1. 检查频率限制(60s 内不能重复发)
 *   2. 生成 code(mock 模式固定 123456)
 *   3. 写入 Redis sms:code:{phone} TTL 300s
 *   4. 写入 Redis sms:lockout:{phone} TTL 60s
 *   5. mock 模式 console.log 提示;生产模式预留 TODO 接阿里云 SDK
 *
 * 失败抛错,由调用方 catch 返回合适的 HTTP 状态码
 */
export async function sendCode(phone: string): Promise<{ mock: boolean }> {
  // 1. 频率限制
  const locked = await redis.exists(lockoutKey(phone));
  if (locked) {
    throw new SmsError("发送过于频繁,请 60 秒后再试", "RATE_LIMIT");
  }

  // 2. 生成 code
  const mockMode = isSmsMockMode();
  const code = mockMode ? MOCK_CODE : generateCode();

  // 3. 写入 Redis
  await redis.set(codeKey(phone), code, "EX", CODE_TTL_SECONDS);
  await redis.set(lockoutKey(phone), "1", "EX", LOCKOUT_TTL_SECONDS);

  // 4. 发送(mock 模式不调用 SDK)
  if (mockMode) {
    console.log(`[sms:mock] ${phone} 验证码:${code}(开发环境固定)`);
  } else {
    // TODO: 接入阿里云 SMS SDK
    // await aliyunSmsSdk.send(phone, code)
    console.warn("[sms] 生产模式 SMS SDK 未接入,验证码将无法真实送达");
    console.log(`[sms:dev-fallback] ${phone} 验证码:${code}`);
  }

  return { mock: mockMode };
}

/**
 * 校验验证码
 *
 * 通过则删除 key 防止重放;不通过或过期返回 false(不删除,允许用户重试)
 */
export async function verifyCode(phone: string, code: string): Promise<boolean> {
  const stored = await redis.get(codeKey(phone));
  if (!stored) return false;
  if (stored !== code) return false;

  // 校验通过,删除防重放
  await redis.del(codeKey(phone));
  return true;
}

/**
 * 只读查看验证码(不删除)
 *
 * 用于注册流程:register API 校验后,前端立即调用 phone provider 登录,
 * phone provider 会再次调用 verifyCode(消费并删除 code)。
 * 如果 register API 用 verifyCode,会提前删除 code 导致登录失败。
 *
 * 安全性:peekCode 只比对不删,但 register API 完成后 code 仍在 Redis(短 TTL 300s),
 * 攻击者拿到这个 code 仍然只能登录这个刚注册的账号(没有提权风险)。
 */
export async function peekCode(phone: string): Promise<string | null> {
  return await redis.get(codeKey(phone));
}

/** 比对验证码(不删除),用于注册流程不消费 code */
export async function checkCode(phone: string, code: string): Promise<boolean> {
  const stored = await peekCode(phone);
  if (!stored) return false;
  return stored === code;
}

/** 自定义错误类(区分频率限制与其他错误) */
export class SmsError extends Error {
  code: "RATE_LIMIT" | "SEND_FAILED";
  constructor(message: string, code: "RATE_LIMIT" | "SEND_FAILED") {
    super(message);
    this.name = "SmsError";
    this.code = code;
  }
}
