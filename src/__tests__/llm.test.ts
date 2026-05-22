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
  generateChangeBullets,
  extractJson,
  getProvider,
} from '../core/llm';
import { MockLanguageModelV4 } from 'ai/test';
import { resolveAIConfig } from '../config/ai-config';
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
  timeoutMs: 60_000,
};

const mockProviderConfig = {
  openaiApiKey: 'sk-test',
  openrouterApiKey: undefined,
  localBaseUrl: 'http://localhost:8081/v1',
  localApiKey: undefined,
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
  test('normalizes loose local-model issue shapes', async () => {
    const mockResult = {
      score: 0,
      issues: ['Message is vague', { category: 'invalid-category', severity: 'unknown', message: 'Needs detail' }],
      suggestions: ['Use a specific conventional commit message'],
    };

    const mockModel = createMockModel(JSON.stringify(mockResult));

    const result = await analyzeCommitWithLLM(
      mockCommit,
      mockDeterministic,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );

    expect(result.score).toBe(1);
    expect(result.issues).toEqual([
      { category: 'clarity', severity: 'warning', message: 'Message is vague' },
      { category: 'clarity', severity: 'warning', message: 'Needs detail' },
    ]);
  });

  test('returns structured output when model returns valid JSON', async () => {
    const mockResult = {
      score: 9,
      issues: [
        { category: 'convention', severity: 'suggestion' as const, message: 'Great commit' },
      ],
      suggestions: ['Keep it up'],
      suggestion: 'Add a body explaining why',
      whyGood: 'Follows conventional commit format with clear scope',
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
    expect(result.suggestion).toBe('Add a body explaining why');
    expect(result.whyGood).toBe('Follows conventional commit format with clear scope');
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
  test('returns generated commit message and trims whitespace', async () => {
    // Basic message generation
    const mockModel1 = createMockModel(
      'feat(auth): add JWT authentication middleware'
    );
    const result1 = await generateCommitMessage(
      'diff --git a/src/auth.ts b/src/auth.ts\n+export function jwtMiddleware() {}',
      'feat',
      'auth',
      undefined,
      { ...mockAIConfig, __testModel: mockModel1 },
      mockProviderConfig
    );
    expect(result1).toBe('feat(auth): add JWT authentication middleware');

    // Whitespace trimming
    const mockModel2 = createMockModel('\n  fix: resolve null pointer  \n');
    const result2 = await generateCommitMessage(
      'some diff',
      'fix',
      undefined,
      undefined,
      { ...mockAIConfig, __testModel: mockModel2 },
      mockProviderConfig
    );
    expect(result2).toBe('fix: resolve null pointer');
  });

});

// ── extractJson ───────────────────────────────────────────────────────────────

describe('extractJson', () => {
  test('parses valid JSON with and without fences', () => {
    // Fenced with label
    expect(extractJson('```json\n{"score": 5}\n```')).toEqual({ score: 5 });
    // Fenced without label
    expect(extractJson('```\n{"score": 7}\n```')).toEqual({ score: 7 });
    // Plain JSON
    expect(extractJson('{"score": 7, "issues": []}')).toEqual({ score: 7, issues: [] });
    // Prefers fenced over plain text
    const mixed = 'Here is the result:\n```json\n{"score": 8}\n```\nHope this helps!';
    expect(extractJson(mixed)).toEqual({ score: 8 });
    // Handles nested objects
    const nested = '{"score": 5, "issues": [{"category": "convention", "severity": "suggestion", "message": "test"}]}';
    const parsed = extractJson(nested) as Record<string, unknown>;
    expect(parsed.score).toBe(5);
    expect(Array.isArray(parsed.issues)).toBe(true);
  });

  test('returns null for invalid inputs and broken fences', () => {
    expect(extractJson('not json')).toBeNull();
    expect(extractJson('')).toBeNull();
    // Broken fence content
    expect(extractJson('```json\n{broken json\n```')).toBeNull();
  });
});

// ── getProvider ───────────────────────────────────────────────────────────────

describe('getProvider', () => {
  test('returns correct provider for openai and openrouter', () => {
    expect(typeof getProvider({ ...mockAIConfig, provider: 'openai' }, mockProviderConfig)).toBe('function');
    expect(typeof getProvider({ ...mockAIConfig, provider: 'openrouter' }, { ...mockProviderConfig, openrouterApiKey: 'sk-or-test' })).toBe('function');
  });

  test('passes resolved OpenAI API key into provider instance', () => {
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env-different';
    try {
      const provider = getProvider(
        { ...mockAIConfig, provider: 'openai' },
        { ...mockProviderConfig, openaiApiKey: 'sk-from-generic-ai-api-key' }
      ) as unknown as (model: string) => { config: { headers: () => Record<string, string> } };
      const model = provider('gpt-4.1');
      expect(model.config.headers().authorization).toBe('Bearer sk-from-generic-ai-api-key');
    } finally {
      if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  test('returns openai-compatible provider for local presets', () => {
    expect(typeof getProvider({ ...mockAIConfig, provider: 'local' }, mockProviderConfig)).toBe('function');
    expect(typeof getProvider({ ...mockAIConfig, provider: 'llamacpp' }, mockProviderConfig)).toBe('function');
  });

  test('unknown provider resolves to openai default', async () => {
    const aiConfig = resolveAIConfig({ provider: 'custom-provider' });
    expect(aiConfig.provider).toBe('openai');
    const provider = getProvider(aiConfig, mockProviderConfig);
    expect(typeof provider).toBe('function');
  });
});

// ── generateChangeBullets ──────────────────────────────────────────────────────

describe('generateChangeBullets', () => {
  test('falls back to deterministic staged-file bullets', async () => {
    expect(await generateChangeBullets('', [])).toEqual(['Updated files']);
    const files = [
      { status: 'A', path: 'src/new.ts' },
      { status: 'M', path: 'src/existing.ts' },
      { status: 'D', path: 'src/old.ts' },
    ];
    const bullets = await generateChangeBullets('', files);
    expect(bullets).toEqual(['Added 1 file', 'Modified 1 file', 'Deleted 1 file']);
  });

  test('uses LLM bullets when available and sufficient', async () => {
    const files = [{ status: 'M', path: 'src/auth.ts' }];
    const mockModel = createMockModel(
      '- Refactored authentication middleware\n- Added JWT validation\n- Updated error handling'
    );
    const bullets = await generateChangeBullets(
      'diff content',
      files,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );
    expect(bullets.length).toBeGreaterThanOrEqual(2);
    expect(bullets).toContain('Refactored authentication middleware');
  });

  test('falls back when local model returns only unterminated thinking text', async () => {
    const files = [{ status: 'M', path: 'README.md' }];
    const mockModel = createMockModel('<think>\nI need to inspect the diff and reason through the changes');
    const bullets = await generateChangeBullets(
      'diff content',
      files,
      { ...mockAIConfig, __testModel: mockModel },
      mockProviderConfig
    );
    expect(bullets).toEqual(['Modified 1 file']);
  });
});
