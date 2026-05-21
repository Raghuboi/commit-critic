/**
 * LLM module tests — using MockLanguageModelV4 from ai/test
 *
 * Tests:
 * 1. analyzeCommitWithLLM structured output path
 * 2. analyzeCommitWithLLM NoObjectGeneratedError fallback to text mode
 * 3. analyzeCommitWithLLM network error propagation
 * 4. generateCommitMessage with mock model
 * 5. generateCommitMessage trims whitespace
 * 6. extractJson edge cases
 * 7. getProvider resolves each provider type
 */

import { describe, test, expect } from 'bun:test';
import {
  analyzeCommitWithLLM,
  generateCommitMessage,
  extractJson,
  getProvider,
} from '../core/llm';
import { MockLanguageModelV4 } from 'ai/test';
import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockCommit: Commit = {
  hash: 'abc1234',
  shortHash: 'abc1234',
  subject: 'feat(api): add user auth endpoint',
  body: 'Implements JWT-based authentication.\nAdds login/logout routes.',
  author: 'Alice',
  email: 'alice@example.com',
  date: '2024-01-15',
  timestamp: 1705315200,
  parents: ['def5678'],
};

const mockDeterministic: ScoringResult = {
  score: 8,
  issues: [],
  isConventionalCommit: true,
  isMergeCommit: false,
  hasBody: true,
};

const mockAIConfig = {
  provider: 'openai' as const,
  model: 'gpt-4.1',
  strictMode: false,
  temperature: 0.3,
  maxTokens: 2048,
  maxRetries: 0,
  fallbackChain: [],
};

const mockProviderConfig = {
  openaiApiKey: 'sk-test',
  openrouterApiKey: undefined,
  lmstudioBaseUrl: undefined,
  vllmBaseUrl: undefined,
  vllmApiKey: undefined,
  ollamaBaseUrl: undefined,
};

/**
 * Create a MockLanguageModelV4 that returns a fixed text response.
 */
function createMockModel(responseText: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: responseText }],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 50, text: 50, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

// ── analyzeCommitWithLLM ──────────────────────────────────────────────────────

describe('analyzeCommitWithLLM', () => {
  test('returns structured output when model returns valid JSON', async () => {
    const mockResult = {
      score: 9,
      issues: [
        { category: 'style', severity: 'suggestion' as const, message: 'Great commit' },
      ],
      suggestions: ['Keep it up'],
    };

    const mockModel = createMockModel(JSON.stringify(mockResult));

    const result = await analyzeCommitWithLLM(
      mockCommit,
      mockDeterministic,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(result.score).toBe(9);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('Great commit');
    expect(result.suggestions).toEqual(['Keep it up']);
  });

  test('returns result with empty issues and suggestions', async () => {
    const mockResult = {
      score: 10,
      issues: [],
      suggestions: [],
    };

    const mockModel = createMockModel(JSON.stringify(mockResult));

    const result = await analyzeCommitWithLLM(
      mockCommit,
      mockDeterministic,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(result.score).toBe(10);
    expect(result.issues).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  test('falls back to text mode on NoObjectGeneratedError', async () => {
    let callCount = 0;
    const fallbackResult = {
      score: 6,
      issues: [
        {
          category: 'specificity' as const,
          severity: 'warning' as const,
          message: 'Could be more specific',
        },
      ],
      suggestions: ['Add more detail'],
    };

    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => {
        callCount++;
        if (callCount === 1) {
          // First call (structured output): return garbage to trigger NoObjectGeneratedError
          return {
            content: [{ type: 'text' as const, text: 'This is not JSON at all' }],
            finishReason: { unified: 'stop' as const, raw: 'stop' },
            usage: {
              inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 50, text: 50, reasoning: 0 },
            },
            warnings: [],
          };
        }
        // Second call (text fallback): return valid JSON as plain text
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(fallbackResult) },
          ],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 50, text: 50, reasoning: 0 },
          },
          warnings: [],
        };
      },
    });

    const result = await analyzeCommitWithLLM(
      mockCommit,
      mockDeterministic,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(callCount).toBe(2);
    expect(result.score).toBe(6);
    expect(result.issues[0].category).toBe('specificity');
  });

  test('propagates network errors', async () => {
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('fetch failed: network error');
      },
    });

    await expect(
      analyzeCommitWithLLM(
        mockCommit,
        mockDeterministic,
        { ...mockAIConfig, __testModel: mockModel },
        mockProviderConfig
      )
    ).rejects.toThrow('fetch failed: network error');
  });
});

// ── generateCommitMessage ─────────────────────────────────────────────────────

