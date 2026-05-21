/**
 * Analysis logic tests
 */

import { test, expect, describe } from 'bun:test';
import { analyzeCommit, analyzeCommits } from '../core/analyzer';
import type { Commit } from '../types/commit';

function makeCommit(subject: string, body = ''): Commit {
  return {
    hash: 'abc123def456',
    shortHash: 'abc1234',
    subject,
    body,
    author: 'Test',
    email: 'test@test.com',
    date: new Date().toISOString(),
    timestamp: Date.now(),
    parents: ['parent1'],
  };
}

describe('analyzeCommit', () => {
  test('uses deterministic score in --no-llm mode', async () => {
    const result = await analyzeCommit(makeCommit('wip'), { noLlm: true });
    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test('returns full AnalysisResult shape', async () => {
    const result = await analyzeCommit(makeCommit('feat: add caching'), { noLlm: true });
    expect(result.hash).toBe('abc123def456');
    expect(result.shortHash).toBe('abc1234');
    expect(result.subject).toBe('feat: add caching');
    expect(result.isConventionalCommit).toBe(true);
    expect(result.isMergeCommit).toBe(false);
    expect(typeof result.hasBody).toBe('boolean');
  });

  test('preserves suggestion and whyGood from LLM result', async () => {
    const { MockLanguageModelV4 } = await import('ai/test');
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text' as const, text: JSON.stringify({
          score: 8,
          issues: [],
          suggestions: [],
          suggestion: 'Add more detail to the body',
          whyGood: 'Clear scope and imperative mood',
        }) }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 50, text: 50, reasoning: 0 },
        },
        warnings: [],
      }),
    });

    const result = await analyzeCommit(makeCommit('feat: add caching'), {
      noLlm: false,
      aiConfig: { provider: 'openai', model: 'gpt-4.1', strictMode: false, temperature: 0.1, maxTokens: 4096, maxRetries: 0, fallbackChain: [], __testModel: mockModel },
      providerConfig: { openaiApiKey: 'sk-test' },
    });

    expect(result.score).toBe(8);
    expect(result.suggestion).toBe('Add more detail to the body');
    expect(result.whyGood).toBe('Clear scope and imperative mood');
  });

  test('strict mode throws on LLM failure', async () => {
    await expect(
      analyzeCommit(makeCommit('fix: handle edge case'), {
        noLlm: false,
        strict: true,
        aiConfig: { provider: 'openai', model: 'gpt-4.1', strictMode: true, temperature: 0.1, maxTokens: 4096, maxRetries: 2, fallbackChain: [] },
        providerConfig: { openaiApiKey: 'invalid-key-for-test' },
      })
    ).rejects.toThrow();
  });
});

describe('analyzeCommits', () => {
  test('batch analyzes multiple commits', async () => {
    const commits = [
      makeCommit('wip'),
      makeCommit('feat: add login'),
      makeCommit('fix: typo'),
    ];
    const results = await analyzeCommits(commits, { noLlm: true });
    expect(results).toHaveLength(3);
    expect(results[0].score).toBeLessThanOrEqual(3);
    expect(results[1].score).toBeGreaterThanOrEqual(5);
    expect(results[2].score).toBeGreaterThanOrEqual(5);
  });

  test('batch returns correct metadata for each commit', async () => {
    const commits = [
      makeCommit('feat: add caching'),
      { ...makeCommit('Merge branch main'), parents: ['p1', 'p2'] },
    ];
    const results = await analyzeCommits(commits, { noLlm: true });
    expect(results[0].isConventionalCommit).toBe(true);
    expect(results[0].isMergeCommit).toBe(false);
    expect(results[1].isMergeCommit).toBe(true);
  });
});
