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
  test('Zod rejects invalid category', async () => {
    const mockResult = {
      score: 9,
      issues: [
        { category: 'invalid-category', severity: 'suggestion' as const, message: 'Great commit' },
      ],
      suggestions: [],
    };

    const mockModel = createMockModel(JSON.stringify(mockResult));

    await expect(
      analyzeCommitWithLLM(
        mockCommit,
        mockDeterministic,
        { ...mockAIConfig, __testModel: mockModel },
        mockProviderConfig
      )
    ).rejects.toThrow();
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

  test('returns openai-compatible provider for lmstudio, vllm, ollama', () => {
    expect(typeof getProvider({ ...mockAIConfig, provider: 'lmstudio' }, { ...mockProviderConfig, lmstudioBaseUrl: 'http://localhost:1234/v1' })).toBe('function');
    expect(typeof getProvider({ ...mockAIConfig, provider: 'vllm' }, { ...mockProviderConfig, vllmBaseUrl: 'http://localhost:8000/v1' })).toBe('function');
    expect(typeof getProvider({ ...mockAIConfig, provider: 'ollama' }, { ...mockProviderConfig, ollamaBaseUrl: 'http://localhost:11434/v1' })).toBe('function');
  });

  test('returns openai-compatible provider for unknown provider (default)', async () => {
    const aiConfig = resolveAIConfig({ provider: 'custom-provider' as unknown as import('../types/config').AIProvider });
    expect(aiConfig.provider).toBe('openai');
    const provider = getProvider(aiConfig, mockProviderConfig);
    expect(typeof provider).toBe('function');
  });
});

// ── generateChangeBullets ──────────────────────────────────────────────────────

describe('generateChangeBullets (deterministic)', () => {
  test('returns "Updated files" for empty file list', async () => {
    const bullets = await generateChangeBullets('', []);
    expect(bullets).toEqual(['Updated files']);
  });

  test('reports added files (single and multiple)', async () => {
    // Single added file
    expect(await generateChangeBullets('', [{ status: 'A', path: 'src/new.ts' }])).toEqual(['Added 1 file']);
    // Multiple added files
    expect(await generateChangeBullets('', [
      { status: 'A', path: 'src/new.ts' },
      { status: 'A', path: 'src/also-new.ts' },
    ])).toEqual(['Added 2 files']);
  });

  test('reports modified files', async () => {
    const files = [
      { status: 'M', path: 'src/a.ts' },
      { status: 'M', path: 'src/b.ts' },
      { status: 'M', path: 'src/c.ts' },
    ];
    const bullets = await generateChangeBullets('', files);
    expect(bullets).toEqual(['Modified 3 files']);
  });

  test('reports deleted files', async () => {
    const files = [{ status: 'D', path: 'src/old.ts' }];
    const bullets = await generateChangeBullets('', files);
    expect(bullets).toEqual(['Deleted 1 file']);
  });

  test('reports mixed statuses', async () => {
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
});
