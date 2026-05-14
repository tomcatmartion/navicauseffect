import { AIProvider, ChatMessage, ChatOptions } from "../types";

const DEFAULT_TIMEOUT_MS = 120_000;

export class ZhiPuProvider implements AIProvider {
  id = "zhipu";
  name = "智谱 ChatGLM";

  constructor(
    private apiKey: string,
    private baseUrl: string,
    private modelId: string
  ) {}

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          // 智谱深度思考模型：思考 token 不计入 max_tokens 限额，避免思考耗尽配额导致正式回答被截断
          thinking: { type: "enabled", budget_tokens: 32768 },
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ZhiPu API error: ${response.status}`);
      }

      return response.body!;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`AI 请求超时（${DEFAULT_TIMEOUT_MS / 1000}s），请检查网络或切换模型重试`);
      }
      throw err;
    }
  }

  async chatSync(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ZhiPu API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`AI 请求超时（${DEFAULT_TIMEOUT_MS / 1000}s），请检查网络或切换模型重试`);
      }
      throw err;
    }
  }
}
