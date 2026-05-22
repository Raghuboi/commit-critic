/**
 * Config resolution tests
 */

import { test, expect, beforeEach, afterEach } from 'bun:test';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig } from '../config/ai-config';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('AI_') || key.startsWith('OPENAI_') || key.startsWith('OPENROUTER_') || key.startsWith('LM_') || key.startsWith('VLLM_') || key.startsWith('OLLAMA_')) {
      delete process.env[key];
    }
  }
});

afterEach(() => {
  Object.assign(process.env, ORIGINAL_ENV);
});

test('resolves AI config from env vars', () => {
  process.env.AI_PROVIDER = 'openrouter';
  process.env.AI_MODEL = 'claude-3.5-sonnet';
  process.env.AI_TEMPERATURE = '0.5';
  process.env.AI_MAX_TOKENS = '2048';
  const config = resolveAIConfig();
  expect(config.provider).toBe('openrouter');
  expect(config.model).toBe('claude-3.5-sonnet');
  expect(config.temperature).toBe(0.5);
  expect(config.maxTokens).toBe(2048);
});

test('resolves AI config from flags', () => {
  process.env.AI_PROVIDER = 'openai';
  const config = resolveAIConfig({ provider: 'ollama', model: 'llama3.2' });
  expect(config.provider).toBe('ollama');
  expect(config.model).toBe('llama3.2');
});

test('validates missing API key', () => {
  process.env.AI_PROVIDER = 'openai';
  delete process.env.OPENAI_API_KEY;
  const config = resolveAIConfig();
  const err = validateAIConfig(config);
  expect(err).toContain('OPENAI_API_KEY');
});

test('local provider works without explicit base url', () => {
  process.env.AI_PROVIDER = 'lmstudio';
  delete process.env.LM_STUDIO_BASE_URL;
  const config = resolveAIConfig();
  const err = validateAIConfig(config);
  expect(err).toBeNull();
});

test('provider config resolves env vars', () => {
  process.env.OPENAI_API_KEY = 'sk-test123';
  process.env.LM_STUDIO_BASE_URL = 'http://localhost:1234/v1';
  const cfg = resolveProviderConfig();
  expect(cfg.openaiApiKey).toBe('sk-test123');
  expect(cfg.lmstudioBaseUrl).toBe('http://localhost:1234/v1');
});

test('unknown provider falls back to openai', () => {
  const config = resolveAIConfig({ provider: 'unknown-provider' as import('../types/config').AIProvider });
  expect(config.provider).toBe('openai');
});
