# commit-critic

AI-powered terminal tool for reviewing Git commit message quality and writing better commits from staged changes.

commit-critic uses an LLM by default. It can analyze the last commits in the current repository, analyze a remote Git repository, and draft a commit message from `git diff --staged`. A deterministic `--no-llm` fallback exists for offline use, but the primary path is LLM-backed.

## Core workflows

```bash
# Analyze the last 50 commits in the current repository
bunx --bun commit-critic analyze

# Analyze a specific number of commits
bunx --bun commit-critic analyze --count 10

# Analyze a remote repository
bunx --bun commit-critic analyze --url https://github.com/steel-dev/steel-browser

# Write a commit message from staged changes
git add <files>
bunx --bun commit-critic write

# Write a commit message, then optionally run git commit after confirmation
git add <files>
bunx --bun commit-critic write --commit
```

## Requirements

- Bun 1.3.9 or newer
- Git in PATH
- One LLM provider:
  - OpenAI with an API key
  - OpenRouter with an API key
  - A local OpenAI-compatible server such as llama.cpp, LM Studio, vLLM, or Ollama

Install Bun:

```bash
# macOS or Linux
curl -fsSL https://bun.sh/install | bash

# macOS with Homebrew
brew tap oven-sh/bun
brew install bun

# Windows PowerShell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify:

```bash
bun --version
git --version
```

## Run from this source checkout

The package is intended to run through its real CLI bin, not a development wrapper.

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install --frozen-lockfile
bun link
bunx --bun commit-critic --help
```

Inside the source checkout, `bunx --bun commit-critic ...` uses the linked local package.

To use the linked package from another local Git repository:

```bash
cd /path/to/another/repo
bun link commit-critic
bunx --bun commit-critic analyze
```

To remove the local link later:

```bash
bun unlink commit-critic
```

## Run after package publication

```bash
bunx --bun commit-critic --help
bunx --bun commit-critic analyze
bunx --bun commit-critic write
```

## Configure an LLM provider

You can configure the provider with shell environment variables, a `.env` file, or the setup wizard.

```bash
bunx --bun commit-critic setup
bunx --bun commit-critic doctor
```

`doctor` checks Git, repository detection, provider configuration, and the provider `/models` endpoint when available.

### OpenAI

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

bunx --bun commit-critic doctor
bunx --bun commit-critic analyze --count 5
```

`AI_API_KEY` is also accepted for OpenAI:

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export AI_API_KEY=sk-...
```

### OpenRouter

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export OPENROUTER_API_KEY=sk-or-...

bunx --bun commit-critic doctor
bunx --bun commit-critic analyze --count 5
```

`AI_API_KEY` is also accepted for OpenRouter:

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export AI_API_KEY=sk-or-...
```

### Local OpenAI-compatible server

Use `local` for any server that exposes OpenAI-compatible `/v1/completions` and `/v1/models` endpoints.

```bash
export AI_PROVIDER=local
export AI_MODEL=qwen3.6
export AI_BASE_URL=http://localhost:8081/v1

bunx --bun commit-critic doctor
bunx --bun commit-critic analyze --count 5
```

Most local servers do not require an API key. If yours does:

```bash
export LOCAL_API_KEY=your-local-key
# or
export AI_API_KEY=your-local-key
```

Local presets are also supported:

```bash
# llama.cpp, default base URL http://localhost:8081/v1
export AI_PROVIDER=llamacpp
export AI_MODEL=qwen3.6
export LLAMACPP_BASE_URL=http://localhost:8081/v1

# LM Studio, default base URL http://localhost:1234/v1
export AI_PROVIDER=lmstudio
export LM_STUDIO_BASE_URL=http://localhost:1234/v1

# vLLM, supports VLLM_API_KEY when needed
export AI_PROVIDER=vllm
export VLLM_BASE_URL=http://localhost:8000/v1
export VLLM_API_KEY=your-vllm-key

# Ollama OpenAI-compatible endpoint
export AI_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434/v1
```

## Commands

### `analyze`

Analyze commit history. Defaults to the current repository and the last 50 commits.

```bash
bunx --bun commit-critic analyze [flags]
```

Flags:

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: `50`. |
| `--url <url>` | Analyze a remote repository. Supports `https://`, `git@`, `file://`, and absolute local paths. |
| `--no-llm` | Use deterministic scoring only. |
| `--json` | Emit JSON. Output is also JSON when stdout is piped. |
| `--provider <name>` | Override `AI_PROVIDER`. |
| `--model <id>` | Override `AI_MODEL`. |
| `--no-merges` | Exclude merge commits. |
| `--verbose` | Include additional diagnostic details in human output. |

Aliases:

```bash
bunx --bun commit-critic --analyze
bunx --bun commit-critic a
```

Examples:

