/**
 * Config resolution tests.
 */

import { test, expect, beforeEach, afterEach } from 'bun:test';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig, normalizeProvider, normalizeProviderInput } from '../config/ai-config';

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
  expect(config.requestedProvider).toBe('openrouter');
  expect(config.model).toBe('anthropic/claude-sonnet-4');
  expect(config.temperature).toBe(0.5);
  expect(config.maxTokens).toBe(2048);
  expect(config.timeoutMs).toBe(120000);
});

test('resolves AI config from flags and normalizes local aliases', () => {
  process.env.AI_PROVIDER = 'openai';

  const config = resolveAIConfig({ provider: 'ollama', model: 'llama3.2' });

  expect(config.provider).toBe('local');
  expect(config.requestedProvider).toBe('ollama');
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
  const provider = resolveProviderConfig(config.requestedProvider);

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

  expect(err).toContain('Invalid local LLM base URL');
});

test('legacy local aliases still work', () => {
  process.env.AI_PROVIDER = 'llamacpp';
  process.env.LLAMACPP_BASE_URL = 'http://localhost:8081/v1';

  const config = resolveAIConfig();
  const provider = resolveProviderConfig(config.requestedProvider);

  expect(config.provider).toBe('local');
  expect(config.requestedProvider).toBe('llamacpp');
  expect(provider.localBaseUrl).toBe('http://localhost:8081/v1');
  expect(validateAIConfig(config)).toBeNull();
});

test('provider config resolves generic API key aliases', () => {
  process.env.AI_PROVIDER = 'openrouter';
  process.env.AI_API_KEY = 'sk-shared';

  const config = resolveAIConfig();
  const cfg = resolveProviderConfig(config.requestedProvider);

  expect(cfg.openrouterApiKey).toBe('sk-shared');
});

test('unknown provider falls back to openai', () => {
  expect(normalizeProviderInput('unknown-provider')).toBe('openai');
  expect(normalizeProvider('unknown-provider')).toBe('openai');
  expect(resolveAIConfig({ provider: 'unknown-provider' }).provider).toBe('openai');
});
