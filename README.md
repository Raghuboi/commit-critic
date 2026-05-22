# commit-critic

AI-powered commit message review and commit writing in your terminal. Point it at a Git repository, let an LLM critique recent commit history, then use the interactive writer to turn staged changes into a clear Conventional Commit.

## What it does

`commit-critic` has two primary workflows:

1. `analyze` reviews existing commit messages in the current repository or a remote repository URL.
2. `write` reads `git diff --staged`, summarizes the detected changes, and suggests a commit message you can accept, edit, regenerate, or replace.

The tool uses deterministic checks for reliable baseline signals and an LLM for semantic critique. If the LLM is unavailable, it can fall back to deterministic scoring unless strict mode is enabled.

## Requirements

- Bun 1.3.9+
- Git in PATH
- An LLM API key, or an OpenAI-compatible local or hosted endpoint

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
# or: brew install bun
```

## Quickstart from source

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install --frozen-lockfile

export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

bun ./src/cli.ts doctor
bun ./src/cli.ts analyze

git add <files>
bun ./src/cli.ts write
```

That is the core workflow:

1. `doctor` checks Git, repository detection, provider config, and provider connectivity.
2. `analyze` reviews recent commit messages in the current repo.
3. `write` reads staged changes and suggests a commit message interactively.

## Running commands

From a source checkout, run commands through Bun:

```bash
bun ./src/cli.ts <command>
```

After installing or linking the package, use the shorter binary form:

```bash
commit-critic <command>
```

The examples below use `commit-critic` for readability. If the binary is not on your PATH, replace it with `bun ./src/cli.ts`.

## Package usage

If the package is installed or linked, use the `commit-critic` binary:

```bash
bunx --bun commit-critic doctor
bunx --bun commit-critic analyze
bunx --bun commit-critic write
```

For local development, you can link the package:

```bash
bun link
cd /path/to/another/repo
bun link commit-critic
commit-critic analyze
```

## LLM provider setup

### OpenAI

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

commit-critic doctor
```

### Hosted OpenAI-compatible API

Use this path for hosted APIs that implement the OpenAI chat completions format. Keep `AI_PROVIDER=openai` and override the base URL.

```bash
export AI_PROVIDER=openai
export AI_MODEL=MiniMax-M2.7
export AI_BASE_URL=https://api.minimax.io/v1
export AI_API_KEY=your-api-key

commit-critic doctor
commit-critic analyze --count 5 --json
```

`OPENAI_BASE_URL` and `OPENAI_API_KEY` also work. Provider-specific variables take precedence over the generic `AI_BASE_URL` and `AI_API_KEY` aliases.

The interactive `setup` command covers standard OpenAI, OpenRouter, and a generic local endpoint. For a hosted compatible endpoint, set the four variables above manually or copy `.env.example` to `.env` and edit them there.

### OpenRouter

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export OPENROUTER_API_KEY=sk-or-...

commit-critic doctor
```

### Local OpenAI-compatible server

Local servers are useful for private repositories or offline development.

```bash
export AI_PROVIDER=llamacpp
export AI_MODEL=qwen3.6
export LLAMACPP_BASE_URL=http://localhost:8081/v1

commit-critic doctor
```

Supported provider values:

| Provider | Purpose | Default base URL |
| --- | --- | --- |
| `openai` | OpenAI, or hosted OpenAI-compatible chat APIs with a custom base URL | `https://api.openai.com/v1` |
| `openrouter` | OpenRouter hosted models | `https://openrouter.ai/api/v1` |
| `local` | Generic local OpenAI-compatible server | `http://localhost:8081/v1` |
| `llamacpp` | llama.cpp local server | `http://localhost:8081/v1` |
| `lmstudio` | LM Studio local server | `http://localhost:1234/v1` |
| `vllm` | vLLM local or hosted server | `http://localhost:8000/v1` |
| `ollama` | Ollama OpenAI-compatible endpoint | `http://localhost:11434/v1` |

## Commands

### `analyze`

Analyze the last 50 commits in the current repository by default.

```bash
commit-critic analyze
commit-critic analyze --count 10
commit-critic analyze --url https://github.com/user/repo
commit-critic analyze --json > commit-quality.json
```

