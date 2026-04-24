// Generic AI provider abstraction
// Supports OpenAI, Anthropic (via compatible endpoint), DeepSeek, Ollama, etc.

export interface AIConfig {
  provider: string;  // "openai" | "anthropic" | "deepseek" | "ollama" | "custom"
  model: string;
  apiKey: string;
  baseUrl?: string;
}

// Default base URLs per provider
const PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  ollama: "http://localhost:11434/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  moonshot: "https://api.moonshot.cn/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

export function getAIConfig(): AIConfig {
  return {
    provider: process.env.AI_PROVIDER || "openai",
    model: process.env.AI_MODEL || "gpt-4o-mini",
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: process.env.AI_BASE_URL || undefined,
  };
}

function getBaseUrl(config: AIConfig): string {
  if (config.baseUrl) return config.baseUrl;
  return PROVIDER_URLS[config.provider] || PROVIDER_URLS.openai;
}

function getHeaders(config: AIConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.provider === "anthropic") {
    headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return headers;
}

// For Anthropic we need to convert to their message format
function isAnthropicNative(config: AIConfig): boolean {
  return config.provider === "anthropic" && !config.baseUrl;
}

// Streaming chat completion (OpenAI-compatible format)
export async function* streamChatCompletion(
  config: AIConfig,
  messages: { role: string; content: string }[],
  options?: { maxTokens?: number; temperature?: number }
): AsyncGenerator<string, void, unknown> {
  const baseUrl = getBaseUrl(config);

  if (isAnthropicNative(config)) {
    // Anthropic native API
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: getHeaders(config),
      body: JSON.stringify({
        model: config.model,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature ?? 0.7,
        messages: messages.filter(m => m.role !== "system").map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
        system: messages.find(m => m.role === "system")?.content,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch {}
        }
      }
    }
  } else {
    // OpenAI-compatible API (works for OpenAI, DeepSeek, Ollama, Qwen, Moonshot, etc.)
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: getHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  }
}

// Non-streaming chat completion with JSON response
export async function chatCompletion(
  config: AIConfig,
  messages: { role: string; content: string }[],
  options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const baseUrl = getBaseUrl(config);

  if (isAnthropicNative(config)) {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: getHeaders(config),
      body: JSON.stringify({
        model: config.model,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature ?? 0.3,
        messages: messages.filter(m => m.role !== "system").map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
        system: messages.find(m => m.role === "system")?.content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } else {
    const body: {
      model: string;
      messages: { role: string; content: string }[];
      max_tokens: number;
      temperature: number;
      response_format?: { type: "json_object" };
    } = {
      model: config.model,
      messages,
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature ?? 0.3,
    };

    if (options?.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: getHeaders(config),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
