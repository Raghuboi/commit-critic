/**
 * AI provider config resolution
 *
 * Resolution chain (highest to lowest priority):
 * 1. --provider flag
 * 2. AI_PROVIDER env var
 * 3. Default: openai
 *
 * Supports: openai, openrouter, lmstudio, vllm, ollama
 */

import { getEnv, getEnvBool, getEnvNumber } from '../utils/env';
import type { AIConfig, AIProvider, ProviderSpecificConfig } from '../types/config';

const VALID_PROVIDERS: Set<string> = new Set(['openai', 'openrouter', 'lmstudio', 'vllm', 'ollama']);

const KEY_MAP: Record<string, keyof ProviderSpecificConfig> = {
  'OPENAI_API_KEY': 'openaiApiKey',
  'OPENROUTER_API_KEY': 'openrouterApiKey',
  'LM_STUDIO_BASE_URL': 'lmstudioBaseUrl',
  'VLLM_BASE_URL': 'vllmBaseUrl',
  'VLLM_API_KEY': 'vllmApiKey',
  'OLLAMA_BASE_URL': 'ollamaBaseUrl',
};

const PROVIDER_KEYS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  lmstudio: [],
  vllm: ['VLLM_API_KEY'],
  ollama: [],
};

/**
 * Resolve AI configuration from all sources.
 */
export function resolveAIConfig(overrides?: Partial<AIConfig> & { provider?: string }): AIConfig {
  const providerRaw = overrides?.provider ?? getEnv('AI_PROVIDER', 'openai');
  const provider: AIProvider = VALID_PROVIDERS.has(providerRaw) ? providerRaw as AIProvider : 'openai';
  const model = overrides?.model ?? getEnv('AI_MODEL', 'gpt-4.1');

  return {
    provider,
    model,
    strictMode: overrides?.strictMode ?? getEnvBool('AI_STRICT_MODE', false),
    temperature: overrides?.temperature ?? getEnvNumber('AI_TEMPERATURE', 0.1),
    maxTokens: overrides?.maxTokens ?? getEnvNumber('AI_MAX_TOKENS', 4096),
    maxRetries: overrides?.maxRetries ?? getEnvNumber('AI_MAX_RETRIES', 2),
  };
}

/**
 * Resolve provider-specific config (API keys, base URLs).
 */
export function resolveProviderConfig(): ProviderSpecificConfig {
  return {
    openaiApiKey: getEnv('OPENAI_API_KEY'),
    openrouterApiKey: getEnv('OPENROUTER_API_KEY'),
    lmstudioBaseUrl: getEnv('LM_STUDIO_BASE_URL'),
    vllmBaseUrl: getEnv('VLLM_BASE_URL'),
    vllmApiKey: getEnv('VLLM_API_KEY'),
    ollamaBaseUrl: getEnv('OLLAMA_BASE_URL'),
  };
}

/**
 * Validate AI config and return error if invalid.
 * Returns null if valid.
 */
export function validateAIConfig(config: AIConfig): string | null {
  const keys = PROVIDER_KEYS[config.provider] ?? [];
  const providerConfig = resolveProviderConfig();

  for (const key of keys) {
    const val = providerConfig[KEY_MAP[key]];
    if (!val) {
      return `Missing ${key} for provider "${config.provider}". Set the environment variable or use --no-llm for offline mode.`;
    }
  }

  return null;
}

/**
 * Mask an API key for display.
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 3) + '...' + key.slice(-4);
}
