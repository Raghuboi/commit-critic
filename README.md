# commit-critic

Stop shipping `fix stuff` commits.

`commit-critic` is an LLM-powered terminal tool for improving Git commit messages. It reviews recent commit history, explains what makes messages weak or strong, and helps write a clear commit message from staged changes.

Two workflows matter most:

- `analyze`: score and critique recent commits in the current repo or a remote Git URL.
- `write`: read `git diff --staged`, summarize the change, and suggest a Conventional Commit you can accept, edit, regenerate, or replace.

## Requirements

- Bun 1.3.9+
- Git in `PATH`
- An OpenAI API key, an OpenAI-compatible hosted endpoint, or a local OpenAI-compatible server

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quickstart

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install --frozen-lockfile

# Default path: OpenAI or a hosted OpenAI-compatible /v1 endpoint
export AI_PROVIDER=openai
export AI_MODEL=<model-name>
export AI_API_KEY=<api-key>
export AI_BASE_URL=https://provider.example/v1   # omit for api.openai.com

bun ./src/cli.ts doctor
bun ./src/cli.ts analyze --count 5

git add <files>
bun ./src/cli.ts write
```

If you are using OpenAI directly, use `OPENAI_API_KEY` instead of `AI_API_KEY` and omit `AI_BASE_URL`:

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...
```

## Provider setup

`commit-critic` uses LLM mode by default. `doctor` is the fastest way to verify config before running analysis or commit writing.

### OpenAI-compatible endpoint

Use this for hosted providers that implement the OpenAI `/v1` API:

```bash
export AI_PROVIDER=openai
export AI_MODEL=<provider-model-id>
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<provider-api-key>

bun ./src/cli.ts doctor
bun ./src/cli.ts analyze --count 5 --json
```

Provider-specific aliases also work:

```bash
export OPENAI_BASE_URL=https://provider.example/v1
export OPENAI_API_KEY=<provider-api-key>
```

### OpenAI

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

bun ./src/cli.ts doctor
```

### OpenRouter

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export OPENROUTER_API_KEY=sk-or-...

bun ./src/cli.ts doctor
```

### Local OpenAI-compatible server

Local providers are useful for private repos or offline development. The generic `local` provider expects an OpenAI-compatible server at `http://localhost:8081/v1` by default.

```bash
export AI_PROVIDER=local
export AI_MODEL=local-model
export AI_BASE_URL=http://localhost:8081/v1

bun ./src/cli.ts doctor
```

Preset provider names are also available:

| Provider | Default base URL | Notes |
| --- | --- | --- |
| `llamacpp` | `http://localhost:8081/v1` | Uses the completions endpoint for better local reasoning-model output |
| `lmstudio` | `http://localhost:1234/v1` | Local LM Studio server |
| `vllm` | `http://localhost:8000/v1` | Local or hosted vLLM server |
| `ollama` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint |

For local servers that require auth, set `LOCAL_API_KEY`, `VLLM_API_KEY`, or the generic `AI_API_KEY`.

## Commands

From a source checkout:

```bash
bun ./src/cli.ts <command>
```

After installing the package or compiling a binary:

```bash
commit-critic <command>
```

### Analyze commit history

```bash
# Analyze the last 50 commits in the current repo
commit-critic analyze

# Analyze fewer commits
commit-critic analyze --count 10

# Analyze a remote repository
commit-critic analyze --url https://github.com/steel-dev/steel-browser

# Machine-readable output
commit-critic analyze --count 10 --json
```

Terminal output groups weak commits, strong commits, and repo-level stats:

```text
Analyzing 50 commits...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMITS THAT NEED WORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit: "fixed bug"
Score: 2/10
Issue: Too vague - which bug? What was the impact?
Better: "fix(auth): resolve token expiration handling"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WELL-WRITTEN COMMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit: "feat(api): add Redis caching layer"
Score: 9/10
Why it's good: Clear scope, specific change, and useful context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average score: 7.4/10
Vague commits: 3 (6%)
One-word commits: 0 (0%)
```

When stdout is piped, JSON output is enabled automatically. Top-level JSON fields include `version`, `command`, `repo`, `commitCount`, `overallScore`, `summary`, `commits`, `stats`, `topIssues`, and `durationMs`.

