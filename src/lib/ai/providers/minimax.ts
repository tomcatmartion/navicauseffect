import { AIProvider, ChatMessage, ChatOptions } from "../types";

const DEFAULT_TIMEOUT_MS = 120_000;

/** MiniMax 开放平台 OpenAI 兼容接口（https://api.minimaxi.com/v1） */
export class MiniMaxProvider implements AIProvider {
  id = "minimax";
  name = "MiniMax";

  constructor(
    private apiKey: string,
    private baseUrl: string,
    private modelId: string
  ) {}

  private endpoint() {
    const base = this.baseUrl.replace(/\/$/, "");
    return `${base}/chat/completions`;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(this.endpoint(), {
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
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(
          `MiniMax API error: ${response.status}${errText ? ` ${errText.slice(0, 200)}` : ""}`
        );
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
      const response = await fetch(this.endpoint(), {
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
        const errText = await response.text().catch(() => "");
        throw new Error(
          `MiniMax API error: ${response.status}${errText ? ` ${errText.slice(0, 200)}` : ""}`
        );
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