```bash
bunx --bun commit-critic analyze
bunx --bun commit-critic analyze --count 50
bunx --bun commit-critic analyze --url https://github.com/steel-dev/steel-browser --count 50
bunx --bun commit-critic analyze --json > commit-report.json
bunx --bun commit-critic analyze --provider openrouter --model anthropic/claude-sonnet-4
bunx --bun commit-critic analyze --no-llm
```

Analysis output includes weak commits, strong commits, and aggregate stats:

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

### `write`

Analyze staged changes and suggest a commit message.

```bash
git add <files>
bunx --bun commit-critic write [flags]
```

Flags:

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect a commit type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, or `chore`. |
| `--no-llm` | Use a deterministic template instead of an LLM suggestion. |
| `--provider <name>` | Override `AI_PROVIDER`. |
| `--model <id>` | Override `AI_MODEL`. |
| `--commit` | After accepting a message, ask whether to run `git commit`. Default answer is No. |

Aliases:

```bash
bunx --bun commit-critic --write
bunx --bun commit-critic w
```

Examples:

```bash
git add src README.md
bunx --bun commit-critic write

git add src README.md
bunx --bun commit-critic write --type refactor

git add src README.md
bunx --bun commit-critic write --commit
```

Safe commit behavior:

- `write` prints the accepted message by default and does not create a commit.
- `write --commit` still asks for confirmation before running `git commit`.
- The default confirmation answer is No.

### `doctor`

```bash
bunx --bun commit-critic doctor
```

Runs setup checks for Git, repository detection, provider configuration, and provider connectivity.

### `setup`

```bash
bunx --bun commit-critic setup
```

Interactive provider wizard. It prints the environment values you need and only writes `.env` after explicit confirmation.

Flags:

| Flag | Description |
| --- | --- |
| `--quick` | Exit immediately if the current provider config is valid. |
| `--non-interactive` | Print current config and missing requirements without prompts. |

Examples:

```bash
bunx --bun commit-critic setup
bunx --bun commit-critic setup --quick
bunx --bun commit-critic setup --non-interactive
```

## JSON output

Use `--json` for scripts:

```bash
bunx --bun commit-critic analyze --json > commit-report.json
```

Piped analysis output is JSON automatically:

```bash
bunx --bun commit-critic analyze --no-llm | jq '.summary.overallScore'
```

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
./dist/commit-critic analyze --count 5
```

Compile release binaries:

```bash
bun run compile:linux
./dist/commit-critic-linux-x64 --help

bun run compile:mac-arm
bun run compile:mac-intel
bun run compile:windows
```

Compiled binaries use the same environment variables as `bunx`.

## Development checks

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
bun run compile:linux
```

Recommended local LLM smoke test:

```bash
AI_PROVIDER=llamacpp AI_MODEL=qwen3.6 LLAMACPP_BASE_URL=http://localhost:8081/v1 bunx --bun commit-critic doctor
AI_PROVIDER=llamacpp AI_MODEL=qwen3.6 LLAMACPP_BASE_URL=http://localhost:8081/v1 bunx --bun commit-critic analyze --count 1 --json
```

Recommended API-key smoke test:

```bash
AI_PROVIDER=openai AI_MODEL=gpt-4.1 OPENAI_API_KEY=sk-... bunx --bun commit-critic doctor
AI_PROVIDER=openrouter AI_MODEL=anthropic/claude-sonnet-4 OPENROUTER_API_KEY=sk-or-... bunx --bun commit-critic doctor
```

## File inventory

The published package includes only:

- `README.md`
- `LICENSE`
- `.env.example`
- `src/**/*.ts`, excluding tests and agent-only files

Generated artifacts, internal references, test fixtures, and local build output are excluded.

## Troubleshooting

### `Missing OPENAI_API_KEY`

Set `OPENAI_API_KEY` or the generic `AI_API_KEY`:

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...
```

Or choose another provider:

```bash
export AI_PROVIDER=local
export AI_BASE_URL=http://localhost:8081/v1
```

### `Connectivity: Unreachable`

Check the provider server and base URL. Local URLs should usually include `/v1`:

```bash
export AI_BASE_URL=http://localhost:8081/v1
```

### `No staged changes`

Stage files before running `write`:

```bash
git add <files>
bunx --bun commit-critic write
```

### `Not a git repository`

Run inside a Git repository or analyze a remote URL:

```bash
bunx --bun commit-critic analyze --url https://github.com/steel-dev/steel-browser
```

### LLM output falls back to deterministic scoring

By default, commit-critic keeps running if the provider returns malformed output or is temporarily unavailable. To fail instead of falling back:

```bash
export AI_STRICT_MODE=true
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Command completed successfully. |
| `1` | Command completed but found low-quality commits, or a general error occurred. |
| `3` | Provider configuration is missing or invalid. |
| `10` | User input is invalid, such as an invalid `--count` or missing staged changes. |

## License

MIT
