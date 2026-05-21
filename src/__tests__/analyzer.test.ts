/**
 * Analysis logic tests
 */

import { test, expect } from 'bun:test';
import { analyzeCommit } from '../core/analyzer';
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
