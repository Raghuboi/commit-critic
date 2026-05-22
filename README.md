# commit-critic

AI-powered terminal tool for reviewing Git commit message quality and writing better commits from staged changes.

commit-critic uses an LLM by default. It reviews recent commit history, explains weak messages, scores quality, suggests stronger alternatives, and drafts commit messages from `git diff --staged`. A deterministic `--no-llm` mode is included for offline fallback, but the normal path is LLM-backed.

## What it does

- Analyze the latest commits in the current Git repository.
- Analyze a remote repository from a Git URL.
- Critique each commit with a score, issue, better example, and aggregate stats.
- Draft an interactive commit message from staged changes.
- Optionally commit staged changes only after explicit confirmation.
- Verify Git and LLM configuration with `doctor`.
- Configure provider environment variables with `setup`.

## Requirements

- Bun 1.3.9 or newer
- Git in PATH
- One LLM provider:
  - OpenAI
  - OpenRouter
  - Any local OpenAI-compatible server, such as llama.cpp, LM Studio, vLLM, or Ollama

## Install Bun

macOS or Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

macOS with Homebrew:

```bash
brew tap oven-sh/bun
brew install bun
```

Windows PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Windows with Scoop:

```powershell
scoop install bun
```

Verify Bun:

```bash
bun --version
```

## Install commit-critic from source

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install
bun run dev --help
```

`bun run dev ...` runs the CLI directly from `src/cli.ts`. A build step is not required for normal development or review.

## Configure an LLM provider

You can use environment variables, a `.env` file, or the setup wizard.

```bash
bun run dev setup
bun run dev doctor
```

Default provider:

```bash
AI_PROVIDER=openai
AI_MODEL=gpt-4.1
```

Override provider/model per command:

```bash
bun run dev analyze --provider local --model qwen3.6
bun run dev write --provider openrouter --model anthropic/claude-sonnet-4
```

### OpenAI

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...
```

`AI_API_KEY` is also accepted when `AI_PROVIDER=openai`, but `OPENAI_API_KEY` is clearer.

### OpenRouter

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export OPENROUTER_API_KEY=sk-or-...
```

`AI_API_KEY` is also accepted when `AI_PROVIDER=openrouter`, but `OPENROUTER_API_KEY` is clearer.

### Local OpenAI-compatible provider

Use `local` for llama.cpp, LM Studio, vLLM, Ollama, or any server that exposes OpenAI-compatible `/v1/completions` and `/v1/models` endpoints.

```bash
export AI_PROVIDER=local
export AI_MODEL=qwen3.6
export AI_BASE_URL=http://localhost:8081/v1
```

No API key is required for most local servers. If your local server requires one:

```bash
export LOCAL_API_KEY=your-local-key
```

Legacy provider names still work as aliases for `local`:

```bash
export AI_PROVIDER=llamacpp   # alias for local, default http://localhost:8081/v1
export AI_PROVIDER=lmstudio   # alias for local, default http://localhost:1234/v1
export AI_PROVIDER=vllm       # alias for local, default http://localhost:8000/v1
export AI_PROVIDER=ollama     # alias for local, default http://localhost:11434/v1
```

Prefer new configuration for fresh setups:

```bash
AI_PROVIDER=local
AI_MODEL=<your-model-id>
AI_BASE_URL=<your-openai-compatible-base-url>
```

## Verify setup

```bash
bun run dev doctor
```

`doctor` checks:

- Git is installed.
- The current directory is a Git repository.
- Provider configuration is present.
- The provider `/models` endpoint is reachable when configuration is valid.

Git and repository failures are critical. Provider and connectivity failures are warnings so `doctor` remains useful while you are still setting up credentials.

## Command reference

### analyze

Analyze commit history. Defaults to the current repository and last 50 commits.

```bash
bun run dev analyze [flags]
```

Flags:

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: `50`. |
| `--url <url>` | Clone and analyze a remote repository. Supports `https://`, `git@`, `file://`, and absolute local paths. |
| `--no-llm` | Offline deterministic scoring only. |
| `--json` | Write JSON output. Output is also JSON when stdout is piped. |
| `--provider <name>` | Override `AI_PROVIDER`. Supports `openai`, `openrouter`, `local`, and local aliases. |
| `--model <id>` | Override `AI_MODEL`. |
| `--no-merges` | Exclude merge commits. |
| `--verbose` | Include additional diagnostic stats in human output. |

Aliases:

```bash
bun run dev --analyze
bun run dev a
```

### write

Analyze staged changes and suggest a commit message.

```bash
git add <files>
bun run dev write [flags]
```

Flags:

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect commit type, such as `feat`, `fix`, `docs`, or `refactor`. |
| `--no-llm` | Use a deterministic template instead of an LLM suggestion. |
| `--provider <name>` | Override `AI_PROVIDER`. |
| `--model <id>` | Override `AI_MODEL`. |
| `--commit` | After accepting a message, ask whether to run `git commit`. Default answer is No. |

