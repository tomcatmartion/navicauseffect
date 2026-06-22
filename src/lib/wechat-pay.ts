/**
 * 微信支付 V3 集成（小程序 JSAPI 支付）
 *
 * 双模式：
 * - 真实模式：调用微信支付 V3 统一下单 API + RSA-SHA256 签名
 * - mock 模式：返回 fake prepay_id 和签名参数，便于独立测试
 *
 * 真实模式需要：
 *   WECHAT_PAY_MCH_ID          商户号
 *   WECHAT_PAY_API_V3_KEY      API v3 密钥
 *   WECHAT_PAY_CERT_SERIAL_NO  商户证书序列号
 *   WECHAT_PAY_PRIVATE_KEY_PEM 商户私钥（PEM 格式，多行用 \n 分隔或 base64）
 */

import crypto from "node:crypto";
import { randomBytes } from "node:crypto";

const MCH_ID = process.env.WECHAT_PAY_MCH_ID || "";
const API_V3_KEY = process.env.WECHAT_PAY_API_V3_KEY || "";
const CERT_SERIAL_NO = process.env.WECHAT_PAY_CERT_SERIAL_NO || "";
const PRIVATE_KEY_PEM = process.env.WECHAT_PAY_PRIVATE_KEY_PEM || "";
const APPID = process.env.WECHAT_MINIPROGRAM_APP_ID || "";

/** mock 模式开关 */
export const PAY_MOCK_MODE =
  process.env.WECHAT_PAY_MOCK !== "false" &&
  (!MCH_ID || !API_V3_KEY || !CERT_SERIAL_NO || !PRIVATE_KEY_PEM);

export interface UnifiedOrderInput {
  orderId: string;
  amount: number; // 单位：分（¥1 = 100）
  description: string;
  openid: string;
  /** 通知 URL（支付回调），可选 */
  notifyUrl?: string;
}

export interface UnifiedOrderResult {
  prepay_id: string;
}

export interface PaymentSignParams {
  timeStamp: string;
  nonceStr: string;
  package: string; // "prepay_id=xxx"
  signType: "RSA";
  paySign: string;
}

/**
 * 创建统一下单（JSAPI）
 *
 * 真实：POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi
 * mock：返回 fake prepay_id
 */
export async function createUnifiedOrder(
  input: UnifiedOrderInput,
): Promise<UnifiedOrderResult> {
  if (PAY_MOCK_MODE) {
    return { prepay_id: `mock_prepay_${input.orderId}_${Date.now()}` };
  }

  const url = "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi";
  const body = {
    appid: APPID,
    mchid: MCH_ID,
    description: input.description,
    out_trade_no: input.orderId,
    notify_url: input.notifyUrl || "https://ziwei.app/api/payment/wx-notify",
    amount: { total: input.amount, currency: "CNY" },
    payer: { openid: input.openid },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Wechatpay-Serial": CERT_SERIAL_NO,
      Authorization: buildV3AuthHeader("POST", "/v3/pay/transactions/jsapi", JSON.stringify(body)),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { prepay_id?: string; message?: string };
  if (!data.prepay_id) {
    throw new Error(`微信统一下单失败: ${data.message || res.statusText}`);
  }
  return { prepay_id: data.prepay_id };
}

/**
 * 生成 wx.requestPayment 所需的签名参数
 *
 * 真实：RSA-SHA256 签名 (appId\ntimestamp\nnonceStr\npackage\n)
 * mock：返回 fake paySign
 */
export function signPaymentParams(prepayId: string): PaymentSignParams {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = randomBytes(16).toString("hex");
  const pkg = `prepay_id=${prepayId}`;

  if (PAY_MOCK_MODE) {
    return {
      timeStamp,
      nonceStr,
      package: pkg,
      signType: "RSA",
      paySign: "mock_sign_" + crypto.createHash("sha256").update(pkg).digest("hex").slice(0, 32),
    };
  }

  const message = `${APPID}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const sign = crypto
    .createSign("RSA-SHA256")
    .update(message)
    .sign(PRIVATE_KEY_PEM, "base64");

  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: "RSA",
    paySign: sign,
  };
}

/**
 * 当前是否为 mock 模式
 */
export function isWechatPayMockMode(): boolean {
  return PAY_MOCK_MODE;
}

// ─── V3 签名（真实模式才用到） ──────────────────────────────────────────────

function buildV3AuthHeader(method: string, url: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");

  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${bodyHash}\n`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(message)
    .sign(PRIVATE_KEY_PEM, "base64");

  return `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${CERT_SERIAL_NO}",signature="${signature}"`;
}
