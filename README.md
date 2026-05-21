# commit-critic

AI-powered commit message critic and writer.

Analyzes commit message quality with hybrid scoring (deterministic rules + LLM critique) and helps developers write better commits.

## Install

```bash
# Requires Bun
bun install

# Development
bun run dev --help

# Build standalone binary
bun run compile:linux
```

## Quick Start

```bash
# Analyze last 50 commits in current repo
bun run dev analyze

# Analyze a remote repo
bun run dev analyze --url https://github.com/user/repo

# Interactive commit writer
bun run dev write

# JSON output for CI/CD
bun run dev analyze --json

# Deterministic scoring only (no LLM required)
bun run dev analyze --no-llm

# Health check
bun run dev doctor
```

## Configuration

Copy `.env.example` to `.env` or set environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export AI_PROVIDER="openai"
export AI_MODEL="gpt-4.1"
```

### Local Models

```bash
# LM Studio
export AI_PROVIDER="lmstudio"
export LM_STUDIO_BASE_URL="http://localhost:1234/v1"
export AI_MODEL="llama-3.3-70b"

# Ollama
export AI_PROVIDER="ollama"
export OLLAMA_BASE_URL="http://localhost:11434/v1"
export AI_MODEL="llama3.2"

# vLLM
export AI_PROVIDER="vllm"
export VLLM_BASE_URL="http://localhost:8000/v1"
export AI_MODEL="mistral-7b-instruct"
```

## Commands

### analyze

Review existing commits with AI-generated critique.

```bash
commit-critic analyze              # Last 50 commits in current repo
commit-critic analyze --count 100  # Custom count
commit-critic analyze --url <url>  # Remote repository
commit-critic analyze --no-llm     # Deterministic scoring only
commit-critic analyze --json       # JSON output
```

### write

Interactive commit writer based on staged changes.

```bash
commit-critic write                # Interactive prompts
commit-critic write --type feat    # Pre-select commit type
```

### doctor

Health check for git, LLM provider, and configuration.

```bash
commit-critic doctor
```

## Scoring

Hybrid scoring approach:

- **Deterministic (60%)**: Rule-based checks for structure, conventional commits, subject quality, body quality, diff correlation
- **LLM Semantic (40%)**: Contextual evaluation of specificity, intent, clarity, and actionability

Use `--no-llm` for deterministic-only scoring (offline-capable).

## Output

- **Rich terminal**: Colored, structured output with progress bars and emoji indicators
- **JSON**: Machine-readable output via `--json` flag or automatic when piped

## Architecture

- Bun TypeScript CLI with clipanion
- AI SDK v6 for multi-provider LLM integration
- Zod schemas for structured output validation
- Git access via `Bun.spawn` (subprocess)
- Hybrid scoring: deterministic + LLM

## Development

```bash
bun install           # Install dependencies
bun run dev           # Run in development mode
bun run typecheck     # Type check
bun run test          # Run tests
bun run compile:linux # Build standalone binary
```

## License

MIT