describe('generateCommitMessage', () => {
  test('returns generated commit message', async () => {
    const mockModel = createMockModel(
      'feat(auth): add JWT authentication middleware'
    );

    const result = await generateCommitMessage(
      'diff --git a/src/auth.ts b/src/auth.ts\n+export function jwtMiddleware() {}',
      'feat',
      'auth',
      undefined,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(result).toBe('feat(auth): add JWT authentication middleware');
  });

  test('trims whitespace from generated message', async () => {
    const mockModel = createMockModel('\n  fix: resolve null pointer  \n');

    const result = await generateCommitMessage(
      'some diff',
      'fix',
      undefined,
      undefined,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(result).toBe('fix: resolve null pointer');
  });

  test('returns multi-line commit message with body', async () => {
    const mockModel = createMockModel(
      'feat(api): add user endpoints\n\n- GET /users\n- POST /users'
    );

    const result = await generateCommitMessage(
      'diff content',
      'feat',
      'api',
      'add user endpoints',
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(result).toContain('feat(api): add user endpoints');
    expect(result).toContain('GET /users');
  });

  test('propagates errors from model', async () => {
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('API rate limited');
      },
    });

    await expect(
      generateCommitMessage(
        'diff',
        'fix',
        undefined,
        undefined,
        { ...mockAIConfig, __testModel: mockModel },
        mockProviderConfig
      )
    ).rejects.toThrow('API rate limited');
  });
});

// ── extractJson ───────────────────────────────────────────────────────────────

describe('extractJson', () => {
  test('strips markdown json fences', () => {
    const fenced = '```json\n{"score": 5}\n```';
    expect(extractJson(fenced)).toEqual({ score: 5 });
  });

  test('strips markdown fences without json label', () => {
    const fenced = '```\n{"score": 7}\n```';
    expect(extractJson(fenced)).toEqual({ score: 7 });
  });

  test('parses plain JSON', () => {
    const plain = '{"score": 7, "issues": []}';
    expect(extractJson(plain)).toEqual({ score: 7, issues: [] });
  });

  test('returns null for invalid JSON', () => {
    expect(extractJson('not json')).toBeNull();
    expect(extractJson('')).toBeNull();
  });

  test('prefers fenced JSON over plain text', () => {
    const mixed = 'Here is the result:\n```json\n{"score": 8}\n```\nHope this helps!';
    expect(extractJson(mixed)).toEqual({ score: 8 });
  });

  test('handles nested objects', () => {
    const nested = '{"score": 5, "issues": [{"category": "style", "severity": "suggestion", "message": "test"}]}';
    const parsed = extractJson(nested) as Record<string, unknown>;
    expect(parsed.score).toBe(5);
    expect(Array.isArray(parsed.issues)).toBe(true);
  });

  test('fails gracefully on broken fence content', () => {
    const broken = '```json\n{broken json\n```';
    expect(extractJson(broken)).toBeNull();
  });
});

// ── getProvider ───────────────────────────────────────────────────────────────

describe('getProvider', () => {
  test('returns openai provider for openai', () => {
    const provider = getProvider(
      { ...mockAIConfig, provider: 'openai' },
      mockProviderConfig
    );
    // openai provider is an object with chat() and other methods
    expect(typeof provider).toBe('function');
  });

  test('returns openai-compatible provider for openrouter', () => {
    const provider = getProvider(
      { ...mockAIConfig, provider: 'openrouter' },
      { ...mockProviderConfig, openrouterApiKey: 'sk-or-test' }
    );
    expect(typeof provider).toBe('function');
  });

  test('returns openai-compatible provider for lmstudio', () => {
    const provider = getProvider(
      { ...mockAIConfig, provider: 'lmstudio' },
      { ...mockProviderConfig, lmstudioBaseUrl: 'http://localhost:1234/v1' }
    );
    expect(typeof provider).toBe('function');
  });

  test('returns openai-compatible provider for vllm', () => {
    const provider = getProvider(
      { ...mockAIConfig, provider: 'vllm' },
      { ...mockProviderConfig, vllmBaseUrl: 'http://localhost:8000/v1' }
    );
    expect(typeof provider).toBe('function');
  });

  test('returns openai-compatible provider for ollama', () => {
    const provider = getProvider(
      { ...mockAIConfig, provider: 'ollama' },
      { ...mockProviderConfig, ollamaBaseUrl: 'http://localhost:11434/v1' }
    );
    expect(typeof provider).toBe('function');
  });

  test('returns openai-compatible provider for unknown provider (default)', () => {
    const provider = getProvider(
      { ...mockAIConfig, provider: 'custom-provider' },
      mockProviderConfig
    );
    expect(typeof provider).toBe('function');
  });
});
