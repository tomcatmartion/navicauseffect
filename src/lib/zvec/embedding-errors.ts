/**
 * 将厂商返回的 status_msg / 英文错误转为可操作的说明（计费、密钥、参数等）。
 */

export function enrichEmbeddingBusinessMessage(
  statusCode: number,
  statusMsg: string
): string {
  const m = statusMsg.trim() || `status_code=${statusCode}`;
  const low = m.toLowerCase();

  if (/insufficient\s+balance|余额不足|欠费/.test(low)) {
    return (
      `${m}\n\n` +
      `说明：这是服务商账户**余额/套餐**问题，与程序逻辑无关。请到对应平台（如 MiniMax 控制台）充值、购买资源包或更换有余额的 API Key 后再试。`
    );
  }

  if (
    /invalid\s+api\s*key|unauthorized|401|api\s*key\s*invalid|认证失败|密钥/.test(
      low
    )
  ) {
    return (
      `${m}\n\n` +
      `说明：请检查后台填写的 API Key 是否正确、是否已开通 Embedding 能力且未过期。`
    );
  }

  if (
    /invalid\s+params|missing\s+required|binding:/.test(low) ||
    /参数|缺少/.test(m)
  ) {
    return (
      `${m}\n\n` +
      `说明：MiniMax 常见为缺少 **Group ID**：请在管理后台「Embedding」对应维度填写 **Group ID**（会写入请求体 \`group_id\`）。另请核对 Model 为 **Embedding 模型**、Base URL 与官方文档一致；若走 OpenAI 兼容网关可设 EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY=1。`
    );
  }

  if (/rate\s*limit|429|限流|频率/.test(low)) {
    return `${m}\n\n说明：触发限流，请稍后再试或降低并发/联系厂商提额。`;
  }

  if (/model|not\s+found|不存在|无权限/.test(low)) {
    return `${m}\n\n说明：请确认 Model ID 为** Embedding 模型名**（非对话模型），且账号有权调用。`;
  }

  return m;
}

/**
 * 对 OpenAI 形态 HTTP 错误里的 message 做同样增强（如余额类英文提示）。
 */
export function enrichOpenAiStyleEmbeddingErrorMessage(message: string): string {
  const m = message.trim();
  if (!m) return message;
  const low = m.toLowerCase();
  if (/insufficient_quota|insufficient\s+balance|billing|余额|额度/.test(low)) {
    return (
      `${m}\n\n` +
      `说明：账户计费/额度不足，请到服务商控制台检查账单与套餐。`
    );
  }
  return m;
}
