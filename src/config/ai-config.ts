/**
 * AI provider config resolution.
 *
 * Public provider surface:
 * - openai: OpenAI API
 * - openrouter: OpenRouter API
 * - local: any OpenAI-compatible local server
 *
 * Backward-compatible aliases accepted from flags/env:
 * lmstudio, vllm, ollama, llamacpp -> local
 */

import { getEnv, getEnvBool, getEnvNumber } from '../utils/env';
import type { AIConfig, AIProvider, AIProviderInput, ProviderSpecificConfig } from '../types/config';
import {
  getLocalBaseUrlEnvVars,
  getProviderApiKey,
  getProviderDefinition,
  getRequiredProviderEnvVars,
  getRuntimeProvider,
  normalizeProviderInput as normalizeProviderInputFromRegistry,
} from './providers';

type AIConfigOverrides = Omit<Partial<AIConfig>, 'provider'> & { provider?: string };

/** Resolve a raw provider string to a supported input value. */
export function normalizeProviderInput(provider: string | undefined): AIProviderInput {
  return normalizeProviderInputFromRegistry(provider);
}

/** Resolve a raw provider string to the canonical runtime provider. */
export function normalizeProvider(provider: string | undefined): AIProvider {
  return getRuntimeProvider(provider);
}

/** Resolve AI configuration from flags and environment variables. */
export function resolveAIConfig(overrides?: AIConfigOverrides): AIConfig {
  const requestedProvider = normalizeProviderInput(overrides?.provider ?? getEnv('AI_PROVIDER', 'openai'));
  const provider = normalizeProvider(requestedProvider);
  const model = overrides?.model ?? getEnv('AI_MODEL', getProviderDefinition(requestedProvider).defaultModel);

  return {
    provider,
    requestedProvider,
    model,
    strictMode: overrides?.strictMode ?? getEnvBool('AI_STRICT_MODE', false),
    temperature: overrides?.temperature ?? getEnvNumber('AI_TEMPERATURE', 0.1),
    maxTokens: overrides?.maxTokens ?? getEnvNumber('AI_MAX_TOKENS', 4096),
    maxRetries: overrides?.maxRetries ?? getEnvNumber('AI_MAX_RETRIES', 2),
    timeoutMs: overrides?.timeoutMs ?? getEnvNumber('AI_TIMEOUT_MS', 60000),
    __testModel: overrides?.__testModel,
  };
}

/** Resolve provider-specific config (API keys and base URLs). */
export function resolveProviderConfig(requestedProvider = getEnv('AI_PROVIDER', 'openai')): ProviderSpecificConfig {
  const providerInput = normalizeProviderInput(requestedProvider);
  const providerDefinition = getProviderDefinition(providerInput);
  const aliasBaseUrl = providerDefinition.baseUrlEnv ? getEnv(providerDefinition.baseUrlEnv) : undefined;
  const legacyBaseUrl = getLocalBaseUrlEnvVars().map((key) => getEnv(key)).find(Boolean);

  return {
    openaiApiKey: getEnv('OPENAI_API_KEY') ?? (normalizeProvider(providerInput) === 'openai' ? getEnv('AI_API_KEY') : undefined),
    openrouterApiKey: getEnv('OPENROUTER_API_KEY') ?? (normalizeProvider(providerInput) === 'openrouter' ? getEnv('AI_API_KEY') : undefined),
    localBaseUrl: getEnv('AI_BASE_URL') ?? getEnv('LOCAL_BASE_URL') ?? aliasBaseUrl ?? legacyBaseUrl ?? providerDefinition.defaultBaseUrl,
    localApiKey: getEnv('LOCAL_API_KEY') ?? (normalizeProvider(providerInput) === 'local' ? getEnv('AI_API_KEY') : undefined) ?? getEnv('VLLM_API_KEY'),
  };
}

/** Validate AI config and return an actionable error, or null if valid. */
export function validateAIConfig(config: AIConfig): string | null {
  const providerConfig = resolveProviderConfig(config.requestedProvider);

  for (const key of getRequiredProviderEnvVars(config.requestedProvider ?? config.provider)) {
    if (!getProviderApiKey(config.requestedProvider ?? config.provider, providerConfig)) {
      return `Missing ${key} for provider "${config.requestedProvider ?? config.provider}". Configure an LLM provider with \`commit-critic setup\` or set the environment variable. Use --no-llm only when you need the offline fallback.`;
    }
  }

  if (config.provider === 'local') {
    const baseUrl = providerConfig.localBaseUrl;
    if (!isValidHttpUrl(baseUrl)) {
      return `Invalid local LLM base URL "${baseUrl ?? ''}". Use an http(s) URL such as http://localhost:8081/v1.`;
    }
  }

  return null;
}

function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Mask an API key for display. */
export function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 3) + '...' + key.slice(-4);
}
