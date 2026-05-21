# src/__tests__/ — Test Conventions

## Test Framework

- Bun built-in test runner (`bun test`)
- Import: `import { test, expect } from 'bun:test'`
- No external test runner needed

## Test File Mapping

| Test File | Tests |
|-----------|-------|
| `scorer.test.ts` | Deterministic scoring rules |
| `analyzer.test.ts` | Score combination, --no-llm mode |
| `git.test.ts` | Git operations (temp repos) |
| `llm.test.ts` | LLM integration (mocked provider) |
| `config.test.ts` | Config resolution |
| `output.test.ts` | Terminal/JSON output formatting |
| `e2e.test.ts` | End-to-end CLI integration |

## Non-Negotiable v1 Tests

1. `analyze` reads commits from a local temp Git repo
2. `analyze --url` works through a local file-based remote or mocked clone path
3. `write` detects staged changes and produces a suggested commit message through a fake/mocked LLM provider
4. Deterministic scoring catches obvious weak messages (`wip`, `fixed bug`, one-word commits)
5. JSON output has the expected top-level shape
6. Provider config resolves env vars and fails clearly when required config is missing

## Defer or Smoke-Only

- Full CLI snapshot coverage
- Executable binary tests
- Live remote repository tests
- Live LLM provider tests
- Terminal animation/spinner tests
- Full `doctor` diagnostics
- Exhaustive `NO_COLOR` / pipe behavior tests
- Large diff/token-budget edge-case matrix

## Temp Repo Pattern

```typescript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-test-'));
  await Bun.$`git init -b main`.cwd(tempDir);
  await Bun.$`git config user.email "test@test.com"`.cwd(tempDir);
  await Bun.$`git config user.name "Test"`.cwd(tempDir);
  // Add commits...
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('reads commits from temp repo', async () => {
  const commits = await getCommits(tempDir, 50);
  expect(commits.length).toBeGreaterThan(0);
});
```

## Mock LLM Pattern

```typescript
import { MockLanguageModelV4 } from 'ai/test';

const mockModel = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: 'text', text: JSON.stringify(mockResult) }],
    finishReason: { unified: 'stop', raw: undefined },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 20, text: 20, reasoning: undefined },
    },
    warnings: [],
  }),
});
```

## Test Data Rules

- Use inline test data for small cases
- Use temp repos for git integration tests
- Never use live API keys in tests
- Mock all LLM calls
