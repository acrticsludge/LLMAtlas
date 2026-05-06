export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Detect LLM configuration from environment.
 * Works with any OpenAI-compatible API (OpenAI, DeepSeek, Groq, etc.).
 * Order: LLMATLAS_API_KEY → DEEPSEEK_API_KEY → OPENAI_API_KEY
 */
export function detectLlmConfig(): LlmConfig {
  const key = process.env.LLMATLAS_API_KEY
    ?? process.env.DEEPSEEK_API_KEY
    ?? process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error(
      'No API key found. Set LLMATLAS_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY.'
    );
  }

  // Detect provider: DeepSeek uses OpenAI-compatible API
  const baseUrl = process.env.LLMATLAS_BASE_URL
    ?? (process.env.LLMATLAS_API_KEY || process.env.DEEPSEEK_API_KEY
      ? 'https://api.deepseek.com'
      : 'https://api.openai.com/v1');

  const model = process.env.LLMATLAS_MODEL
    ?? (process.env.LLMATLAS_API_KEY || process.env.DEEPSEEK_API_KEY
      ? 'deepseek-chat'
      : 'gpt-4o-mini');

  return { apiKey: key, baseUrl, model };
}

/**
 * Send a chat completion request to an OpenAI-compatible API.
 */
export async function chatComplete(
  messages: LlmMessage[],
  config: LlmConfig,
  options?: { maxTokens?: number; signal?: AbortSignal }
): Promise<LlmResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: options?.maxTokens ?? 2048,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LLM API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? '',
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}