Useful flags:

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: 50 |
| `--url <url>` | Analyze a remote repo using `https://`, `git@`, `file://`, or an absolute path |
| `--provider <name>` | Override `AI_PROVIDER` for one run |
| `--model <name>` | Override `AI_MODEL` for one run |
| `--no-llm` | Use deterministic scoring only |
| `--no-merges` | Exclude merge commits |
| `--json` | Force JSON output |

Aliases: `commit-critic a`, `commit-critic --analyze`

### Write a commit message

`write` reads staged changes. It does not commit unless you pass `--commit`, and even then it asks for confirmation.

```bash
git add <files>
commit-critic write

# Preselect type
commit-critic write --type refactor

# Pre-fill prompt values while still reviewing the generated message
commit-critic write --type docs --scope readme --description "clarify setup"

# Offer to commit after accepting the message
commit-critic write --commit
```

Example flow:

```text
Analyzing staged changes... (3 files changed, +82 -19 lines)

Changes detected:
  - Tightened provider config resolution
  - Added tests for base URL precedence
  - Updated setup copy for compatible endpoints

Suggested commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
refactor(config): align provider URL precedence

- Prefer provider-specific base URL vars over AI_BASE_URL
- Keep AI_BASE_URL as the generic compatible endpoint
- Add regression coverage for fallback behavior
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Press Enter to accept, type a custom message, or /e=edit /r=regenerate /c=cancel:
```

Useful flags:

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect commit type |
| `--scope <scope>` | Pre-fill optional scope |
| `--description <text>` | Pre-fill the short description prompt |
| `--provider <name>` | Override `AI_PROVIDER` for one run |
| `--model <name>` | Override `AI_MODEL` for one run |
| `--no-llm` | Use a deterministic template |
| `--commit` | Ask to run `git commit` after accepting the message |

Aliases: `commit-critic w`, `commit-critic --write`

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

`setup` supports standard OpenAI, OpenRouter, and a generic local endpoint. For hosted OpenAI-compatible endpoints, set the environment variables shown above or copy `.env.example` to `.env` and edit it.

## Running through bunx

For a local package install from another project:

```bash
bun add file:/path/to/commit-critic
bunx --bun commit-critic --help
bunx --bun commit-critic doctor
```

For development inside this repo, `bun ./src/cli.ts ...` is the most direct path.

## Build and compile

```bash
# Bundled JavaScript
bun run build
bun ./dist/cli.js --help

# Standalone binary for your current platform
bun run compile
./dist/commit-critic --help

# Linux x64 binary
bun run compile:linux
./dist/commit-critic-linux-x64 --help
```

Compiled binaries use the same commands and environment variables as the Bun entry point.

## Offline fallback

LLM mode is the main workflow. Use `--no-llm` when you need a quick deterministic smoke test or your provider is temporarily unavailable:

```bash
bun ./src/cli.ts analyze --no-llm --count 1 --json
bun ./src/cli.ts write --no-llm
```

Set strict mode if you want provider errors to fail the command instead of falling back:

```bash
export AI_STRICT_MODE=true
```

## Development checks

```bash
bun run typecheck
bun test
bun run build
bun run compile:linux
bun pm pack --dry-run
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. Analysis exits 0 even when commits need work |
| `1` | Operational error such as Git, I/O, or unexpected failure |
| `3` | Provider auth or config error |
| `10` | Invalid input such as bad `--count`, invalid `--type`, or no staged changes |

## Troubleshooting

### `doctor` reports a missing key

Set a provider-specific key or the generic alias:

```bash
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-...

# compatible endpoint
export AI_PROVIDER=openai
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<provider-api-key>
```

### Connectivity fails

Check that the base URL includes `/v1`, the model name exists on that provider, and the server is reachable:

```bash
commit-critic doctor
commit-critic analyze --count 1 --json
```

### `write` says there are no staged changes

Stage files first:

```bash
git add <files>
commit-critic write
```

### Not in a Git repository

Run inside a repo or pass a remote URL:

```bash
commit-critic analyze --url https://github.com/user/repo
```

## License

MIT
