import { describe, test, expect } from 'bun:test';
import { buildTemplateMessage, formatSuggestedCommitMessage } from '../core/writer';
import { buildWritePrompt } from '../core/prompts';
import { WRITE_MAX_CHARS, WRITE_DIFF_TRUNCATED, truncateDiff } from '../utils/diff';

describe('buildTemplateMessage', () => {
  test('returns basic template', () => {
    expect(buildTemplateMessage('feat')).toBe('feat: update');
  });

  test('includes scope when provided', () => {
    expect(buildTemplateMessage('fix', 'api')).toBe('fix(api): update');
  });

  test('includes description when provided', () => {
    expect(buildTemplateMessage('docs', undefined, 'update README')).toBe('docs: update README');
  });
});

describe('formatSuggestedCommitMessage', () => {
  test('uses real newlines around suggestion content', () => {
    const formatted = formatSuggestedCommitMessage('docs(readme): add API setup');
    expect(formatted).toBe('\nSuggested commit message:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\ndocs(readme): add API setup\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    expect(formatted).not.toContain('\\n');
  });
});

describe('truncateDiff', () => {
  test('returns diff unchanged when under limit', () => {
    const short = 'diff --git a/src/a.ts b/src/a.ts\n+export const a = 1;';
    expect(truncateDiff(short, WRITE_MAX_CHARS)).toBe(short);
  });

  test('appends truncation marker when over limit', () => {
    const large = 'a'.repeat(WRITE_MAX_CHARS + 100);
    const result = truncateDiff(large, WRITE_MAX_CHARS);
    expect(result.endsWith(WRITE_DIFF_TRUNCATED)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(WRITE_MAX_CHARS + WRITE_DIFF_TRUNCATED.length);
  });

  test('boundary: exact limit returns unchanged', () => {
    const exact = 'x'.repeat(WRITE_MAX_CHARS);
    expect(truncateDiff(exact, WRITE_MAX_CHARS)).toBe(exact);
  });
});

describe('buildWritePrompt', () => {
  test('small diff passed through without marker', () => {
    const short = 'diff --git a/src/a.ts b/src/a.ts\n+export const a = 1;';
    const prompt = buildWritePrompt(short, 'feat', 'api', 'add auth');
    expect(prompt.includes(short)).toBe(true);
    expect(prompt.includes(WRITE_DIFF_TRUNCATED)).toBe(false);
  });

  test('large diff includes truncation marker', () => {
    const large = 'a'.repeat(WRITE_MAX_CHARS + 200);
    const prompt = buildWritePrompt(large, 'feat', 'api', 'add auth');
    expect(prompt.includes(WRITE_DIFF_TRUNCATED)).toBe(true);
    expect(prompt.includes('a'.repeat(WRITE_MAX_CHARS))).toBe(true);
    // marker appears only once at end
    const parts = prompt.split(WRITE_DIFF_TRUNCATED);
    expect(parts.length).toBe(2);
  });

  test('prompt contains all required fields', () => {
    const prompt = buildWritePrompt('diff content', 'fix', 'auth', 'resolve token bug');
    expect(prompt.includes('fix')).toBe(true);
    expect(prompt.includes('auth')).toBe(true);
    expect(prompt.includes('resolve token bug')).toBe(true);
    expect(prompt.includes('Staged diff:')).toBe(true);
    expect(prompt.includes('Subject line <= 50 characters')).toBe(true);
  });
});
