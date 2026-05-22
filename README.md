# commit-critic

AI-powered commit message critic and writer. Analyzes your Git commit history with an LLM to score quality, find weak messages, suggest better ones, and help you write well-formed commits interactively.

## What it does

1. **Analyze** a repository's commit history and get per-commit scores, critiques, better examples, and aggregate statistics.
2. **Analyze** a remote repository by URL.
3. **Write** commit messages interactively by reading your staged diff and generating a suggestion.
4. **Doctor** checks your setup (Git, API keys) and reports what's configured.

All scoring uses an LLM by default. A deterministic offline mode (`--no-llm`) is available as a fallback.

## Requirements

- [Bun](https://bun.sh) >= 1.3.9
- [Git](https://git-scm.com) (in PATH)
- An LLM API key (OpenAI, OpenRouter, or a local OpenAI-compatible provider)

## Install Bun

### macOS

```bash
curl -fsSL https://bun.sh/install | bash
```

Or with Homebrew:

```bash
brew tap oven-sh/bun
brew install bun
```

### Linux

```bash
curl -fsSL https://bun.sh/install | bash
```

Or with npm:

```bash
npm install -g bun
```

### Windows

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Or with scoop:

```powershell
scoop install bun
```

## Install commit-critic from source

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install
```

That's it. No build step required for development.

## Configure an LLM provider

Copy `.env.example` to `.env` and fill in the values, or export environment variables directly.

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
export AI_PROVIDER="openai"
export AI_MODEL="gpt-4.1"
```

### OpenRouter

```bash
export OPENROUTER_API_KEY="sk-or-..."
export AI_PROVIDER="openrouter"
export AI_MODEL="anthropic/claude-sonnet-4"
```

### Local OpenAI-compatible providers

**LM Studio** (default: `http://localhost:1234/v1`):

```bash
export AI_PROVIDER="lmstudio"
export AI_MODEL="llama-3.3-70b"
# Optional: override base URL
# export LM_STUDIO_BASE_URL="http://localhost:1234/v1"
```

**Ollama** (default: `http://localhost:11434/v1`):

```bash
export AI_PROVIDER="ollama"
export AI_MODEL="llama3.2"
# Optional: override base URL
# export OLLAMA_BASE_URL="http://localhost:11434/v1"
```

**vLLM**:

```bash
export AI_PROVIDER="vllm"
export VLLM_BASE_URL="http://localhost:8000/v1"
export AI_MODEL="mistral-7b-instruct"
# Optional: if your vLLM instance requires auth
# export VLLM_API_KEY="your-api-key"
```

Default provider: `openai` / `gpt-4.1`. Override with `AI_PROVIDER` and `AI_MODEL` env vars or `--provider` and `--model` flags.

## Verify setup

```bash
bun run dev --help        # Show all commands
bun run dev doctor        # Check git, repo, and API key status
```

## Command reference

### analyze

Review existing commits with AI-powered scoring.

```bash
bun run dev analyze [options]
```

| Flag | Default | Description |
| --- | --- | --- |
| `--count <n>` | 50 | Number of commits to analyze |
| `--url <url>` | (none) | Remote repository URL to clone and analyze |
| `--no-llm` | false | Deterministic scoring only (offline, no API key needed) |
| `--json` | auto | Force JSON output (auto-enabled when piped) |
| `--provider <name>` | env | Override AI provider (`openai`, `openrouter`, `lmstudio`, `vllm`, `ollama`) |
| `--model <name>` | env | Override model ID |
| `--no-merges` | false | Exclude merge commits from analysis |

### write

Interactive commit message writer based on staged changes.

```bash
bun run dev write [options]
```

| Flag | Default | Description |
| --- | --- | --- |
| `--type <type>` | (prompt) | Pre-select commit type (`feat`, `fix`, `docs`, etc.) |
| `--no-llm` | false | Use template only (offline, no API key needed) |
| `--provider <name>` | env | Override AI provider |
| `--model <name>` | env | Override model ID |
| `--commit` | false | After accepting a message, prompt to commit staged changes |

When `--commit` is used, you will be asked to confirm before any commit is created. The default is `No`. Without `--commit`, the tool only prints the suggested message.

### doctor

Health check for your setup.

```bash
bun run dev doctor
```

Checks Git availability, repository detection, and LLM provider configuration.

## Examples

### Analyze the current repository

```bash
# Last 50 commits (default)
bun run dev analyze

# Rubric-compatible alias
bun run dev --analyze

# Last 100 commits, offline
bun run dev analyze --count 100 --no-llm

# JSON output for scripting
bun run dev analyze --json
```

### Analyze a remote repository

```bash
bun run dev analyze --url https://github.com/steel-dev/steel-browser

# Rubric-compatible alias
bun run dev --analyze --url https://github.com/steel-dev/steel-browser
```

### Interactive commit writer

```bash
# Stage your changes first
git add <files>

# Get a suggested commit message
bun run dev write

# Rubric-compatible alias
bun run dev --write

# Pre-select type
bun run dev write --type feat

# Write and optionally commit
bun run dev write --commit
```

### Offline mode (no API key needed)

```bash
bun run dev analyze --no-llm
bun run dev write --no-llm
```

## Dependencies

| Package | Purpose |
| --- | --- |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [clipanion](https://github.com/arcanis/clipanion) | CLI parsing and command routing |
| [ai](https://github.com/vercel/ai) (Vercel AI SDK) | LLM calls and structured output |
| [@ai-sdk/openai](https://github.com/vercel/ai) | OpenAI provider |
| [@ai-sdk/openai-compatible](https://github.com/vercel/ai) | OpenAI-compatible providers (OpenRouter, LM Studio, vLLM, Ollama) |
| [zod](https://github.com/colinhacks/zod) | Schema validation for LLM structured output |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | Terminal colors (NO_COLOR compliant) |
| [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) | Interactive prompts for write mode |

Runtime: [Bun](https://bun.sh) >= 1.3.9. No Node.js required.

## Development

```bash
bun install                # Install dependencies
bun run dev --help         # Run CLI from source
bun run typecheck          # TypeScript check (tsc --noEmit)
bun test                   # Run test suite
bun run build              # Build bundled JS (optional)
```

Build scripts are optional convenience targets:

```bash
bun run build                    # Bundle to dist/cli.js
bun run compile:linux            # Standalone Linux binary
bun run compile:mac-arm          # Standalone macOS ARM binary
bun run compile:mac-intel        # Standalone macOS Intel binary
bun run compile:windows          # Standalone Windows binary
```

Source-first submission: `bun run src/cli.ts` runs directly. No prebuilt binaries required.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Missing OPENAI_API_KEY` | Set the env var or use `--no-llm` for offline mode |
| `Not a git repository` | Run inside a git repo or use `--url` to analyze a remote |
| `No staged changes` | Run `git add <files>` before using `write` |
| LLM fallback used | Check your API key and network. Run `bun run dev doctor` for diagnostics |
| JSON output mixed with status text | Status messages go to stderr, JSON goes to stdout. Pipe stdout only |

## License

MIT
