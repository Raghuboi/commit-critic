# commit-critic

Stop shipping `fix stuff` commits.

`commit-critic` is an LLM-powered terminal tool that reviews Git commit message quality and helps you write clearer commits from staged changes. It is built for the workflow developers already use: inspect the current repo, analyze a remote repo when needed, and turn `git diff --staged` into a clean Conventional Commit.

## What it does

- Reviews recent commits with AI-generated critique
- Highlights weak messages and well-written messages
- Reports commit quality stats such as vague and one-word commits
- Suggests a commit message from staged changes
- Runs against OpenAI-compatible `/v1` endpoints or a local model server
- Falls back to deterministic `--no-llm` mode for offline checks

## Requirements

- Bun 1.3.9+
- Git in `PATH`
- An OpenAI-compatible endpoint, or a local OpenAI-compatible server

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quickstart

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install --frozen-lockfile

export AI_PROVIDER=openai
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<api-key>
export AI_MODEL=<model-name>

bun ./src/cli.ts doctor
bun ./src/cli.ts --analyze
```

For OpenAI directly, you can omit `AI_BASE_URL`:

```bash
export AI_PROVIDER=openai
export AI_API_KEY=<openai-api-key>
export AI_MODEL=gpt-4.1

bun ./src/cli.ts doctor
bun ./src/cli.ts --analyze --count=5
```

For a local server at `localhost:8081`:

```bash
export AI_PROVIDER=local
export AI_BASE_URL=http://localhost:8081/v1
export AI_MODEL=qwen3.6

bun ./src/cli.ts doctor
bun ./src/cli.ts --analyze --count=5
```

## Commands

From source, replace `commit-critic` with `bun ./src/cli.ts`.

### Analyze the current repo

```bash
commit-critic --analyze
```

By default this reviews the last 50 commits in the current Git repository.

Equivalent subcommand form:

```bash
commit-critic analyze
```

Useful variants:

```bash
# Analyze fewer commits
commit-critic --analyze --count=10

# Analyze a remote repository
commit-critic --analyze --url="https://github.com/steel-dev/steel-browser"

# Force machine-readable output
commit-critic --analyze --count=10 --json

# Deterministic offline check, no provider call
commit-critic --analyze --count=3 --no-llm
```

Example terminal output:

```text
Analyzing last 50 commits...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💩 COMMITS THAT NEED WORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit: "fixed bug"
Score: 2/10
Issue: Too vague - which bug? What was the impact?
Better: "fix(auth): resolve token expiration handling"

Commit: "wip"
Score: 1/10
Issue: No information about what's in progress
Better: "feat: describe the work in progress"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 WELL-WRITTEN COMMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit: "feat(api): add Redis caching layer"
Score: 9/10
Why it's good: Clear scope, specific change, and useful context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average score: 4.2/10
Vague commits: 34 (68%)
One-word commits: 12 (24%)
```

When stdout is piped, JSON output is enabled automatically. Top-level JSON fields are `version`, `command`, `repo`, `commitCount`, `overallScore`, `summary`, `commits`, `stats`, `topIssues`, and `durationMs`.

### Write a commit message

```bash
commit-critic --write
```

`--write` reads `git diff --staged`, summarizes the staged changes, suggests a Conventional Commit message, and prompts you to accept, edit, regenerate, cancel, or type your own message.

It does not run `git commit` unless you pass `--commit`.

Equivalent subcommand form:

```bash
commit-critic write
```

Common workflow:

```bash
git add <files>
commit-critic --write
```

Prefill the prompt when you already know the intent:

```bash
commit-critic --write --type=refactor --scope=config
commit-critic --write --type=docs --scope=readme --description="clarify setup"
commit-critic --write --commit
```

Example flow:

```text
Analyzing staged changes... (3 files changed, +82 -19 lines)

Changes detected:
  • Modified provider configuration
  • Added setup validation
  • Updated README examples

Suggested commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
refactor(config): simplify provider setup

- Prefer AI_BASE_URL and AI_API_KEY for compatible endpoints
- Keep local model setup explicit
- Update tests for provider validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Press Enter to accept, type a custom message, or /e=edit /r=regenerate /c=cancel:
```

### Check setup

```bash
commit-critic doctor
```

`doctor` checks Git, repository detection, provider configuration, and provider connectivity. API keys are masked in diagnostic output.

### Configure interactively

```bash
commit-critic setup
commit-critic setup --quick
commit-critic setup --non-interactive
```

`setup` prints the environment values commit-critic needs. It writes `.env` only after explicit confirmation and uses private file permissions.

## LLM configuration

LLM analysis is the default. Use `--no-llm` only when you want an offline deterministic check.

### OpenAI-compatible endpoint

Use this for OpenAI or any provider that implements the OpenAI `/v1` API:

```bash
export AI_PROVIDER=openai
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<api-key>
export AI_MODEL=<model-name>

