/**
 * End-to-end integration tests
 */

import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_PATH = join(process.cwd(), 'dist/cli.js');

async function runCli(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI_PATH, ...args], {
    cwd: cwd || process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { stdout, stderr, exitCode };
}

async function runGit(cwd: string, args: string[]) {
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  const exitCode = await proc.exited;
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  if (exitCode !== 0) throw new Error(`git ${args.join(' ')} failed: ${err || out}`);
  return out;
}

test('analyze command produces output', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-e2e-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
  await runGit(tempDir, ['config', 'user.name', 'Test']);
  await writeFile(join(tempDir, 'a.txt'), 'hello');
  await runGit(tempDir, ['add', 'a.txt']);
  await runGit(tempDir, ['commit', '-m', 'feat: initial commit']);

  const { stdout, exitCode } = await runCli(['analyze', '--no-llm', '--count', '10'], tempDir);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('feat: initial commit');
  await rm(tempDir, { recursive: true, force: true });
});

test('analyze command with --no-llm works offline', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-offline-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
  await runGit(tempDir, ['config', 'user.name', 'Test']);
  await writeFile(join(tempDir, 'x.txt'), 'x');
  await runGit(tempDir, ['add', 'x.txt']);
  await runGit(tempDir, ['commit', '-m', 'wip']);

  const { stdout, exitCode } = await runCli(['analyze', '--no-llm', '--json'], tempDir);
  expect(exitCode).toBe(1); // errors because score < 5
  const json = JSON.parse(stdout);
  expect(json.commits.length).toBe(1);
  expect(json.commits[0].score).toBeLessThan(5);
  await rm(tempDir, { recursive: true, force: true });
});

test('analyze command handles remote repo via file://', async () => {
  const remoteDir = await mkdtemp(join(tmpdir(), 'commit-critic-remote-'));
  await runGit(remoteDir, ['init', '--bare']);
  const pushDir = await mkdtemp(join(tmpdir(), 'commit-critic-push-'));
  await runGit(pushDir, ['init', '-b', 'main']);
  await runGit(pushDir, ['config', 'user.email', 'test@test.com']);
  await runGit(pushDir, ['config', 'user.name', 'Test']);
  await writeFile(join(pushDir, 'r.txt'), 'r');
  await runGit(pushDir, ['add', 'r.txt']);
  await runGit(pushDir, ['commit', '-m', 'feat: remote commit']);
  await runGit(pushDir, ['push', remoteDir, 'main']);

  const { stdout, exitCode } = await runCli(['analyze', '--no-llm', '--url', 'file://' + remoteDir, '--count', '10']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('feat: remote commit');
  await rm(remoteDir, { recursive: true, force: true });
  await rm(pushDir, { recursive: true, force: true });
});

test('write command exits 1 with no staged changes', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-write-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  const { exitCode, stderr } = await runCli(['write', '--no-llm'], tempDir);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('No staged changes');
  await rm(tempDir, { recursive: true, force: true });
});

test('doctor command checks git availability', async () => {
  const { stdout, exitCode } = await runCli(['doctor']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Git');
});

test('auto-JSON on pipe', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-pipe-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
  await runGit(tempDir, ['config', 'user.name', 'Test']);
  await writeFile(join(tempDir, 'p.txt'), 'p');
  await runGit(tempDir, ['add', 'p.txt']);
  await runGit(tempDir, ['commit', '-m', 'feat: pipe test']);

  const proc = Bun.spawn(['bash', '-c', `cd ${tempDir} && bun ${CLI_PATH} analyze --no-llm | cat`], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  expect(exitCode).toBe(0);
  const json = JSON.parse(stdout);
  expect(json.commits.length).toBe(1);
  await rm(tempDir, { recursive: true, force: true });
});

test('temp dir cleanup on error', async () => {
  try {
    const { exitCode } = await runCli(['analyze', '--url', 'https://invalid-host-that-does-not-exist-12345.example/repo.git', '--count', '1']);
    expect(exitCode).not.toBe(0);
  } catch {
    // expected
  }
});
