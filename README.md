# commit-critic

AI-powered terminal tool for reviewing Git commit message quality and writing better commits from staged changes.

## Quickstart

```bash
# 1. Check your setup first
bunx --bun commit-critic doctor

# 2. For local LLM (fastest, no API key needed):
#    Start llama.cpp server: llama.cpp-server --host 0.0.0.0 --port 8081 -m qwen3.6.gguf
export AI_PROVIDER=llamacpp
export AI_MODEL=qwen3.6
export LLAMACPP_BASE_URL=http://localhost:8081/v1

# 3. Analyze recent commits in the current repo
bunx --bun commit-critic analyze

# 4. Write a commit message from staged changes
git add <files>
bunx --bun commit-critic write
```

## Requirements

- Bun 1.3.9+
- Git in PATH
- An LLM provider (see below)

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
# or: brew install bun
```

## Providers

### Local llama.cpp (fastest, no API key)

```bash
# Start llama.cpp server: llama.cpp-server --host 0.0.0.0 --port 8081 -m qwen3.6.gguf
export AI_PROVIDER=llamacpp
export AI_MODEL=qwen3.6
export LLAMACPP_BASE_URL=http://localhost:8081/v1

bunx --bun commit-critic analyze
bunx --bun commit-critic write
```

Other local servers via `AI_PROVIDER=local`:

```bash
export AI_PROVIDER=local
export AI_MODEL=qwen3.6
export AI_BASE_URL=http://localhost:8081/v1
```

Presets for LM Studio (`lmstudio`), vLLM (`vllm`), and Ollama (`ollama`) are also available — see `bunx --bun commit-critic setup --help`.

### OpenAI

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...
```

### OpenRouter

```bash
export AI_PROVIDER=openrouter
export AI_MODEL=anthropic/claude-sonnet-4
export OPENROUTER_API_KEY=sk-or-...
```

Use `AI_API_KEY` as a generic override for any provider.

## Commands

### `analyze`

Analyze commit history in the current repo or a remote URL.

```bash
bunx --bun commit-critic analyze
bunx --bun commit-critic analyze --count 10
bunx --bun commit-critic analyze --url https://github.com/user/repo
bunx --bun commit-critic analyze --no-llm
bunx --bun commit-critic analyze --json > report.json
```

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: 50 |
| `--url <url>` | Remote repo URL (`https://`, `git@`, `file://`, or absolute path) |
| `--no-llm` | Deterministic scoring only (offline) |
| `--no-merges` | Exclude merge commits |
| `--json` | JSON output (auto-enabled when stdout is piped) |
| `--verbose` | Include diagnostic details |

Aliases: `commit-critic a`, `commit-critic --analyze`

### `write`

Analyze staged changes and suggest a commit message. Accept to print it, or use `--commit` to run `git commit` after confirmation.

```bash
git add <files>
bunx --bun commit-critic write
bunx --bun commit-critic write --type refactor
bunx --bun commit-critic write --commit
```

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect commit type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore` |
| `--no-llm` | Use deterministic template instead |
| `--commit` | Ask to run `git commit` after accepting (default answer: No) |

Aliases: `commit-critic w`, `commit-critic --write`

### `doctor`

Check Git, repo detection, provider config, and connectivity.

```bash
bunx --bun commit-critic doctor
```

### `setup`

Interactive provider wizard. Prints required env vars and writes `.env` only after confirmation.

```bash
bunx --bun commit-critic setup
bunx --bun commit-critic setup --quick    # exit if config is already valid
```

## Run from source checkout

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
# Bundled JS
bun run build
./dist/cli.js --help

# Standalone binary (current platform)
bun run compile
./dist/commit-critic --help
```

Compiled binaries accept the same env vars and commands as `bunx`.

## Development checks

```bash
bun run typecheck && bun test
bun run build
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (analysis completed; low-quality commits do not affect exit code) |
| `1` | Operational error (git failure, I/O error, unexpected exception) |
| `3` | Provider auth/config error |
| `10` | Invalid input (bad `--count`, no staged changes, etc.) |

## Troubleshooting

**`Missing OPENAI_API_KEY`**

Set your API key or switch to a local provider:

```bash
export AI_PROVIDER=local
export AI_BASE_URL=http://localhost:8081/v1
```

**`Connectivity: Unreachable`**

Check the server URL — local URLs need the `/v1` suffix:

```bash
export AI_BASE_URL=http://localhost:8081/v1
```

**`No staged changes`**

Stage files before `write`:

```bash
git add <files>
bunx --bun commit-critic write
```

**`Not a git repository`**

Run inside a repo, or analyze a remote URL:

```bash
bunx --bun commit-critic analyze --url https://github.com/user/repo
```

**LLM falls back to deterministic scoring**

This is by design — commit-critic keeps running if the provider is unavailable. To fail instead:

```bash
export AI_STRICT_MODE=true
```

## License

MIT
