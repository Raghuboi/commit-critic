import { describe, test, expect } from 'bun:test';
import { buildTemplateMessage } from '../core/writer';

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

  test('handles edge cases (special chars, unicode, empty scope)', () => {
    // Special characters
    expect(buildTemplateMessage('fix', 'ui', 'handle "quotes" & <brackets>')).toBe(
      'fix(ui): handle "quotes" & <brackets>'
    );
    // Empty scope (treated as no scope)
    expect(buildTemplateMessage('chore', '', 'cleanup')).toBe('chore: cleanup');
    // Unicode
    expect(buildTemplateMessage('feat', undefined, 'add emoji support 🎉')).toBe(
      'feat: add emoji support 🎉'
    );
  });
});
