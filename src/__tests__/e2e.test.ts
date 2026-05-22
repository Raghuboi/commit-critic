/**
 * End-to-end integration tests for the public CLI surface.
 */

import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_PATH = join(process.cwd(), 'src/cli.ts');
const AI_ENV_PREFIXES = ['AI_', 'OPENAI_', 'OPENROUTER_', 'LOCAL_', 'LM_', 'VLLM_', 'OLLAMA_', 'LLAMACPP_'];

function cliEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const env: Record<string, string> = { ...process.env, NO_COLOR: '1', TERM: 'dumb' } as Record<string, string>;
  for (const key of Object.keys(env)) {
    if (AI_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) delete env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

async function runCli(
  args: string[],
  cwd = process.cwd(),
  options: { env?: Record<string, string | undefined>; stdin?: string } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI_PATH, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: options.stdin === undefined ? undefined : new TextEncoder().encode(options.stdin),
    env: cliEnv(options.env),
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

async function createRepo(prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  await runGit(dir, ['init', '-b', 'main']);
  await runGit(dir, ['config', 'user.email', 'test@test.com']);
  await runGit(dir, ['config', 'user.name', 'Test']);
  return dir;
}

async function commitFile(repo: string, fileName: string, content: string, message: string) {
  await writeFile(join(repo, fileName), content);
  await runGit(repo, ['add', fileName]);
  await runGit(repo, ['commit', '-m', message]);
}

test('--analyze flag path works offline in the current repo', async () => {
  const repo = await createRepo('commit-critic-offline-');
  try {
    await commitFile(repo, 'x.txt', 'x', 'wip');
    const { stdout, exitCode } = await runCli(['--analyze', '--no-llm', '--json'], repo);
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.command).toBe('analyze');
    expect(json.commits.length).toBe(1);
    expect(json.commits[0].score).toBeLessThan(5);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('--analyze supports equals-style --url for remote repos', async () => {
  const remoteDir = await mkdtemp(join(tmpdir(), 'commit-critic-remote-'));
  const pushDir = await createRepo('commit-critic-push-');
  try {
    await runGit(remoteDir, ['init', '--bare']);
    await commitFile(pushDir, 'r.txt', 'r', 'feat: remote commit');
    await runGit(pushDir, ['push', remoteDir, 'main']);

    const { stdout, exitCode } = await runCli(['--analyze', '--no-llm', `--url=file://${remoteDir}`, '--count=10']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('feat: remote commit');
  } finally {
    await rm(remoteDir, { recursive: true, force: true });
    await rm(pushDir, { recursive: true, force: true });
  }
});

test('write command exits 10 with no staged changes', async () => {
  const repo = await createRepo('commit-critic-write-empty-');
  try {
    const { exitCode, stderr } = await runCli(['write', '--no-llm'], repo);
    expect(exitCode).toBe(10);
    expect(stderr).toContain('No staged changes');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('analyze emits JSON automatically when stdout is piped', async () => {
  const repo = await createRepo('commit-critic-pipe-');
  try {
    await commitFile(repo, 'p.txt', 'p', 'feat: pipe test');
    const { stdout, exitCode } = await runCli(['analyze', '--no-llm'], repo);
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.commits.length).toBe(1);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('doctor command stays useful when provider config is missing', async () => {
  const repo = await createRepo('commit-critic-doctor-');
  try {
    const { stdout, exitCode } = await runCli(['doctor'], repo);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Git: Available');
    expect(stdout).toContain('Repository: Git repository detected');
    expect(stdout).toContain('Provider config:');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('setup command quick exits zero when local provider config is valid', async () => {
  const { stdout, exitCode } = await runCli(['setup', '--quick'], process.cwd(), {
    env: {
      AI_PROVIDER: 'local',
      AI_MODEL: 'local-model',
      AI_BASE_URL: 'http://localhost:8081/v1',
    },
  });
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Provider:');
  expect(stdout).toContain('Provider config is valid');
});

test('analyze rejects invalid --count before reading commits', async () => {
  const repo = await createRepo('commit-critic-invalid-count-');
  try {
    const { stderr, exitCode } = await runCli(['analyze', '--count', '0', '--no-llm'], repo);
    expect(exitCode).toBe(10);
    expect(stderr).toContain('Invalid --count value');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('doctor masks configured API keys', async () => {
  const repo = await createRepo('commit-critic-doctor-mask-');
  try {
    const { stdout, exitCode } = await runCli(['doctor'], repo, {
      env: {
        AI_PROVIDER: 'openai',
        AI_MODEL: 'test-model',
        AI_BASE_URL: 'https://example.com/v1',
        AI_API_KEY: 'sk-1234567890abcdef',
      },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('OPENAI_API_KEY=sk-...cdef');
    expect(stdout).not.toContain('sk-1234567890abcdef');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('write rejects invalid commit type before prompting', async () => {
  const repo = await createRepo('commit-critic-invalid-type-');
  try {
    await writeFile(join(repo, 'invalid-type.txt'), 'hello');
    await runGit(repo, ['add', 'invalid-type.txt']);

    const { stderr, exitCode } = await runCli(['write', '--no-llm', '--type', 'invalid'], repo);
    expect(exitCode).toBe(10);
    expect(stderr).toContain('Invalid --type value');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('write accepts prefilled prompt values and prints a commit message', async () => {
  const repo = await createRepo('commit-critic-write-prefill-');
  try {
    await commitFile(repo, 'initial.txt', 'init', 'feat: initial commit');
    await writeFile(join(repo, 'docs.md'), 'usage notes');
    await runGit(repo, ['add', 'docs.md']);

    const { stdout, exitCode } = await runCli(
      ['--write', '--no-llm', '--type', 'docs', '--scope', 'readme', '--description', 'add usage notes'],
      repo,
      { stdin: '\n' }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('docs.md');
    expect(stdout).toContain('docs(readme): add usage notes');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
