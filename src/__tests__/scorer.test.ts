/**
 * Scoring rubric unit tests
 */

import { test, expect, describe } from 'bun:test';
import { scoreCommit, isConventionalCommit, isMergeCommit } from '../core/scorer';
import type { Commit } from '../types/commit';

function makeCommit(subject: string, body = '', parents = ['parent1']): Commit {
  return {
    hash: 'abc123def456',
    shortHash: 'abc1234',
    subject,
    body,
    author: 'Test',
    email: 'test@test.com',
    date: new Date().toISOString(),
    timestamp: Date.now(),
    parents,
  };
}

describe('scoreCommit', () => {
  test('scores a perfect conventional commit', () => {
    const result = scoreCommit(makeCommit('fix(auth): handle token expiry in refresh flow', 'When the refresh token expires, the auth middleware now catches the error and redirects to login.'));
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.issues.filter(i => i.severity === 'critical').length).toBe(0);
  });

  test('flags a vague commit message', () => {
    const result = scoreCommit(makeCommit('fix stuff'));
    expect(result.score).toBeLessThanOrEqual(7);
    expect(result.issues.some(i => i.severity === 'critical' || i.severity === 'warning')).toBe(true);
  });

  test('detects missing conventional commit type', () => {
    const result = scoreCommit(makeCommit('Added new feature'));
    expect(result.issues.some(i => i.category === 'convention')).toBe(true);
  });

  test('catches one-word commit', () => {
    const result = scoreCommit(makeCommit('wip'));
    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.issues.some(i => i.message.includes('single word'))).toBe(true);
    expect(result.issues.some(i => i.rewrite && i.rewrite.includes('feat: describe the completed change'))).toBe(true);
  });

  test('catches fixed bug', () => {
    const result = scoreCommit(makeCommit('fixed bug'));
    expect(result.issues.some(i => i.message.toLowerCase().includes('vague'))).toBe(true);
    const rewrites = result.issues.map(i => i.rewrite).filter(Boolean);
    expect(rewrites.some(r => r === 'fix: describe the bug and affected behavior')).toBe(true);
    expect(rewrites.some(r => r?.includes('fix: fix'))).toBe(false);
  });

  test('provides rewrite for vague commit', () => {
    const result = scoreCommit(makeCommit('update'));
    const rewrite = result.issues.find(i => i.rewrite)?.rewrite;
    expect(rewrite).toBeDefined();
    expect(rewrite).toContain('feat:');
  });

  test('provides rewrite for missing conventional commit type', () => {
    const result = scoreCommit(makeCommit('Added new feature'));
    const rewrite = result.issues.find(i => i.category === 'convention')?.rewrite;
    expect(rewrite).toBeDefined();
    expect(rewrite).toContain('feat:');
  });

  test('detects non-imperative mood', () => {
    const result = scoreCommit(makeCommit('Added login page'));
    expect(result.issues.some(i => i.message.includes('imperative'))).toBe(true);
  });

  test('detects trailing period', () => {
    const result = scoreCommit(makeCommit('feat: add login page.'));
    expect(result.issues.some(i => i.message.includes('period'))).toBe(true);
  });

  test('flags body line length > 72 chars', () => {
    const longLine = 'a'.repeat(80);
    const result = scoreCommit(makeCommit('feat: add feature', longLine));
    expect(result.issues.some(i => i.message.includes('72'))).toBe(true);
  });

  test('flags subject length > 72 chars', () => {
    const result = scoreCommit(makeCommit('feat: ' + 'a'.repeat(80)));
    expect(result.issues.some(i => i.message.includes('50') || i.message.includes('72'))).toBe(true);
  });

  test('score never drops below 1', () => {
    const result = scoreCommit(makeCommit(''));
    expect(result.score).toBeGreaterThanOrEqual(1);
  });
});

describe('isConventionalCommit', () => {
  test('returns true for valid format', () => {
    expect(isConventionalCommit('feat(api): add caching')).toBe(true);
    expect(isConventionalCommit('fix: handle error')).toBe(true);
  });

  test('returns false for invalid format', () => {
    expect(isConventionalCommit('add caching')).toBe(false);
    expect(isConventionalCommit('feat add caching')).toBe(false);
  });
});

describe('isMergeCommit', () => {
  test('returns false for single parent', () => {
    expect(isMergeCommit(makeCommit('feat: add login'))).toBe(false);
  });

  test('returns true for two parents', () => {
    expect(isMergeCommit(makeCommit('Merge branch main', '', ['p1', 'p2']))).toBe(true);
  });
});
