import { AIProvider, ChatMessage, ChatOptions } from "../types";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ClaudeProvider implements AIProvider {
  id = "claude";
  name = "Claude";

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
      const systemMsg = messages.find((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.modelId,
          system: systemMsg?.content,
          messages: nonSystemMsgs.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      /** 跨 fetch chunk 保留半行，避免 JSON 被截断后整段丢弃 */
      let lineCarry = "";

      return new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read();
          lineCarry += decoder.decode(value ?? new Uint8Array(), { stream: !done });

          const processDataLine = (raw: string) => {
            const line = raw.replace(/\r$/, "");
            const t = line.trimStart();
            if (!t.toLowerCase().startsWith("data:")) return;
            const data = t.slice(5).trimStart();
            if (data === "[DONE]") return;
            try {
              const parsed = JSON.parse(data) as {
                type?: string;
                delta?: { text?: string };
              };
              if (parsed.type === "content_block_delta") {
                const chunk = parsed.delta?.text || "";
                if (!chunk) return;
                const sseData = `data: ${JSON.stringify({
                  choices: [{ delta: { content: chunk } }],
                })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
            } catch {
              // 半包 JSON，等待下一 chunk 与 lineCarry 拼接后再试
            }
          };

          if (done) {
            for (const line of lineCarry.split("\n")) {
              processDataLine(line);
            }
            lineCarry = "";
            controller.close();
            return;
          }

          const lines = lineCarry.split("\n");
          lineCarry = lines.pop() ?? "";
          for (const line of lines) {
            processDataLine(line);
          }
        },
      });
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
      const systemMsg = messages.find((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.modelId,
          system: systemMsg?.content,
          messages: nonSystemMsgs.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`AI 请求超时（${DEFAULT_TIMEOUT_MS / 1000}s），请检查网络或切换模型重试`);
      }
      throw err;
    }
  }
}