Aliases:

```bash
bun run dev --write
bun run dev w
```

### doctor

```bash
bun run dev doctor
```

Runs setup checks for Git, repository detection, provider configuration, and provider connectivity.

### setup

```bash
bun run dev setup
```

Interactive provider wizard. It prints the environment variables you need and only writes `.env` after explicit confirmation.

Flags:

| Flag | Description |
| --- | --- |
| `--quick` | Exit immediately if current provider config is valid. |
| `--non-interactive` | Print current config and missing requirements without prompts. |

## Examples

Analyze last 50 commits in the current repo with the configured LLM:

```bash
bun run dev analyze
```

Analyze last 10 commits:

```bash
bun run dev analyze --count 10
```

Analyze a remote repository:

```bash
bun run dev analyze --url https://github.com/steel-dev/steel-browser
```

Use the top-level analysis alias:

```bash
bun run dev --analyze
```

Write a commit message from staged changes:

```bash
git add src README.md
bun run dev write
```

Write and then optionally commit after confirmation:

```bash
git add src README.md
bun run dev write --commit
```

Use the local provider for one command:

```bash
AI_PROVIDER=local AI_MODEL=qwen3.6 AI_BASE_URL=http://localhost:8081/v1 bun run dev analyze --count 3
```

Offline fallback:

```bash
bun run dev analyze --no-llm
bun run dev write --no-llm
```

## Output

Analysis output includes three sections:

```text
COMMITS THAT NEED WORK
Commit: "fixed bug"
Score: 2/10
Issue: Too vague - which bug or behavior changed?
Better: "fix(auth): handle expired token refresh"

WELL-WRITTEN COMMITS
Commit: "feat(api): add Redis caching for read endpoints"
Score: 8/10
Why it's good: Clear type, scope, and specific behavior.

YOUR STATS
Average score: 6.8/10
Vague commits: 4 (8%)
One-word commits: 1 (2%)
```

JSON output is stable for scripts:

```bash
bun run dev analyze --json > commit-report.json
bun run dev analyze --no-llm | jq '.summary.overallScore'
```

## Run with bunx

After the package is published or installed in another project:

```bash
bunx --bun commit-critic analyze
bunx --bun commit-critic write
```

To smoke-test the package from a local checkout with `bunx`, install it as a file dependency in a scratch directory:

```bash
mkdir /tmp/commit-critic-smoke
cd /tmp/commit-critic-smoke
bun init -y
bun add file:/absolute/path/to/commit-critic
bunx --bun commit-critic --help
```

The package bin points at `src/cli.ts` and uses `#!/usr/bin/env bun`, so Bun can execute the TypeScript source directly.

## Build and compile

Bundle to JavaScript:

```bash
bun run build
bun ./dist/cli.js --help
```

Compile a standalone binary for the current platform:

```bash
bun run compile
./dist/commit-critic --help
```

Compile named release binaries:

```bash
bun run compile:linux
./dist/commit-critic-linux-x64 --help
bun run compile:mac-arm
bun run compile:mac-intel
bun run compile:windows
```

Compiled binaries still read the same environment variables.

## Dependencies

Runtime dependencies:

| Dependency | Purpose |
| --- | --- |
| Bun | Runtime, package manager, test runner, bundler, compiler. |
| Git | Reads commit history, staged diffs, remote repositories, and optional commits. |
| AI SDK | LLM calls and structured/text generation. |
| `@ai-sdk/openai` | OpenAI provider. |
| `@ai-sdk/openai-compatible` | OpenRouter and local OpenAI-compatible providers. |
| clipanion | Command parsing. |
| Zod | LLM response validation. |
| Inquirer | Interactive prompts. |
| picocolors | Terminal color. |
| TypeScript | Strict source typing. |

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

Recommended local LLM smoke test:

```bash
AI_PROVIDER=local AI_MODEL=qwen3.6 AI_BASE_URL=http://localhost:8081/v1 bun run dev doctor
AI_PROVIDER=local AI_MODEL=qwen3.6 AI_BASE_URL=http://localhost:8081/v1 bun run dev analyze --count 1
```

## Troubleshooting

`Missing OPENAI_API_KEY`

Set `OPENAI_API_KEY`, choose another provider with `AI_PROVIDER`, or run `bun run dev setup`.

`Connectivity: Unreachable`

Check that the provider server is running and that the base URL includes `/v1`, for example:

```bash
AI_BASE_URL=http://localhost:8081/v1
```

`No staged changes`

Run `git add <files>` before `commit-critic write`.

`Not a git repository`

Run the command inside a Git repository or use `analyze --url <repo-url>`.

LLM output falls back to deterministic scoring

Non-strict mode keeps the CLI usable when the provider returns malformed JSON or is temporarily unavailable. Set `AI_STRICT_MODE=true` if you want LLM failures to stop the command.

## License

MIT
