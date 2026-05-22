/**
 * Provider metadata shared by setup, doctor, config validation, and LLM calls.
 *
 * The registry is the single source of truth for provider names, defaults, API
 * keys, base URLs, and whether the AI SDK should use OpenAI's first-party
 * provider or an OpenAI-compatible transport.
 */

import type { AIProvider, ProviderSpecificConfig } from '../types/config';

export type ProviderTransport = 'openai' | 'compatible-chat' | 'compatible-completion';

export interface ProviderDefinition {
  name: AIProvider;
  transport: ProviderTransport;
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
    transport: 'openai',
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
    transport: 'compatible-chat',
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
    transport: 'compatible-completion',
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
    transport: 'compatible-completion',
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
    transport: 'compatible-completion',
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
    transport: 'compatible-completion',
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
    transport: 'compatible-completion',
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
} as const satisfies Record<AIProvider, ProviderDefinition>;

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_REGISTRY) as AIProvider[];
export const SETUP_PROVIDERS = ['local', 'openai', 'openrouter'] as const satisfies readonly AIProvider[];

export function isProvider(value: string): value is AIProvider {
  return value in PROVIDER_REGISTRY;
}

export function normalizeProvider(provider: string | undefined): AIProvider {
  if (!provider) return 'openai';
  return isProvider(provider) ? provider : 'openai';
}

export function getProviderDefinition(provider: string | undefined): ProviderDefinition {
  return PROVIDER_REGISTRY[normalizeProvider(provider)];
}

export function isLocalProvider(provider: string | undefined): boolean {
  return getProviderDefinition(provider).transport === 'compatible-completion';
}

export function getProviderBaseUrl(provider: string | undefined, config: ProviderSpecificConfig): string {
  const definition = getProviderDefinition(provider);
  if (!definition.baseUrlConfigKey) return definition.defaultBaseUrl;
  return config[definition.baseUrlConfigKey] ?? definition.defaultBaseUrl;
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
    .map((provider) => getProviderDefinition(provider).baseUrlEnv)
    .filter((value): value is string => Boolean(value));
}
