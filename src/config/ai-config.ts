/**
 * AI provider config resolution
 *
 * Resolution chain (highest to lowest priority):
 * 1. --provider flag
 * 2. AI_PROVIDER env var
 * 3. Config file (~/.config/commit-critic/config.json)
 * 4. Default: openai
 *
 * Supports: openai, openrouter, lmstudio, vllm, ollama
 */

import type { AIConfig, ProviderSpecificConfig } from '../types/config';

/**
 * Resolve AI configuration from all sources.
 */
export function resolveAIConfig(_overrides?: Partial<AIConfig>): AIConfig {
  // TODO: Implement config resolution
  return {
    provider: 'openai',
    model: 'gpt-4.1',
    strictMode: false,
    temperature: 0.1,
    maxTokens: 4096,
    maxRetries: 2,
    fallbackChain: [],
  };
}

/**
 * Resolve provider-specific config (API keys, base URLs).
 */
export function resolveProviderConfig(): ProviderSpecificConfig {
  // TODO: Implement — read from env vars
  return {};
}

/**
 * Validate AI config and return error if invalid.
 */
export function validateAIConfig(_config: AIConfig): string | null {
  // TODO: Implement validation
  return null;
}
