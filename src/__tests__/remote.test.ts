/**
 * Remote repo module tests
 */

import { test, expect, describe } from 'bun:test';
import { isValidRepoUrl } from '../core/remote';

describe('isValidRepoUrl', () => {
  test('accepts valid URLs (https, git@, file://, absolute paths)', () => {
    expect(isValidRepoUrl('https://github.com/user/repo.git')).toBe(true);
    expect(isValidRepoUrl('git@github.com:user/repo.git')).toBe(true);
    expect(isValidRepoUrl('file:///home/user/repo')).toBe(true);
    expect(isValidRepoUrl('/home/user/repo')).toBe(true);
  });

  test('rejects invalid URLs (empty, malformed, incomplete, http)', () => {
    expect(isValidRepoUrl('')).toBe(false);
    expect(isValidRepoUrl('not-a-url')).toBe(false);
    expect(isValidRepoUrl('http://example.com/repo.git')).toBe(false);
    expect(isValidRepoUrl('https://')).toBe(false);
    expect(isValidRepoUrl('https://github.com')).toBe(false);
    expect(isValidRepoUrl('git@github.com')).toBe(false);
    expect(isValidRepoUrl('file://')).toBe(false);
    expect(isValidRepoUrl('https://github.com/user/repo with-space')).toBe(false);
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

  test('detects branch from bare repo', async () => {
    const { detectDefaultBranch } = await import('../core/remote');
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const bareDir = await mkdtemp(join(tmpdir(), 'commit-critic-bare-'));
    const pushDir = await mkdtemp(join(tmpdir(), 'commit-critic-push-'));

    await Bun.$`git init --bare`.cwd(bareDir);
    await Bun.$`git init -b main`.cwd(pushDir);
    await Bun.$`git config user.email "test@test.com"`.cwd(pushDir);
    await Bun.$`git config user.name "Test"`.cwd(pushDir);
    await Bun.$`echo "hello" > file.txt`.cwd(pushDir);
    await Bun.$`git add .`.cwd(pushDir);
    await Bun.$`git commit -m "initial"`.cwd(pushDir);
    await Bun.$`git push ${bareDir} main`.cwd(pushDir);

    const branch = await detectDefaultBranch(bareDir);
    expect(branch).toBe('main');

    // cleanup
    await Bun.$`rm -rf ${bareDir} ${pushDir}`;
  });

  test('returns undefined for invalid path', async () => {
    const { detectDefaultBranch } = await import('../core/remote');
    const branch = await detectDefaultBranch('/nonexistent/path');
    expect(branch).toBeUndefined();
  });
});
