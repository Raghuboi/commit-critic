# commit-critic

AI-powered commit message review and commit writing in your terminal. Point it at a Git repository, let an LLM critique the recent commit history, then use the interactive writer to turn staged changes into a clear Conventional Commit.

## Quickstart

Use your own LLM API key first. OpenAI is the shortest path:

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

bunx --bun commit-critic doctor
bunx --bun commit-critic analyze

git add <files>
bunx --bun commit-critic write
```

That is the core workflow:

1. `doctor` checks Git, repository detection, provider config, and connectivity.
2. `analyze` reviews recent commit messages in the current repo.
3. `write` reads `git diff --staged` and suggests a commit message interactively.

## Requirements

- Bun 1.3.9+
- Git in PATH
- An LLM API key or OpenAI-compatible endpoint

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
# or: brew install bun
```

## LLM provider setup

### OpenAI

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

bunx --bun commit-critic doctor
```

### OpenRouter

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export OPENROUTER_API_KEY=sk-or-...

bunx --bun commit-critic doctor
```

### OpenAI-compatible API

Use this for hosted APIs that speak the OpenAI chat/completions shape.

```bash
export AI_PROVIDER=openai
export AI_MODEL=your-model-name
export OPENAI_BASE_URL=https://api.example.com/v1
export OPENAI_API_KEY=your-api-key

bunx --bun commit-critic doctor
```

`AI_BASE_URL` and `AI_API_KEY` also work as generic aliases for compatible providers.

### Local model server

Local servers are optional. They are useful for private repositories or offline work.

```bash
export AI_PROVIDER=llamacpp
export AI_MODEL=qwen3.6
export LLAMACPP_BASE_URL=http://localhost:8081/v1

bunx --bun commit-critic doctor
```

Presets are available for `llamacpp`, `lmstudio`, `vllm`, and `ollama`. Use `AI_BASE_URL` for the generic compatible provider, or provider-specific vars such as `LLAMACPP_BASE_URL` and `VLLM_BASE_URL`.

`AI_API_KEY` can be used as a generic API key alias. Provider-specific keys such as `OPENAI_API_KEY` and `OPENROUTER_API_KEY` take precedence.

## Commands

### `analyze`

Analyze the last 50 commits in the current repository by default.

```bash
bunx --bun commit-critic analyze
bunx --bun commit-critic analyze --count 10
bunx --bun commit-critic analyze --url https://github.com/user/repo
bunx --bun commit-critic analyze --json > commit-quality.json
```

Example output:

```text
Analyzing last 50 commits...

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
| `--url <url>` | Analyze a remote repo (`https://`, `git@`, `file://`, or absolute path) |
| `--provider <name>` | Override `AI_PROVIDER` for this run |
| `--model <name>` | Override `AI_MODEL` for this run |
| `--no-llm` | Use deterministic scoring only |
| `--no-merges` | Exclude merge commits |
| `--json` | JSON output; also auto-enabled when stdout is piped |
| `--verbose` | Include diagnostic details |

Aliases: `commit-critic a`, `commit-critic --analyze`

### `write`

Analyze staged changes and suggest a commit message. The tool does not commit automatically unless you pass `--commit`, and even then it asks for confirmation.

```bash
git add <files>
bunx --bun commit-critic write
bunx --bun commit-critic write --type refactor
bunx --bun commit-critic write --commit
```

Example interaction:

```text
Analyzing staged changes... (3 files changed, +82 -19 lines)

Changes detected:
  • Tightened provider config resolution
  • Added tests for base URL precedence
  • Updated setup copy for compatible endpoints

Suggested commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
refactor(config): align provider URL precedence

- Prefer provider-specific base URL vars over AI_BASE_URL
- Keep AI_BASE_URL as the generic compatible endpoint
- Add regression coverage for legacy fallback behavior
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
bunx --bun commit-critic doctor
```

### `setup`

Interactive provider wizard. It prints the environment variables commit-critic needs and writes `.env` only after confirmation.

```bash
bunx --bun commit-critic setup
bunx --bun commit-critic setup --quick
bunx --bun commit-critic setup --non-interactive
```

## Run from source

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install --frozen-lockfile
bun link
bunx --bun commit-critic --help
```

To use the linked package from another local repo:

```bash
cd /path/to/other/repo
bun link commit-critic
bunx --bun commit-critic analyze
```

## Build and compile

```bash
# Bundled JavaScript
bun run build
./dist/cli.js --help

# Standalone binary for the current platform
bun run compile
./dist/commit-critic --help
```

Compiled binaries accept the same env vars and commands as `bunx`.

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
| `0` | Success. Completed analysis always exits 0, even when commits score poorly. |
| `1` | Operational error such as Git failure, I/O failure, or unexpected exception. |
| `3` | Provider auth/config error. |
| `10` | Invalid input such as bad `--count`, no staged changes, or invalid `--type`. |

## Troubleshooting

### Missing provider API key

Set the provider-specific key or the generic `AI_API_KEY` alias:

```bash
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-...

# or for a compatible endpoint
export AI_PROVIDER=openai
export OPENAI_BASE_URL=https://api.example.com/v1
export AI_API_KEY=your-api-key
```

### Connectivity is unreachable

Run `doctor`, then check the provider URL and model name:

```bash
bunx --bun commit-critic doctor
bunx --bun commit-critic analyze --provider openai --model gpt-4.1 --count 5
```

Compatible endpoint URLs should include the `/v1` suffix.

### No staged changes

Stage files before using `write`:

```bash
git add <files>
bunx --bun commit-critic write
```

### Not a Git repository

Run inside a repo, or analyze a remote URL:

```bash
bunx --bun commit-critic analyze --url https://github.com/user/repo
```

### LLM falls back to deterministic scoring

commit-critic keeps running if the provider is temporarily unavailable. To fail instead of falling back:

```bash
export AI_STRICT_MODE=true
```

## License

MIT
