# commit-critic

AI-powered commit message critic and writer.

Analyzes commit message quality with deterministic pre-filter scoring plus LLM-owned critique, and helps developers write better commits.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.9
- [Git](https://git-scm.com) (in PATH)
- LLM API key (OpenAI, OpenRouter, or local OpenAI-compatible provider)

## Install

```bash
# Requires Bun
bun install

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

# Deterministic scoring only (offline, no LLM required)
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

### Providers

#### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
export AI_PROVIDER="openai"
export AI_MODEL="gpt-4.1"
```

#### OpenRouter

```bash
export OPENROUTER_API_KEY="sk-or-..."
export AI_PROVIDER="openrouter"
export AI_MODEL="anthropic/claude-sonnet-4"
```

#### Local Models

```bash
# LM Studio
export AI_PROVIDER="lmstudio"
export LM_STUDIO_BASE_URL="http://localhost:1234/v1"  # optional, defaults to localhost
export AI_MODEL="llama-3.3-70b"

# Ollama
export AI_PROVIDER="ollama"
export OLLAMA_BASE_URL="http://localhost:11434/v1"  # optional, defaults to localhost
export AI_MODEL="llama3.2"

# vLLM
export AI_PROVIDER="vllm"
export VLLM_BASE_URL="http://localhost:8000/v1"  # optional, defaults to localhost
export VLLM_API_KEY="your-api-key"  # optional, only if your vLLM instance requires auth
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
commit-critic analyze --no-merges  # Exclude merge commits
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

- **Deterministic pre-filter**: Rule-based checks for structure, conventional commits, subject quality, body quality, and diff correlation.
- **LLM semantic**: Contextual review of specificity, intent, clarity, and actionability. LLM owns the final score (1-10) with deterministic results provided as context.

Use `--no-llm` for deterministic-only scoring when offline.

## Output

- **Rich terminal**: Colored, structured output with emoji indicators.
- **JSON**: Machine-readable output via `--json` flag or automatic when piped.
- **NO_COLOR**: Respects the `NO_COLOR` environment variable.

## Architecture

- Bun TypeScript CLI with clipanion
- AI SDK v7 for multi-provider LLM integration
- Zod schemas for structured output validation
- Git access via `Bun.spawn` (subprocess)
- Deterministic + LLM scoring

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
