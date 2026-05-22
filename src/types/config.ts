/**
 * AI provider configuration contracts.
 */

/** Public provider surface. */
export type AIProvider = 'openai' | 'openrouter' | 'local';

/** Backward-compatible aliases accepted from flags and env vars. */
export type AIProviderInput = AIProvider | 'lmstudio' | 'vllm' | 'ollama' | 'llamacpp';

/** AI provider configuration. */
export interface AIConfig {
  /** Canonical provider name used by the runtime. */
  provider: AIProvider;
  /** Original provider input after validation; aliases map to provider: "local". */
  requestedProvider?: AIProviderInput;
  /** Model ID within the provider. */
  model: string;
  /** Fail fast on LLM errors. */
  strictMode: boolean;
  /** Generation temperature (0-1). */
  temperature: number;
  /** Max output tokens. */
  maxTokens: number;
  /** Max retry count. */
  maxRetries: number;
  /** Abort slow LLM calls after this many milliseconds. */
  timeoutMs: number;
  /**
   * Internal: inject a mock model for testing.
   * When set, this model is used directly instead of resolving a provider.
   * @internal
   */
  __testModel?: import('@ai-sdk/provider').LanguageModelV4;
}

/** Provider-specific config. */
export interface ProviderSpecificConfig {
  openaiApiKey?: string;
  openrouterApiKey?: string;
  localBaseUrl?: string;
  localApiKey?: string;
}