commit-critic doctor
commit-critic --analyze --count=5
```

For OpenAI's hosted API, omit `AI_BASE_URL`:

```bash
export AI_PROVIDER=openai
export AI_API_KEY=<openai-api-key>
export AI_MODEL=gpt-4.1
```

`OPENAI_API_KEY` and `OPENAI_BASE_URL` also work. Provider-specific values take precedence over generic `AI_API_KEY` and `AI_BASE_URL`.

### Local model

Use a local OpenAI-compatible server when you want to run without hosted provider calls:

```bash
export AI_PROVIDER=local
export AI_BASE_URL=http://localhost:8081/v1
export AI_MODEL=qwen3.6

commit-critic doctor
commit-critic --analyze --count=5
```

For local servers that require auth, set `AI_API_KEY` or `LOCAL_API_KEY`.

Additional provider presets are available in the CLI for common OpenAI-compatible servers (`llamacpp`, `lmstudio`, `vllm`, `ollama`, and `openrouter`), but the generic `AI_BASE_URL` path is usually enough.

## Run methods

### Source checkout

```bash
bun ./src/cli.ts --help
bun ./src/cli.ts doctor
bun ./src/cli.ts --analyze --count=5
```

### Local install and bunx

From another project:

```bash
bun add file:/path/to/commit-critic
bunx --bun commit-critic --help
bunx --bun commit-critic --analyze --count=5
```

The package is Bun-native, so use `bunx --bun`.

### Compile a binary

```bash
bun run compile
./dist/commit-critic --help
./dist/commit-critic --analyze --count=5
```

Cross-platform targets are also available:

```bash
bun run compile:linux
bun run compile:mac-arm
bun run compile:mac-intel
bun run compile:windows
```

Compiled binaries use the same commands and environment variables as the Bun entry point.

## Important flags

### Analysis flags

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: 50 |
| `--url <url>` | Analyze `https://`, `git@`, `file://`, or an absolute path |
| `--provider <name>` | Override `AI_PROVIDER` for one run |
| `--model <name>` | Override `AI_MODEL` for one run |
| `--no-llm` | Use deterministic scoring only |
| `--no-merges` | Exclude merge commits |
| `--json` | Force JSON output |

### Write flags

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect commit type |
| `--scope <scope>` | Pre-fill optional scope |
| `--description <text>` | Pre-fill the short description prompt |
| `--provider <name>` | Override `AI_PROVIDER` for one run |
| `--model <name>` | Override `AI_MODEL` for one run |
| `--no-llm` | Use a deterministic template |
| `--commit` | Ask to run `git commit` after accepting the message |

## Development checks

```bash
bun run typecheck
bun test
bun run build
bun run compile
bun pm pack --dry-run
```

## Security notes

- Do not commit `.env` files or API keys.
- `doctor` masks configured API keys before printing them.
- `setup` writes `.env` with private permissions.
- Git and subprocess calls use argument arrays instead of shell string interpolation.
- Remote analysis clones into a temporary directory and cleans it up after the run.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. Analysis exits 0 even when commits need work |
| `1` | Operational error such as Git, I/O, or unexpected failure |
| `3` | Provider auth or config error |
| `10` | Invalid input such as bad `--count`, invalid `--type`, or no staged changes |

## Troubleshooting

### `doctor` reports a missing key

Set the generic compatible endpoint variables:

```bash
export AI_PROVIDER=openai
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<api-key>
export AI_MODEL=<model-name>

commit-critic doctor
```

For OpenAI directly:

```bash
export AI_PROVIDER=openai
export AI_API_KEY=<openai-api-key>
export AI_MODEL=gpt-4.1

commit-critic doctor
```

### Connectivity fails

Check that the base URL includes `/v1`, the model name exists on that provider, and the server is reachable:

```bash
commit-critic doctor
commit-critic --analyze --count=1 --json
```

### `--write` says there are no staged changes

Stage files first:

```bash
git add <files>
commit-critic --write
```

### Not in a Git repository

Run inside a repo or pass a remote URL:

```bash
commit-critic --analyze --url="https://github.com/user/repo"
```

## License

MIT
