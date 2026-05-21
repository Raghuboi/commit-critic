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

describe('detectDefaultBranch', () => {
  test('detects main branch from local repo', async () => {
    const { detectDefaultBranch } = await import('../core/remote');
    // Create a temp repo with main branch
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-test-'));
    await Bun.$`git init -b main`.cwd(tempDir);
    await Bun.$`git config user.email "test@test.com"`.cwd(tempDir);
    await Bun.$`git config user.name "Test"`.cwd(tempDir);
    await Bun.$`echo "hello" > file.txt`.cwd(tempDir);
    await Bun.$`git add .`.cwd(tempDir);
    await Bun.$`git commit -m "initial"`.cwd(tempDir);

    const branch = await detectDefaultBranch(tempDir);
    expect(branch).toBe('main');

    // cleanup
    await Bun.$`rm -rf ${tempDir}`;
  });

  test('returns undefined for invalid path', async () => {
    const { detectDefaultBranch } = await import('../core/remote');
    const branch = await detectDefaultBranch('/nonexistent/path');
    expect(branch).toBeUndefined();
  });
});
