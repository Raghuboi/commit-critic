/**
 * Remote repo module tests
 */

import { test, expect, describe } from 'bun:test';
import { isValidRepoUrl } from '../core/remote';

describe('isValidRepoUrl', () => {
  test('accepts https URLs', () => {
    expect(isValidRepoUrl('https://github.com/user/repo.git')).toBe(true);
  });

  test('accepts git@ URLs', () => {
    expect(isValidRepoUrl('git@github.com:user/repo.git')).toBe(true);
  });

  test('accepts file:// URLs', () => {
    expect(isValidRepoUrl('file:///home/user/repo')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidRepoUrl('')).toBe(false);
  });

  test('rejects random text', () => {
    expect(isValidRepoUrl('not-a-url')).toBe(false);
  });

  test('rejects http URLs', () => {
    expect(isValidRepoUrl('http://example.com/repo.git')).toBe(false);
  });

  test('accepts absolute local paths', () => {
    expect(isValidRepoUrl('/home/user/repo')).toBe(true);
  });
});
