export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** 单次流式请求总超时（含读流），默认见各 Provider */
  requestTimeoutMs?: number;
}

export interface AIProvider {
  id: string;
  name: string;
  chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ReadableStream<Uint8Array>>;
  chatSync(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export interface AIModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelId: string;
}
