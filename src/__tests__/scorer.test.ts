/**
 * Scoring rubric unit tests
 *
 * Tests deterministic scoring rules against known good/bad commit messages.
 */

import { test, expect } from 'bun:test';
// import { scoreCommit } from '../core/scorer';

test('scores a perfect conventional commit', () => {
  // TODO: Implement
  // const result = scoreCommit({
  //   subject: 'fix(auth): handle token expiry in refresh flow',
  //   body: 'When the refresh token expires, the auth middleware now catches the error and redirects to login.',
  //   diffLength: 200,
  // });
  // expect(result.score).toBeGreaterThanOrEqual(8);
  // expect(result.issues.length).toBe(0);
});

test('flags a vague commit message', () => {
  // TODO: Implement
  // const result = scoreCommit({
  //   subject: 'fix stuff',
  //   body: '',
  //   diffLength: 500,
  // });
  // expect(result.score).toBeLessThan(4);
  // expect(result.issues.some(i => i.severity === 'critical')).toBe(true);
});

test('detects missing conventional commit type', () => {
  // TODO: Implement
  // const result = scoreCommit({
  //   subject: 'Added new feature',
  //   body: '',
  //   diffLength: 100,
  // });
  // expect(result.issues.some(i => i.category === 'type')).toBe(true);
});
