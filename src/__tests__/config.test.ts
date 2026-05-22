/**
 * Config resolution tests.
 */

import { test, expect, beforeEach, afterEach } from 'bun:test';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig, normalizeProvider } from '../config/ai-config';
import { getProviderBaseUrl } from '../config/providers';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith('AI_') ||
      key.startsWith('OPENAI_') ||
      key.startsWith('OPENROUTER_') ||
      key.startsWith('LOCAL_') ||
      key.startsWith('LM_') ||
      key.startsWith('VLLM_') ||
      key.startsWith('OLLAMA_') ||
      key.startsWith('LLAMACPP_')
    ) {
      delete process.env[key];
    }
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('resolves AI config from env vars', () => {
  process.env.AI_PROVIDER = 'openrouter';
  process.env.AI_MODEL = 'anthropic/claude-sonnet-4';
  process.env.AI_TEMPERATURE = '0.5';
  process.env.AI_MAX_TOKENS = '2048';
  process.env.AI_TIMEOUT_MS = '120000';

  const config = resolveAIConfig();

  expect(config.provider).toBe('openrouter');
  expect(config.model).toBe('anthropic/claude-sonnet-4');
  expect(config.temperature).toBe(0.5);
  expect(config.maxTokens).toBe(2048);
  expect(config.timeoutMs).toBe(120000);
});

test('resolves provider directly from flags', () => {
  process.env.AI_PROVIDER = 'openai';

  const config = resolveAIConfig({ provider: 'ollama', model: 'llama3.2' });

  expect(config.provider).toBe('ollama');
  expect(config.model).toBe('llama3.2');
});

test('validates missing API keys for hosted providers', () => {
  process.env.AI_PROVIDER = 'openai';

  const config = resolveAIConfig();
  const err = validateAIConfig(config);

  expect(err).toContain('OPENAI_API_KEY');
});

test('local provider works without API key and resolves base URL', () => {
  process.env.AI_PROVIDER = 'local';
  process.env.AI_MODEL = 'qwen3.6';
  process.env.AI_BASE_URL = 'http://localhost:8081/v1';

  const config = resolveAIConfig();
  const err = validateAIConfig(config);
  const provider = resolveProviderConfig(config.provider);

  expect(config.provider).toBe('local');
  expect(config.model).toBe('qwen3.6');
  expect(err).toBeNull();
  expect(provider.localBaseUrl).toBe('http://localhost:8081/v1');
});

test('local provider validates base URL shape', () => {
  process.env.AI_PROVIDER = 'local';
  process.env.AI_BASE_URL = 'not-a-url';

  const config = resolveAIConfig();
  const err = validateAIConfig(config);

  expect(err).toContain('Invalid LLM base URL');
});

test('local presets stay distinct and use preset base URLs', () => {
  process.env.AI_PROVIDER = 'llamacpp';
  process.env.LLAMACPP_BASE_URL = 'http://localhost:8081/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(config.provider).toBe('llamacpp');
  expect(provider.localBaseUrl).toBe('http://localhost:8081/v1');
  expect(validateAIConfig(config)).toBeNull();
});

test('provider config resolves generic API key aliases for hosted providers', () => {
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'sk-shared-openai';

  const openaiConfig = resolveAIConfig();
  const openaiProvider = resolveProviderConfig(openaiConfig.provider);

  expect(openaiProvider.openaiApiKey).toBe('sk-shared-openai');
  expect(validateAIConfig(openaiConfig)).toBeNull();

  process.env.AI_PROVIDER = 'openrouter';
  process.env.AI_API_KEY = 'sk-shared-openrouter';

  const openrouterConfig = resolveAIConfig();
  const openrouterProvider = resolveProviderConfig(openrouterConfig.provider);

  expect(openrouterProvider.openrouterApiKey).toBe('sk-shared-openrouter');
  expect(validateAIConfig(openrouterConfig)).toBeNull();
});

test('openai provider accepts OpenAI-compatible base URL overrides', () => {
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'sk-openai-compatible';
  process.env.OPENAI_BASE_URL = 'https://api.example.com/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(provider.openaiBaseUrl).toBe('https://api.example.com/v1');
  expect(getProviderBaseUrl(config.provider, provider)).toBe('https://api.example.com/v1');
  expect(validateAIConfig(config)).toBeNull();
});

test('AI_BASE_URL is a generic base URL alias for openai-compatible APIs', () => {
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'sk-generic-compatible';
  process.env.AI_BASE_URL = 'https://api.compatible.test/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(provider.openaiApiKey).toBe('sk-generic-compatible');
  expect(provider.openaiBaseUrl).toBe('https://api.compatible.test/v1');
  expect(validateAIConfig(config)).toBeNull();
});

test('unknown provider falls back to openai', () => {
  expect(normalizeProvider('unknown-provider')).toBe('openai');
  expect(resolveAIConfig({ provider: 'unknown-provider' }).provider).toBe('openai');
});

test('provider-specific base URL overrides AI_BASE_URL when both are present', () => {
  process.env.AI_PROVIDER = 'llamacpp';
  process.env.AI_BASE_URL = 'http://localhost:9999/v1';
  process.env.LLAMACPP_BASE_URL = 'http://localhost:8081/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(provider.localBaseUrl).toBe('http://localhost:8081/v1');
});

test('AI_BASE_URL canonical for generic local provider; LOCAL_BASE_URL is backwards-compatible fallback', () => {
  process.env.AI_PROVIDER = 'local';
  process.env.LOCAL_BASE_URL = 'http://localhost:8081/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(provider.localBaseUrl).toBe('http://localhost:8081/v1');
});

test('LOCAL_BASE_URL does not leak to other local presets', () => {
  process.env.AI_PROVIDER = 'llamacpp';
  process.env.LOCAL_BASE_URL = 'http://localhost:9999/v1';
  process.env.LLAMACPP_BASE_URL = 'http://localhost:8081/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(provider.localBaseUrl).toBe('http://localhost:8081/v1');
});

test('provider-specific base URL vars still work and are not overridden by other preset vars', () => {
  process.env.AI_PROVIDER = 'vllm';
  process.env.LOCAL_BASE_URL = 'http://localhost:9999/v1';
  process.env.VLLM_BASE_URL = 'http://localhost:8000/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.provider);

  expect(provider.localBaseUrl).toBe('http://localhost:8000/v1');
});
