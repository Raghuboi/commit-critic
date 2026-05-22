/**
 * Config types
 */

/**
 * Supported AI providers.
 */
export type AIProvider = 'openai' | 'openrouter' | 'lmstudio' | 'vllm' | 'ollama';

/**
 * AI provider configuration.
 */
export interface AIConfig {
  /** Provider name */
  provider: AIProvider;
  /** Model ID within the provider */
  model: string;
  /** Fail fast on LLM errors */
  strictMode: boolean;
  /** Generation temperature (0-1) */
  temperature: number;
  /** Max output tokens */
  maxTokens: number;
  /** Max retry count */
  maxRetries: number;
  /**
   * Internal: inject a mock model for testing.
   * When set, this model is used directly instead of resolving a provider.
   * @internal
   */
  __testModel?: import('@ai-sdk/provider').LanguageModelV4;
}

/**
 * Provider-specific config.
 */
export interface ProviderSpecificConfig {
  openaiApiKey?: string;
  openrouterApiKey?: string;
  lmstudioBaseUrl?: string;
  vllmBaseUrl?: string;
  vllmApiKey?: string;
  ollamaBaseUrl?: string;
}
