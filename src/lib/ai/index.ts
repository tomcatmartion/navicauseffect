import { AIProvider, AIModelConfig } from "./types";
import { DeepSeekProvider } from "./providers/deepseek";
import { ZhiPuProvider } from "./providers/zhipu";
import { QwenProvider } from "./providers/qwen";
import { ClaudeProvider } from "./providers/claude";
import { MiniMaxProvider } from "./providers/minimax";

/** OpenAI 兼容 Chat Completions + SSE（与 DeepSeek 请求格式一致） */
function openAiCompatibleChat(c: AIModelConfig): AIProvider {
  return new DeepSeekProvider(c.apiKey, c.baseUrl, c.modelId);
}

const providerFactories: Record<
  string,
  (config: AIModelConfig) => AIProvider
> = {
  deepseek: (c) => new DeepSeekProvider(c.apiKey, c.baseUrl, c.modelId),
  /** DeepSeek v4 等：Anthropic Messages API 兼容端点（如 https://api.deepseek.com/anthropic） */
  "deepseek-anthropic": (c) => new ClaudeProvider(c.apiKey, c.baseUrl, c.modelId),
  zhipu: (c) => new ZhiPuProvider(c.apiKey, c.baseUrl, c.modelId),
  qwen: (c) => new QwenProvider(c.apiKey, c.baseUrl, c.modelId),
  claude: (c) => new ClaudeProvider(c.apiKey, c.baseUrl, c.modelId),
  minimax: (c) => new MiniMaxProvider(c.apiKey, c.baseUrl, c.modelId),
  openai: openAiCompatibleChat,
  google: openAiCompatibleChat,
  doubao: openAiCompatibleChat,
};

export function createProvider(config: AIModelConfig): AIProvider {
  const factory = providerFactories[config.provider];
  if (!factory) {
    throw new Error(`Unknown AI provider: ${config.provider}`);
  }
  return factory(config);
}

export { type AIProvider, type ChatMessage, type ChatOptions } from "./types";
