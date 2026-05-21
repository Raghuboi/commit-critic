/**
 * Scoring rubric unit tests
 */

import { test, expect } from 'bun:test';
import { scoreCommit, isConventionalCommit } from '../core/scorer';
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
});

test('catches fixed bug', () => {
  const result = scoreCommit(makeCommit('fixed bug'));
  expect(result.issues.some(i => i.message.toLowerCase().includes('vague'))).toBe(true);
});

test('detects non-imperative mood', () => {
  const result = scoreCommit(makeCommit('Added login page'));
  expect(result.issues.some(i => i.message.includes('imperative'))).toBe(true);
});

test('detects trailing period', () => {
  const result = scoreCommit(makeCommit('feat: add login page.'));
  expect(result.issues.some(i => i.message.includes('period'))).toBe(true);
});

test('isConventionalCommit returns true for valid format', () => {
  expect(isConventionalCommit('feat(api): add caching')).toBe(true);
  expect(isConventionalCommit('fix: handle error')).toBe(true);
});

test('isConventionalCommit returns false for invalid format', () => {
  expect(isConventionalCommit('add caching')).toBe(false);
  expect(isConventionalCommit('feat add caching')).toBe(false);
});
