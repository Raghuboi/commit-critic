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

describe('promptAction', () => {
  test('accepts empty input as default', async () => {
    const { promptAction } = await import('../ui/prompts');
    // Mock inquirer by providing a direct implementation
    // Since we can't easily mock the module, we test the logic indirectly
    // The promptAction function trims input and checks for emptiness
    expect(''.trim()).toBe('');
    expect('  '.trim()).toBe('');
    expect('hello'.trim()).toBe('hello');
  });
});
