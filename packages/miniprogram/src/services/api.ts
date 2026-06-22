/**
 * 小程序 API 封装 —— 等价 H5 端 src/lib/api-client.ts
 *
 * 使用 Taro.request（小程序原生网络 API），不依赖 fetch（小程序不支持）。
 *
 * 关键差异：
 * 1. SSE 在小程序中不支持，AI 对话需用 WebSocket 或短轮询
 *    （详见 src/services/chat-stream.ts）
 * 2. 微信支付用 wx.requestPayment，签名由后端返回
 * 3. 分享用 <button open-type="share"> 或 Page.onShareAppMessage
 */

import Taro from "@tarojs/taro";

const BASE_URL = "https://ziwei.app"; // 与 config/prod.ts 的 API_BASE 对齐

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  // 从本地存储读 token（小程序登录后由后端颁发）
  const token = Taro.getStorageSync("auth_token");

  const res = await Taro.request({
    url: path.startsWith("http") ? path : `${BASE_URL}${path}`,
    method,
    data: body,
    header: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (res.statusCode >= 400) {
    const message =
      (res.data as { error?: string })?.error ||
      `API ${res.statusCode} ${res.errMsg || ""}`;
    throw new ApiError(message, res.statusCode, res.data);
  }

  return res.data as T;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path, { method: "GET" }),
  post: <T = unknown>(path: string, body?: Record<string, unknown>) =>
    request<T>(path, { method: "POST", body }),
  put: <T = unknown>(path: string, body?: Record<string, unknown>) =>
    request<T>(path, { method: "PUT", body }),
  patch: <T = unknown>(path: string, body?: Record<string, unknown>) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * 微信登录：code → 后端换 token
 * 后端需新增 /api/auth/wechat-miniprogram 路由（不在本次范围）
 */
export async function wechatLogin(): Promise<string> {
  const { code } = await Taro.login();
  const res = await api.post<{ token: string; user: unknown }>(
    "/api/auth/wechat-miniprogram",
    { code },
  );
  Taro.setStorageSync("auth_token", res.token);
  return res.token;
}

/**
 * 微信支付：调后端创建订单 → wx.requestPayment
 */
export async function requestPayment(planId: string): Promise<boolean> {
  const order = await api.post<{
    timeStamp: string;
    nonceStr: string;
    package: string;
    paySign: string;
  }>("/api/payment/wx-minipay", { planId });

  try {
    await Taro.requestPayment({
      timeStamp: order.timeStamp,
      nonceStr: order.nonceStr,
      package: order.package,
      signType: "RSA" as keyof Taro.requestPayment.SignType,
      paySign: order.paySign,
    });
    Taro.showToast({ title: "开通成功", icon: "success" });
    return true;
  } catch {
    Taro.showToast({ title: "支付取消", icon: "none" });
    return false;
  }
}
