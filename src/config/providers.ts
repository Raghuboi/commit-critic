/**
 * Provider metadata shared by setup, doctor, config validation, and LLM calls.
 *
 * Public provider surface stays small: openai, openrouter, local.
 * Local server presets are accepted as aliases for ergonomics.
 */

import type { AIProvider, AIProviderInput, ProviderSpecificConfig } from '../types/config';

export interface ProviderDefinition {
  name: AIProviderInput;
  runtimeProvider: AIProvider;
  label: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl: string;
  supportsStructuredOutputs: boolean;
  apiKeyEnv?: string;
  apiKeyConfigKey?: keyof ProviderSpecificConfig;
  apiKeyRequired: boolean;
  baseUrlEnv?: string;
  baseUrlConfigKey?: keyof ProviderSpecificConfig;
  headers?: Record<string, string>;
}

export const PROVIDER_REGISTRY = {
  openai: {
    name: 'openai',
    runtimeProvider: 'openai',
    label: 'OpenAI',
    description: 'OpenAI API (requires API key)',
    defaultModel: 'gpt-4.1',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsStructuredOutputs: true,
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyConfigKey: 'openaiApiKey',
    apiKeyRequired: true,
  },
  openrouter: {
    name: 'openrouter',
    runtimeProvider: 'openrouter',
    label: 'OpenRouter',
    description: 'OpenRouter API (requires API key)',
    defaultModel: 'anthropic/claude-sonnet-4',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportsStructuredOutputs: true,
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiKeyConfigKey: 'openrouterApiKey',
    apiKeyRequired: true,
    headers: {
      'HTTP-Referer': 'https://github.com/commit-critic',
      'X-Title': 'commit-critic',
    },
  },
  local: {
    name: 'local',
    runtimeProvider: 'local',
    label: 'Local OpenAI-compatible server',
    description: 'Any local server with /v1/completions and /v1/models',
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:8081/v1',
    supportsStructuredOutputs: false,
    apiKeyEnv: 'LOCAL_API_KEY',
    apiKeyConfigKey: 'localApiKey',
    apiKeyRequired: false,
    baseUrlEnv: 'LOCAL_BASE_URL',
    baseUrlConfigKey: 'localBaseUrl',
  },
  llamacpp: {
    name: 'llamacpp',
    runtimeProvider: 'local',
    label: 'llama.cpp local server',
    description: 'Local llama.cpp OpenAI-compatible server',
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:8081/v1',
    supportsStructuredOutputs: false,
    apiKeyEnv: 'LOCAL_API_KEY',
    apiKeyConfigKey: 'localApiKey',
    apiKeyRequired: false,
    baseUrlEnv: 'LLAMACPP_BASE_URL',
    baseUrlConfigKey: 'localBaseUrl',
  },
  lmstudio: {
    name: 'lmstudio',
    runtimeProvider: 'local',
    label: 'LM Studio local server',
    description: 'Local LM Studio OpenAI-compatible server',
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:1234/v1',
    supportsStructuredOutputs: false,
    apiKeyEnv: 'LOCAL_API_KEY',
    apiKeyConfigKey: 'localApiKey',
    apiKeyRequired: false,
    baseUrlEnv: 'LM_STUDIO_BASE_URL',
    baseUrlConfigKey: 'localBaseUrl',
  },
  vllm: {
    name: 'vllm',
    runtimeProvider: 'local',
    label: 'vLLM local server',
    description: 'Local or hosted vLLM OpenAI-compatible server',
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:8000/v1',
    supportsStructuredOutputs: false,
    apiKeyEnv: 'VLLM_API_KEY',
    apiKeyConfigKey: 'localApiKey',
    apiKeyRequired: false,
    baseUrlEnv: 'VLLM_BASE_URL',
    baseUrlConfigKey: 'localBaseUrl',
  },
  ollama: {
    name: 'ollama',
    runtimeProvider: 'local',
    label: 'Ollama local server',
    description: 'Local Ollama OpenAI-compatible server',
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:11434/v1',
    supportsStructuredOutputs: false,
    apiKeyEnv: 'LOCAL_API_KEY',
    apiKeyConfigKey: 'localApiKey',
    apiKeyRequired: false,
    baseUrlEnv: 'OLLAMA_BASE_URL',
    baseUrlConfigKey: 'localBaseUrl',
  },
} as const satisfies Record<AIProviderInput, ProviderDefinition>;

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_REGISTRY) as AIProviderInput[];
export const SETUP_PROVIDERS = ['local', 'openai', 'openrouter'] as const satisfies readonly AIProviderInput[];

export function isProviderInput(value: string): value is AIProviderInput {
  return value in PROVIDER_REGISTRY;
}

export function normalizeProviderInput(provider: string | undefined): AIProviderInput {
  if (!provider) return 'openai';
  return isProviderInput(provider) ? provider : 'openai';
}

export function getProviderDefinition(provider: string | undefined): ProviderDefinition {
  return PROVIDER_REGISTRY[normalizeProviderInput(provider)];
}

export function getRuntimeProvider(provider: string | undefined): AIProvider {
  return getProviderDefinition(provider).runtimeProvider;
}

export function getProviderBaseUrl(provider: string | undefined, config: ProviderSpecificConfig): string {
  const definition = getProviderDefinition(provider);
  if (definition.runtimeProvider !== 'local') return definition.defaultBaseUrl;
  return config.localBaseUrl ?? definition.defaultBaseUrl;
}

export function getProviderApiKey(provider: string | undefined, config: ProviderSpecificConfig): string | undefined {
  const definition = getProviderDefinition(provider);
  if (!definition.apiKeyConfigKey) return undefined;
  return config[definition.apiKeyConfigKey];
}

export function getRequiredProviderEnvVars(provider: string | undefined): string[] {
  const definition = getProviderDefinition(provider);
  return definition.apiKeyRequired && definition.apiKeyEnv ? [definition.apiKeyEnv] : [];
}

export function getLocalBaseUrlEnvVars(): string[] {
  return SUPPORTED_PROVIDERS
    .map((provider) => (PROVIDER_REGISTRY[provider] as ProviderDefinition).baseUrlEnv)
    .filter((value): value is string => Boolean(value));
}
