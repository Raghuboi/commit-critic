/**
 * Config types
 */

/**
 * AI provider configuration.
 */
export interface AIConfig {
  /** Provider name: openai, openrouter, lmstudio, vllm, ollama */
  provider: string;
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
  /** Fallback chain: comma-separated provider:model pairs */
  fallbackChain: string[];
  /**
   * Internal: inject a mock model for testing.
   * When set, this model is used directly instead of resolving a provider.
   * @internal
   */
  __testModel?: import('@ai-sdk/provider').LanguageModelV4;
}

/**
 * Application configuration.
 */
export interface AppConfig {
  /** Config directory path */
  configDir: string;
  /** Output as JSON */
  jsonOutput: boolean;
  /** Verbose debug output */
  verbose: boolean;
  /** Disable colors */
  noColor: boolean;
}

/**
 * Resolved configuration (merged from all sources).
 */
export interface ResolvedConfig {
  ai: AIConfig;
  app: AppConfig;
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
