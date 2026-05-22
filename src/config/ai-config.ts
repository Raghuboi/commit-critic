/**
 * AI provider config resolution.
 *
 * Provider names are resolved directly from the provider registry. Local server
 * presets (`local`, `lmstudio`, `vllm`, `ollama`, `llamacpp`) stay distinct so
 * defaults, diagnostics, and runtime provider construction match the user's
 * selected provider.
 */

import { getEnv, getEnvBool, getEnvNumber } from '../utils/env';
import type { AIConfig, AIProvider, ProviderSpecificConfig } from '../types/config';
import {
  getProviderApiKey,
  getProviderDefinition,
  getRequiredProviderEnvVars,
  isLocalProvider,
  normalizeProvider as normalizeProviderFromRegistry,
} from './providers';

type AIConfigOverrides = Omit<Partial<AIConfig>, 'provider'> & { provider?: string };

/** Resolve a raw provider string to a supported provider value. */
export function normalizeProvider(provider: string | undefined): AIProvider {
  return normalizeProviderFromRegistry(provider);
}

/** Resolve AI configuration from flags and environment variables. */
export function resolveAIConfig(overrides?: AIConfigOverrides): AIConfig {
  const provider = normalizeProvider(overrides?.provider ?? getEnv('AI_PROVIDER', 'openai'));
  const model = overrides?.model ?? getEnv('AI_MODEL', getProviderDefinition(provider).defaultModel);

  return {
    provider,
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
export function resolveProviderConfig(providerName = getEnv('AI_PROVIDER', 'openai')): ProviderSpecificConfig {
  const provider = normalizeProvider(providerName);
  const definition = getProviderDefinition(provider);
  const providerBaseUrl = definition.baseUrlEnv ? getEnv(definition.baseUrlEnv) : undefined;

  return {
    openaiApiKey: getEnv('OPENAI_API_KEY') ?? (provider === 'openai' ? getEnv('AI_API_KEY') : undefined),
    openaiBaseUrl: provider === 'openai' ? providerBaseUrl ?? getEnv('AI_BASE_URL') ?? definition.defaultBaseUrl : undefined,
    openrouterApiKey: getEnv('OPENROUTER_API_KEY') ?? (provider === 'openrouter' ? getEnv('AI_API_KEY') : undefined),
    localBaseUrl: providerBaseUrl ?? getEnv('AI_BASE_URL') ?? definition.defaultBaseUrl,
    localApiKey: getEnv('LOCAL_API_KEY') ?? (isLocalProvider(provider) ? getEnv('AI_API_KEY') : undefined) ?? getEnv('VLLM_API_KEY'),
  };
}

/** Validate AI config and return an actionable error, or null if valid. */
export function validateAIConfig(config: AIConfig): string | null {
  const providerConfig = resolveProviderConfig(config.provider);

  for (const key of getRequiredProviderEnvVars(config.provider)) {
    if (!getProviderApiKey(config.provider, providerConfig)) {
      return `Missing ${key} for provider "${config.provider}". Configure an LLM provider with \`commit-critic setup\` or set the environment variable. Use --no-llm only when you need the offline fallback.`;
    }
  }

  const definition = getProviderDefinition(config.provider);
  if (definition.baseUrlConfigKey) {
    const baseUrl = providerConfig[definition.baseUrlConfigKey];
    if (!isValidHttpUrl(baseUrl)) {
      return `Invalid LLM base URL "${baseUrl ?? ''}". Use an http(s) URL such as https://api.example.com/v1.`;
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