Your output varies. Structure looks like this:

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
Why it's good: Clear scope, specific change, and useful implementation context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average score: 7.4/10
Vague commits: 3 (6%)
One-word commits: 0 (0%)
```

Flags:

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: 50 |
| `--url <url>` | Analyze a remote repo using `https://`, `git@`, `file://`, or an absolute path |
| `--provider <name>` | Override `AI_PROVIDER` for this run |
| `--model <name>` | Override `AI_MODEL` for this run |
| `--no-llm` | Use deterministic scoring only |
| `--no-merges` | Exclude merge commits |
| `--json` | Write JSON output. Also auto-enabled when stdout is piped |
| `--verbose` | Include diagnostic statistics |

Aliases: `commit-critic a`, `commit-critic --analyze`

### `write`

Analyze staged changes and suggest a commit message. The tool does not commit automatically unless you pass `--commit`, and even then it asks for confirmation.

```bash
git add <files>
commit-critic write
commit-critic write --type refactor
commit-critic write --commit
```

Your output varies. Structure looks like this:

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

Flags:

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect commit type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` |
| `--provider <name>` | Override `AI_PROVIDER` for this run |
| `--model <name>` | Override `AI_MODEL` for this run |
| `--no-llm` | Use a deterministic template instead |
| `--commit` | Ask to run `git commit` after accepting the message |

Aliases: `commit-critic w`, `commit-critic --write`

### `doctor`

Check that commit-critic can see Git, the current repository, provider config, and provider connectivity.

```bash
commit-critic doctor
```

### `setup`

Interactive provider wizard. It prints the environment variables commit-critic needs and writes `.env` only after confirmation.

```bash
commit-critic setup
commit-critic setup --quick
commit-critic setup --non-interactive
```

Use `setup` for standard OpenAI, OpenRouter, or a generic local endpoint. For MiniMax or another hosted OpenAI-compatible API, configure the environment variables from the hosted compatible endpoint section instead.

## JSON output

`analyze --json` writes structured output suitable for CI or scripts. JSON mode is also enabled automatically when stdout is piped.

```bash
commit-critic analyze --json > commit-quality.json
commit-critic analyze --count 20 | jq '.overallScore'
```

Top-level fields include `version`, `command`, `repo`, `commitCount`, `overallScore`, `summary`, `commits`, `stats`, `topIssues`, and `durationMs`.

## Build and compile

```bash
# Bundled JavaScript
bun run build
./dist/cli.js --help

# Standalone binary for the current platform
bun run compile
./dist/commit-critic --help

# Linux x64 binary
bun run compile:linux
./dist/commit-critic-linux-x64 --help
```

Compiled binaries accept the same environment variables and commands as the Bun entry point.

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
| `0` | Success. Completed analysis exits 0 even when commits score poorly |
| `1` | Operational error such as Git failure, I/O failure, or unexpected exception |
| `3` | Provider auth or config error |
| `10` | Invalid input such as bad `--count`, no staged changes, or invalid `--type` |

## Setup checklist

If you are starting from a fresh clone and want the fastest validation path:

```bash
bun install --frozen-lockfile
bun ./src/cli.ts --help
bun ./src/cli.ts analyze --no-llm --count 1 --json
```

Then validate the LLM path:

```bash
export AI_PROVIDER=openai
export AI_MODEL=MiniMax-M2.7
export AI_BASE_URL=https://api.minimax.io/v1
export AI_API_KEY=your-api-key

bun ./src/cli.ts doctor
bun ./src/cli.ts analyze --count 5 --json
```

For commit writing, stage at least one file first:

```bash
git add <files>
bun ./src/cli.ts write --commit
```

## Troubleshooting

### Missing provider API key

Set the provider-specific key or the generic `AI_API_KEY` alias:

```bash
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-...

# or for a compatible endpoint
export AI_PROVIDER=openai
export AI_BASE_URL=https://api.example.com/v1
export AI_API_KEY=your-api-key
```

### Connectivity is unreachable

Run `doctor`, then check the provider URL and model name:

```bash
commit-critic doctor
commit-critic analyze --provider openai --model gpt-4.1 --count 5
```

Compatible endpoint URLs should include the `/v1` suffix.

### No staged changes

Stage files before using `write`:

```bash
git add <files>
commit-critic write
```

### Not a Git repository

Run inside a repo, or analyze a remote URL:

```bash
commit-critic analyze --url https://github.com/user/repo
```

### LLM falls back to deterministic scoring

commit-critic keeps running if the provider is temporarily unavailable. To fail instead of falling back:

```bash
export AI_STRICT_MODE=true
```

## License

MIT
