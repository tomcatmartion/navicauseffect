/** 是否允许使用模拟支付（开发环境或显式开启） */
export function isMockPaymentEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.ENABLE_MOCK_PAYMENT === "true";
}
