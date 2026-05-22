/**
 * End-to-end integration tests
 */

import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_PATH = join(process.cwd(), 'src/cli.ts');

const AI_ENV_PREFIXES = ['AI_', 'OPENAI_', 'OPENROUTER_', 'LOCAL_', 'LM_', 'VLLM_', 'OLLAMA_', 'LLAMACPP_'];

function cliEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const env: Record<string, string> = { ...process.env, NO_COLOR: '1' } as Record<string, string>;
  for (const key of Object.keys(env)) {
    if (AI_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete env[key];
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

async function runCli(
  args: string[],
  cwd?: string,
  envOverrides?: Record<string, string | undefined>
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI_PATH, ...args], {
    cwd: cwd || process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: cliEnv(envOverrides),
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

test('analyze command with --no-llm works offline', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-offline-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
  await runGit(tempDir, ['config', 'user.name', 'Test']);
  await writeFile(join(tempDir, 'x.txt'), 'x');
  await runGit(tempDir, ['add', 'x.txt']);
  await runGit(tempDir, ['commit', '-m', 'wip']);

  const { stdout, exitCode } = await runCli(['analyze', '--no-llm', '--json'], tempDir);
  expect(exitCode).toBe(0); // analysis succeeds even with poor score
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

test('write command exits 10 with no staged changes', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-write-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  const { exitCode, stderr } = await runCli(['write', '--no-llm'], tempDir);
  expect(exitCode).toBe(10); // EXIT_BAD_INPUT for user input error
  expect(stderr).toContain('No staged changes');
  await rm(tempDir, { recursive: true, force: true });
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

test('setup command quick exits zero when local provider config is valid', async () => {
  const { stdout, exitCode } = await runCli(['setup', '--quick'], undefined, {
    AI_PROVIDER: 'local',
    AI_MODEL: 'local-model',
    AI_BASE_URL: 'http://localhost:8081/v1',
  });
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Provider:');
  expect(stdout).toContain('Provider config is valid');
});

test('write rejects invalid commit type before prompting', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-invalid-type-'));
  try {
    await runGit(tempDir, ['init', '-b', 'main']);
    await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
    await runGit(tempDir, ['config', 'user.name', 'Test']);
    await writeFile(join(tempDir, 'invalid-type.txt'), 'hello');
    await runGit(tempDir, ['add', 'invalid-type.txt']);

    const { stderr, exitCode } = await runCli(['write', '--no-llm', '--type', 'invalid'], tempDir);
    expect(exitCode).toBe(10);
    expect(stderr).toContain('Invalid --type value');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('write command with staged changes shows files', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-write-staged-'));
  await runGit(tempDir, ['init', '-b', 'main']);
  await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
  await runGit(tempDir, ['config', 'user.name', 'Test']);
  await writeFile(join(tempDir, 'initial.txt'), 'init');
  await runGit(tempDir, ['add', 'initial.txt']);
  await runGit(tempDir, ['commit', '-m', 'feat: initial commit']);
  await writeFile(join(tempDir, 'new-feature.ts'), 'export function feature() {}');
  await runGit(tempDir, ['add', 'new-feature.ts']);

  const proc = Bun.spawn(
    ['bun', CLI_PATH, 'write', '--no-llm'],
    {
      cwd: tempDir,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: undefined,
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
    }
  );
  setTimeout(() => proc.kill(), 3000);
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  expect(stdout).toContain('new-feature.ts');
  await rm(tempDir, { recursive: true, force: true });
});
