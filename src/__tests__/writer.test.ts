/**
 * Writer module tests
 */

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

  test('includes scope and description', () => {
    expect(buildTemplateMessage('feat', 'auth', 'add login')).toBe('feat(auth): add login');
  });
});
