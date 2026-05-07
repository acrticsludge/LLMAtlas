import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Human-readable provider name for warnings (e.g. "DeepSeek (via OpenCode)", "Anthropic") */
  source: string;
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

/** Tracks whether the first-time credit warning has been shown */
let warned = false;

/**
 * Show a warning before the first LLM call, telling the user which provider
 * will be used and that it consumes credits.
 */
export function warnBeforeCall(config: LlmConfig): void {
  if (warned) return;
  warned = true;
  console.warn(`\n╔════════════════════════════════════════════════════╗`);
  console.warn(`║  LLMAtlas will use your API key to generate      ║`);
  console.warn(`║  module summaries. This will consume credits on  ║`);
  console.warn(`║  your ${config.source} account.                     ║`);
  console.warn(`╠════════════════════════════════════════════════════╣`);
  console.warn(`║  Model: ${config.model.padEnd(37)}║`);
  console.warn(`║  To disable: set LLMATLAS_API_KEY to skip         ║`);
  console.warn(`╚════════════════════════════════════════════════════╝\n`);
}

/**
 * Simple .env file loader — reads KEY=VALUE lines from .env files
 * without requiring the dotenv npm package.
 */
function tryLoadDotenv(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Only set if not already set (env vars take priority)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // File doesn't exist or can't be read — ignore
  }
}

/**
 * Detect LLM configuration from the user's environment.
 *
 * Detection order:
 *   0. .env files are loaded if present (project .env and .opencode/.env)
 *   1. LLMATLAS_API_KEY env var (explicit override)
 *   2. OpenCode config (.opencode/opencode.json) → reads provider + env var reference
 *   3. Common env vars: ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY
 *
 * If the key is for a non-OpenAI provider (Anthropic), `chatComplete` will
 * use the correct API format automatically.
 */
export function detectLlmConfig(): LlmConfig {
  // ── 0. Load .env files ───────────────────────────────────
  tryLoadDotenv(join(process.cwd(), '.env'));
  tryLoadDotenv(join(process.cwd(), '.opencode', '.env'));

  // ── 1. Explicit override ────────────────────────────────
  if (process.env.LLMATLAS_API_KEY) {
    return {
      apiKey: process.env.LLMATLAS_API_KEY,
      baseUrl: process.env.LLMATLAS_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.LLMATLAS_MODEL ?? 'deepseek-chat',
      source: 'LLMATLAS_API_KEY (explicit)',
    };
  }

  // ── 2. OpenCode config ──────────────────────────────────
  const openCodeConfig = tryReadOpenCodeConfig();
  if (openCodeConfig) {
    const envVarName = openCodeConfig.apiKeyEnvVar;
    const apiKey = process.env[envVarName];
    if (apiKey) {
      const baseUrl = openCodeConfig.baseUrl ?? 'https://api.openai.com/v1';
      return {
        apiKey,
        baseUrl,
        model: openCodeConfig.model,
        source: `${openCodeConfig.provider} (via OpenCode config)`,
      };
    }
  }

  // ── 3. Common env vars ──────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
      source: 'Anthropic (env: ANTHROPIC_API_KEY)',
    };
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.LLMATLAS_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.LLMATLAS_MODEL ?? 'deepseek-chat',
      source: 'DeepSeek (env: DEEPSEEK_API_KEY)',
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.LLMATLAS_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.LLMATLAS_MODEL ?? 'gpt-4o-mini',
      source: 'OpenAI (env: OPENAI_API_KEY)',
    };
  }

  throw new Error(
    'No API key found.\n' +
    '  • Run this in your project directory with one of these set:\n' +
    '    - DEEPSEEK_API_KEY     (if you use DeepSeek via OpenCode)\n' +
    '    - ANTHROPIC_API_KEY    (if you use Claude)\n' +
    '    - OPENAI_API_KEY       (if you use OpenAI)\n' +
    '    - LLMATLAS_API_KEY     (explicit override)\n' +
    '  • Or create a .env file in your project with one of the above.\n' +
    '  • If you already have a key set in OpenCode, add it to a .env file:\n' +
    '    echo DEEPSEEK_API_KEY=sk-your-key >> .env'
  );
}

/**
 * Try to read OpenCode's config to detect the user's AI provider.
 */
function tryReadOpenCodeConfig(): { provider: string; model: string; baseUrl?: string; apiKeyEnvVar: string } | null {
  const cwd = process.cwd();
  const paths: string[] = [];

  // Check project-level .opencode/opencode.json (or .opencode.old.json)
  const projectConfig = join(cwd, '.opencode', 'opencode.json');
  if (existsSync(projectConfig)) paths.push(projectConfig);
  const oldConfig = join(cwd, '.opencode', 'opencode.old.json');
  if (existsSync(oldConfig)) paths.push(oldConfig);

  // Check user-level config
  const userConfig = join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'opencode', 'opencode.json');
  if (existsSync(userConfig)) paths.push(userConfig);

  for (const configPath of paths) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // OpenCode config uses a "model" field and a provider map
      // e.g. model: "deepseek/deepseek-v4-flash"
      //      provider.deepseek.options.apiKey: "{env:DEEPSEEK_API_KEY}"
      const model = config.model;
      if (!model || typeof model !== 'string') continue;

      const providerName = model.split('/')[0]; // e.g. "deepseek" from "deepseek/model-name"
      const providerConfig = config.provider?.[providerName];
      if (!providerConfig) continue;

      // Find the API key env var from provider config
      const apiKeyRef = providerConfig.options?.apiKey;
      // The value might be "{env:DEEPSEEK_API_KEY}" or just a plain string
      let envVarName: string | null = null;
      if (typeof apiKeyRef === 'string') {
        const match = apiKeyRef.match(/\{env:([^}]+)\}/);
        envVarName = match ? match[1] : null;
      }

      if (!envVarName) continue;

      // Extract base URL if present
      let baseUrl = providerConfig.options?.baseURL;

      return {
        provider: providerName,
        model,
        baseUrl,
        apiKeyEnvVar: envVarName,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Send a chat completion request, automatically detecting the API format.
 * Supports OpenAI-compatible (DeepSeek, Groq, etc.) and Anthropic.
 */
export async function chatComplete(
  messages: LlmMessage[],
  config: LlmConfig,
  options?: { maxTokens?: number; signal?: AbortSignal }
): Promise<LlmResponse> {
  const isAnthropic = config.baseUrl.includes('anthropic.com');

  if (isAnthropic) {
    return chatCompleteAnthropic(messages, config, options);
  }

  // OpenAI-compatible format
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

/**
 * Send a chat completion to Anthropic's API (/v1/messages format).
 */
async function chatCompleteAnthropic(
  messages: LlmMessage[],
  config: LlmConfig,
  options?: { maxTokens?: number; signal?: AbortSignal }
): Promise<LlmResponse> {
  // Convert OpenAI-style messages to Anthropic format
  const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content);
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  // Anthropic's API uses a messages array with "user" / "assistant" roles
  // and a separate "system" parameter for system prompts
  const anthropicMessages = nonSystemMessages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user' as const,
    content: m.content,
  }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: options?.maxTokens ?? 2048,
    messages: anthropicMessages,
  };

  if (systemMessages.length > 0) {
    body.system = systemMessages.join('\n');
  }

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as {
    content: Array<{ text: string }>;
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = data.content?.map(c => c.text).join('\n') ?? '';

  return {
    content,
    model: data.model,
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  };
}
