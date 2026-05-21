# Architecture Synthesis — Final Research Dossier

**Project:** Commit Critic — AI Commit Message Critic
**Date:** May 20, 2026
**Status:** Final — ready for implementation

---

## Table of Contents

1. [Executive Recommendation](#1-executive-recommendation)
2. [Source Inventory](#2-source-inventory)
3. [Challenge Rubric Interpretation](#3-challenge-rubric-interpretation)
4. [Steel Cookbook And Steel CLI Findings](#4-steel-cookbook-and-steel-cli-findings)
5. [Bun TypeScript CLI Findings](#5-bun-typescript-cli-findings)
6. [AI SDK Provider Findings](#6-ai-sdk-provider-findings)
7. [Rust Ecosystem Findings](#7-rust-ecosystem-findings)
8. [Claude Code And Hermes Findings](#8-claude-code-and-hermes-findings)
9. [Comparable OSS Tool Findings](#9-comparable-oss-tool-findings)
10. [Stack Decision Matrix](#10-stack-decision-matrix)
11. [Proposed Architecture](#11-proposed-architecture)
12. [CLI UX Specification](#12-cli-ux-specification)
13. [LLM Provider And Config Specification](#13-llm-provider-and-config-specification)
14. [Commit Scoring Rubric](#14-commit-scoring-rubric)
15. [Context Management Strategy](#15-context-management-strategy)
16. [Dependency Shortlist](#16-dependency-shortlist)
17. [Security And Supply-Chain Notes](#17-security-and-supply-chain-notes)
18. [Testing And Verification Plan](#18-testing-and-verification-plan)
19. [README And .env.example Plan](#19-readme-and-envexample-plan)
20. [Scaffold File Tree](#20-scaffold-file-tree)
21. [Implementation Milestones](#21-implementation-milestones)
22. [Risks, Unknowns, And Open Questions](#22-risks-unknowns-and-open-questions)
23. [Final CTO Recommendation](#23-final-cto-recommendation)

---

## 1. Executive Recommendation

**Build Commit Critic as a standalone Bun TypeScript CLI package.**

This decision is evidence-driven across all six research reports:

- **TypeScript+Bun wins over Rust** by a clear margin for this project. Rust offers sub-millisecond startup and smaller binaries, but Commit Critic is I/O-bound (LLM API calls, git subprocess), making CPU performance irrelevant. The AI SDK v6 + Zod ecosystem is native to TypeScript, providing structured output, multi-provider support, and middleware that would require building from scratch in Rust. [Source: 04-rust-research.md, Section 4.4; 03-ai-sdk-research.md, Section 1]

- **AI SDK v6 with `createProviderRegistry`** is the central abstraction for LLM access, supporting OpenAI, OpenRouter, and any OpenAI-compatible local provider (vLLM, LM Studio, Ollama) through `@ai-sdk/openai-compatible`. [Source: 03-ai-sdk-research.md, Section 3.1]

- **Hybrid structured output strategy**: `Output.object()` with Zod schemas as primary, falling back to `generateText()` + manual Zod parsing for weak/local models. [Source: 03-ai-sdk-research.md, Section 5.2]

- **Git access via `Bun.spawn`/`Bun.$`** (subprocess shelling out to the `git` binary). The `git2` Rust crate has known SSH/auth issues, and even major projects like Jujutsu are migrating away from it. In TypeScript, `Bun.spawn` is simpler and more reliable. [Source: 04-rust-research.md, Section 3.5; 02-bun-cli-research.md, Section 5.1]

- **CLI (not TUI)**: Commit Critic is a single-purpose tool that runs, produces output, and exits. A full-screen TUI adds unnecessary complexity. Use `picocolors` for colors and `prompts` for interactive mode. [Source: 05-terminal-patterns-research.md, Section 4; 02-bun-cli-research.md, Section 4.3]

- **No hybrid architecture**: A Rust CLI shell + TypeScript AI core adds two codebases, two build pipelines, and IPC overhead without proportional benefit. [Source: 04-rust-research.md, Section 4.3]

---

## 2. Source Inventory

### Repositories Cloned and Analyzed

| Repo | SHA | Purpose |
|------|-----|---------|
| `steel-dev/cli` | `f911b480a31d3ca234e311ee3ec78cce4748e05a` | Rust CLI architecture reference |
| `steel-dev/steel-cookbook` | `92f29742253e2b6c6801d109e18232768e5291a0` | Documentation/recipe patterns |
| Local Claude Code mirror | (local clone) | Terminal UX patterns (Ink TUI) |
| Local Hermes Agent | `~/.hermes/hermes-agent/` | Terminal UX patterns (Python CLI + Ink TUI) |

### Documentation and Sources Read

| Source | Type | Key Findings |
|--------|------|-------------|
| Bun LLM full docs (`bun.sh/llms-full.txt`) | API reference | Bun runtime capabilities, `Bun.spawn`, `Bun.$`, `--compile` |
| Bun Executables docs | CLI packaging | Cross-compilation targets, binary distribution |
| AI SDK v6 docs (sdk.vercel.ai) | Framework | `generateText`, `Output.object()`, provider registry, middleware |
| AI SDK v6 migration guide | Migration | `generateObject` deprecated, use `Output.object()` |
| clipanion docs (mael.dev) | CLI parsing | Type-safe CLI with zero dependencies |
| Steel CLI source code (40+ files) | Code analysis | CLI architecture, error handling, output patterns |
| commrate source (Rust) | Scoring | Heuristic grading A-F, rule-based |
| mit-lint / git-mit source (Rust) | Linting | Rule-based linting with miette error display |
| aicommits source (TypeScript) | Generator | Prompt strategy, multi-provider, diff truncation |
| OpenCommit source (TypeScript) | Generator | Config system, prompt modules |
| ai-commit (Go) source | Generator + TUI | Interactive TUI, code review, streaming |
| git-ai-commit (Go) source | Generator + hook | Git config-based, graceful fallback |
| commitlint source (TypeScript) | Linting | Rule engine, parser presets |
| Chris Beams' 7 Rules | Guidelines | Industry-standard commit message rules |
| Conventional Commits spec v1.0.0 | Specification | Format rules, type enum, breaking changes |

---

## 3. Challenge Rubric Interpretation

The challenge requires an AI commit message critic with three core modes:

### Mode 1: `commit-critic analyze` (local repo)
- Analyzes the last 50 commits (configurable via `--count`)
- Reads from the current git repository
- Scores each commit, provides critique and suggestions
- Output: rich terminal by default, `--json` for machine-readable

### Mode 2: `commit-critic analyze --url <repo-url>` (remote repo)
- Clones a remote repository to a temporary directory
- Analyzes the last 50 commits
- Cleans up the temporary directory after analysis
- Same output format as local analysis

### Mode 3: `commit-critic write` (interactive commit writer)
- Reads staged changes (`git diff --staged`)
- Interactively guides the user through commit type, scope, description
- Generates a commit message suggestion using LLM
- Lets the user accept, edit, or regenerate
- Does NOT auto-commit by default; user controls the commit

### Output Requirements
- **Rich terminal output**: Colored, structured, emoji-enhanced output by default
- **`--json` flag**: Structured JSON output for CI/CD and scripting
- **Auto-JSON on pipe**: When stdout is not a TTY, automatically switch to JSON

### Key Constraints
- Multi-provider LLM support (OpenAI, Anthropic, local models)
- Works with OpenAI-compatible local providers (Ollama, LM Studio, vLLM)
- Handles weak local models gracefully
- Deterministic baseline scoring + LLM-based critique

---

## 4. Steel Cookbook And Steel CLI Findings

### What Steel CLI Does Well (Adopt These Patterns)

1. **Tiny entry point**: 10-line `main.rs` that parses args, runs commands, handles errors. All logic in library code. [Source: 01-steel-research.md, Section 8, DO Copy #1]

2. **`--json` global flag + auto-detection**: Rich terminal by default, JSON when `--json` passed or stdout is piped (`stdout().is_terminal()`). [Source: 01-steel-research.md, Section 2, UX Patterns]

3. **Semantic exit codes**: Different exit codes for different failure modes (auth=3, network=4, api_client=5, api_server=6). [Source: 01-steel-research.md, Section 4, Error Classification]

4. **Error hints**: Every error includes a `Hint:` line suggesting recovery action. [Source: 01-steel-research.md, Section 8, DO Copy #4]

5. **Config resolution chain**: Env var > CLI flag > config file > defaults, with source tracking. [Source: 01-steel-research.md, Section 5, Auth Resolution]

6. **Atomic config writes**: Write to `.tmp`, then `rename()`. Set restrictive permissions (0o600). [Source: 01-steel-research.md, Section 5, Atomic Config Writes]

7. **`status!` macro pattern**: Status messages to stderr, suppressed in JSON mode. [Source: 01-steel-research.md, Section 2, UX Patterns]

8. **`doctor` command pattern**: Health check with categorized checks, fix suggestions, overall status. Adapt as `commit-critic doctor` to verify git, LLM provider, and config. [Source: 01-steel-research.md, Section 8, DO Copy #11]

9. **`describe` command for AI agents**: Structured command introspection. Useful for AI agent integration. [Source: 01-steel-research.md, Section 8, DO Copy #10]

10. **Command aliases**: `navigate`/`open`/`goto`. For Commit Critic: `analyze`/`a`, `write`/`w`. [Source: 01-steel-research.md, Section 2, UX Patterns]

11. **`NO_COLOR` env var support**: Respects the no-color standard. [Source: 01-steel-research.md, Section 2, UX Patterns]

12. **Test strategy**: Unit tests inline, property-based tests for validators, black-box tests for the binary. [Source: 01-steel-research.md, Section 6]

### What to Skip from Steel

- PostHog telemetry (not needed for a dev tool)
- Browser daemon architecture (irrelevant)
- OAuth login flow (API key via env var is sufficient)
- SQLite credential storage (not needed)
- npm wrapper distribution (optional, not required for v1)

---

## 5. Bun TypeScript CLI Findings

### Bun's Built-in Capabilities Cover Most Needs

- **TypeScript execution**: Zero configuration, runs `.ts` files natively. [Source: 02-bun-cli-research.md, Section 2.1]
- **`Bun.argv`**: Access to command-line arguments. [Source: 02-bun-cli-research.md, Section 2.2]
- **`Bun.spawn()` / `Bun.$`**: Subprocess execution for git commands. [Source: 02-bun-cli-research.md, Section 5.1]
- **`Bun.file()`**: Efficient file I/O. [Source: 02-bun-cli-research.md, Section 5.2]
- **Built-in `fetch`**: HTTP client for LLM API calls. [Source: 02-bun-cli-research.md, Section 5.4]
- **Built-in test runner**: Jest-compatible, runs TypeScript natively. [Source: 02-bun-cli-research.md, Section 2.5]
- **`bun build --compile`**: Standalone executable compilation with cross-compilation. [Source: 02-bun-cli-research.md, Section 6]

### CLI Parsing: clipanion

**clipanion** is the recommended CLI parser. It provides:
- Zero runtime dependencies
- Full TypeScript type inference
- Native subcommand support
- Auto-generated `--help`
- Powers Yarn Berry (proven at scale)
- Confirmed Bun compatible

[Source: 02-bun-cli-research.md, Section 3.3]

### Terminal Colors: picocolors

- 0.3 KB gzipped (14x smaller than chalk)
- 2x faster loading
- Zero dependencies
- `NO_COLOR` support
- Used by PostCSS, SVGO, Babel

[Source: 02-bun-cli-research.md, Section 4.1]

### Interactive Prompts: prompts

- Lightweight (~20 KB), Promise-based
- Text, select, toggle, multiselect inputs
- Used by Create React App, Gatsby
- Works with Bun

[Source: 02-bun-cli-research.md, Section 4.2]

### Executable Packaging

```bash
# Standalone binary
bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile ./dist/commit-critic-linux-x64 --minify

# Cross-compilation targets
bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile ./dist/commit-critic-darwin-arm64 --minify
bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile ./dist/commit-critic-darwin-x64 --minify
bun build ./src/cli.ts --compile --target=bun-windows-x64 --outfile ./dist/commit-critic-windows-x64.exe --minify
```

Binary sizes: ~20-30 MB per binary (Bun runtime + bundled code). [Source: 02-bun-cli-research.md, Section 6.3]

---

## 6. AI SDK Provider Findings

### Core Architecture: Provider Registry

The `createProviderRegistry` function is the canonical way to manage multiple providers:

```ts
import { createProviderRegistry, customProvider, wrapLanguageModel, extractJsonMiddleware } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const aiRegistry = createProviderRegistry({
  openai,
  lmstudio: createOpenAICompatible({
    name: 'lmstudio',
    baseURL: process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1',
  }),
  ollama: createOpenAICompatible({
    name: 'ollama',
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    apiKey: 'ollama',
  }),
  // ... more providers
});
```

[Source: 03-ai-sdk-research.md, Section 3.1]

### Structured Output: Hybrid Strategy

**Primary**: `Output.object()` with Zod schemas for type-safe structured output.
**Fallback**: `generateText()` + manual JSON parsing + Zod validation for weak models.

```ts
const { output } = await generateText({
  model: provider('model-id'),
  output: Output.object({
    schema: z.object({
      score: z.number().min(1).max(10),
      issues: z.array(z.object({
        category: z.enum(['type', 'scope', 'subject', 'body', 'convention']),
        severity: z.enum(['critical', 'warning', 'suggestion']),
        message: z.string(),
      })),
      suggestions: z.array(z.string()),
    }),
  }),
  prompt: 'Analyze this commit message...',
});
```

[Source: 03-ai-sdk-research.md, Section 2.2]

### Local Model Support

All local providers use the OpenAI-compatible interface:

| Provider | Package | Base URL | Structured Output |
|----------|---------|----------|-------------------|
| OpenAI | `@ai-sdk/openai` | Built-in | Native (best) |
| OpenRouter | `@ai-sdk/openai-compatible` | `openrouter.ai/api/v1` | Model-dependent |
| vLLM | `@ai-sdk/openai-compatible` | `localhost:8000/v1` | Via `guided_json` / `response_format` |
| LM Studio | `@ai-sdk/openai-compatible` | `localhost:1234/v1` | Via `response_format` (GGUF grammar) |
| Ollama | `@ai-sdk/openai-compatible` | `localhost:11434/v1` | Via `response_format` / `format` |

[Source: 03-ai-sdk-research.md, Section 4.1]

### Weak Model Handling

- **`extractJsonMiddleware()`**: Strips markdown code fences from local model output. [Source: 03-ai-sdk-research.md, Section 5.3]
- **`NoObjectGeneratedError`**: Catch and fall back to text mode. [Source: 03-ai-sdk-research.md, Section 2.3]
- **Model capability tiers**: Configure `structuredOutput: boolean` per model. [Source: 03-ai-sdk-research.md, Section 6.1]
- **`temperature: 0.1`**: Deterministic output for structured JSON. [Source: 03-ai-sdk-research.md, Section 9]

---

## 7. Rust Ecosystem Findings

### Why Rust Was Evaluated

Steel CLI demonstrates Rust's strength for CLI tools: sub-millisecond startup, ~5-10 MB binaries, zero runtime dependency, excellent TUI via ratatui. [Source: 04-rust-research.md, Section 6.1]

### Why Rust Is Not Recommended for This Project

1. **No AI SDK equivalent**: Rust's OpenAI client ecosystem is fragmented and unofficial (`async-openai`, `async-openai-compat`). TypeScript's AI SDK v6 provides structured output, provider registry, middleware, and fallback support out of the box. [Source: 04-rust-research.md, Section 3.7]

2. **No Zod equivalent**: `schemars` generates JSON schemas from Rust types but doesn't validate at runtime the same way Zod does. For LLM structured outputs, Zod is the better fit. [Source: 04-rust-research.md, Section 3.8]

3. **`git2` crate is problematic**: Adds ~1 MB of C code (libgit2 + libssh2 + OpenSSL), has known SSH/auth issues, and major projects like Jujutsu are migrating away from it. [Source: 04-rust-research.md, Section 3.5]

4. **I/O-bound workload**: Commit Critic calls LLM APIs and reads git output. Rust's CPU speed advantage is irrelevant for network-bound operations. [Source: 04-rust-research.md, Section 6.2]

5. **Learning curve cost**: 2-4 months per developer to become comfortable with Rust. No Rust champion on the team. [Source: 04-rust-research.md, Section 5]

6. **Team expertise**: The team is TypeScript-strong. Development velocity would be 50-70% during the first month. [Source: 04-rust-research.md, Section 5.2]

### What Rust Research Revealed

- **ratatui** is superior to Ink for complex TUIs (charts, tables, gauges), but Commit Critic doesn't need a complex TUI. [Source: 04-rust-research.md, Section 3.2]
- **`clap`** with derive macros is the Rust standard for CLI parsing, equivalent to clipanion in TypeScript. [Source: 04-rust-research.md, Section 3.1]
- **`inquire`** is the better Rust prompt library (over `dialoguer`), but `prompts` in TypeScript is equally capable. [Source: 04-rust-research.md, Section 3.4]
- **Shelling out to `git`** is the recommended approach in both Rust (`std::process::Command`) and TypeScript (`Bun.spawn`). [Source: 04-rust-research.md, Section 3.5]

---

## 8. Claude Code And Hermes Findings

### Terminal UX Patterns to Adopt

From analyzing Claude Code (TypeScript + Ink TUI) and Hermes Agent (Python CLI + Ink TUI):

1. **Progress bar with 8-level block characters**: `[' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']` for smooth progress display. [Source: 05-terminal-patterns-research.md, Section 2.2]

2. **Tool completion lines**: `┊ {emoji} {verb:9} {detail}  {duration:.1f}s` format for showing each commit reviewed. [Source: 05-terminal-patterns-research.md, Section 2.5]

3. **Unicode spinner**: `['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']` for animated status during analysis. [Source: 05-terminal-patterns-research.md, Section 5.7]

4. **Color-coded severity**: Green for pass, amber for warning, red for error. [Source: 05-terminal-patterns-research.md, Section 5.2]

5. **Status notices**: `⚠ Warning: Large commit (15 files changed)` pattern for contextual warnings. [Source: 05-terminal-patterns-research.md, Section 2.9]

6. **Diff rendering**: Color-coded inline diffs with added/removed/context line styling. [Source: 05-terminal-patterns-research.md, Section 2.6]

### CLI vs TUI Decision

**CLI (not TUI)** is the correct choice:
- Commit Critic runs, produces output, and exits (classic CLI pattern)
- Pipeability: can be piped to `less`, redirected to files, used in CI/CD
- TUI adds React dependency tree and ~100+ files of infrastructure
- Both Claude Code and Hermes use CLI as their primary mode [Source: 05-terminal-patterns-research.md, Section 4]

---

## 9. Comparable OSS Tool Findings

### Market Gap

**No existing tool does AI-powered commit message CRITIQUE/SCORING.** The landscape is:

| Category | Tools | What They Do |
|----------|-------|-------------|
| AI generators | aicommits, OpenCommit, ai-commit | Generate commit messages from diffs |
| Rule-based linters | commitlint, gitlint, mit-lint | Validate against rules |
| Heuristic scoring | commrate | Grade A-F based on heuristics |

**Commit Critic fills the gap**: AI-powered quality evaluation with explainable scoring + actionable improvement suggestions. [Source: 06-oss-tools-research.md, Section 8.1]

### Key Differentiators

1. **No tool provides actionable improvement suggestions**. Existing linters say "subject too long" but don't suggest how to fix it. Commit Critic can say "Consider: 'fix(auth): handle token expiry in refresh flow' instead of 'fix token refresh issue'." [Source: 06-oss-tools-research.md, Section 8.1]

2. **No tool combines rule-based + AI scoring**. commrate uses heuristics, commitlint uses rules, but none combine both with AI semantic understanding. [Source: 06-oss-tools-research.md, Section 8.1]

3. **Multi-provider support from day one**. Most tools lock into a single provider. Commit Critic supports OpenAI, Anthropic, and local models. [Source: 06-oss-tools-research.md, Section 10]

### UX Patterns to Adopt from OSS Tools

- **Graceful hook fallback** from git-ai-commit: Never blocks a commit if LLM is unavailable. [Source: 06-oss-tools-research.md, Section 5.1]
- **Multi-generation with selection** from aicommits: Generate N options, user picks the best. [Source: 06-oss-tools-research.md, Section 5.1]
- **Diff truncation with notification** from aicommits: Truncates at 30K chars, notifies user. [Source: 06-oss-tools-research.md, Section 2.3]
- **Rich error display** from mit-lint (miette): Code spans, help text, reference URLs. [Source: 06-oss-tools-research.md, Section 5.1]

### Anti-Patterns to Avoid

- **No graceful fallback** (OpenCommit fails hard if API unavailable)
- **Overly simple prompts** (OpenCommit's original prompt too vague)
- **No diff size management** (some tools crash on large diffs)
- **Single provider lock-in** (geminicommit only supports Gemini)
- **No message quality feedback** (most generators don't evaluate quality)
- **Blocking on network** (no offline mode or fallback)

[Source: 06-oss-tools-research.md, Section 5.2]

---

## 10. Stack Decision Matrix

### TypeScript+Bun vs Rust vs Hybrid — Evidence-Driven

| Factor | TypeScript+Bun | Rust | Hybrid | Winner |
|--------|---------------|------|--------|--------|
| Team productivity | **High** (existing skills) | Low (2-4 month learning curve) | Medium (split focus) | **TS+Bun** |
| LLM integration | **Easy** (AI SDK v6) | Hard (fragmented unofficial crates) | Medium (HTTP boundary) | **TS+Bun** |
| Structured output | **Native** (Zod + AI SDK) | Manual (schemars + serde) | Native (TS side) | **TS+Bun** |
| Startup time | ~50-100ms | **~1ms** | ~1ms (Rust shell) | Rust |
| Binary size | ~20-30 MB | **~5-10 MB** | ~5-10 MB | Rust |
| Distribution | Single binary (Bun compile) or npm | **Single binary** | Single binary + TS dep | Rust |
| TUI quality | Good (prompts + picocolors) | **Excellent** (ratatui) | **Excellent** (ratatui) | Rust |
| Git integration | **Subprocess** (Bun.spawn) | Subprocess (recommended) | Subprocess | Tie |
| Dev iteration speed | **Instant** (no compile step) | Slow (10-60s compile) | Slow (dual builds) | **TS+Bun** |
| Maintenance burden | **Low** | Medium | **High** | **TS+Bun** |
| Ecosystem maturity | **Mature** (AI + CLI) | **Mature** (CLI crates) | Complex | **TS+Bun** |

### Verdict

**TypeScript+Bun wins on 7 of 11 factors**, including the ones that matter most for this project: LLM integration, structured output, team productivity, dev iteration speed, and maintenance burden.

Rust wins on startup time, binary size, and TUI quality — but these are secondary concerns for an I/O-bound developer tool. [Source: 04-rust-research.md, Section 4.4]

### Hybrid Rejected

A hybrid approach (Rust CLI + TypeScript AI core) adds:
- Two processes to manage (IPC complexity)
- Two languages to maintain
- Two build pipelines
- Two dependency trees
- Slower development (dual builds)
- No clear boundary between CLI and AI core

[Source: 04-rust-research.md, Section 4.3]

---

## 11. Proposed Architecture

### System Design

```
commit-critic (Bun TypeScript CLI)
├── src/cli.ts                    # Entry point: shebang + clipanion setup
├── src/commands/
│   ├── analyze.ts                # AnalyzeCommand: local or remote repo analysis
│   ├── write.ts                  # WriteCommand: interactive commit writer
│   └── doctor.ts                 # DoctorCommand: health check
├── src/core/
│   ├── git.ts                    # Git operations (Bun.spawn wrappers)
│   ├── analyzer.ts               # Commit message analysis engine
│   ├── scorer.ts                 # Deterministic scoring rules
│   ├── writer.ts                 # Interactive commit writer logic
│   ├── llm.ts                    # LLM client (AI SDK v6)
│   └── remote.ts                 # Remote repo clone/analyze/cleanup
├── src/types/
│   ├── commit.ts                 # Commit types
│   ├── analysis.ts               # Analysis result types
│   ├── config.ts                 # Config types
│   └── scoring.ts                # Scoring rubric types
├── src/ui/
│   ├── output.ts                 # Formatted output (picocolors)
│   ├── prompts.ts                # Interactive prompts wrapper
│   ├── spinner.ts                # Animated spinner (unicode frames)
│   ├── progress.ts               # Progress bar (8-level blocks)
│   └── json.ts                   # JSON output formatting
├── src/config/
│   ├── ai-config.ts              # AI provider config resolution
│   └── app-config.ts             # App config resolution
├── src/utils/
│   ├── env.ts                    # Environment variable helpers
│   ├── temp-dir.ts               # Temporary directory management
│   └── diff.ts                   # Diff parsing and truncation
└── src/__tests__/
    ├── analyzer.test.ts          # Analysis logic tests
    ├── scorer.test.ts            # Scoring rubric tests
    ├── git.test.ts               # Git operations tests
    ├── llm.test.ts               # LLM integration tests (mocked)
    ├── output.test.ts            # Output formatting tests
    └── e2e.test.ts               # End-to-end integration tests
```

### Data Flow: Analyze Mode

```
1. CLI parses args (clipanion)
2. If --url: clone remote repo to temp dir (shallow clone, depth=50)
3. git log --format=... -n 50 (Bun.spawn)
4. For each commit:
   a. Run deterministic scoring rules (scorer.ts)
   b. Call LLM for semantic critique (llm.ts + AI SDK)
   c. Combine scores (deterministic + LLM)
5. Render results (ui/output.ts)
6. If --url: cleanup temp dir
7. Exit with appropriate code
```

### Data Flow: Write Mode

```
1. CLI parses args (clipanion)
2. Check for staged changes (git diff --staged)
3. If no staged changes: show error, exit 1
4. Prompt user for commit type (prompts select)
5. Prompt user for scope (prompts text, optional)
6. Prompt user for description (prompts text)
7. Read staged diff, truncate if >50K chars
8. Call LLM to generate commit message (llm.ts + AI SDK)
9. Show suggestion to user
10. Prompt: accept, edit, regenerate, or cancel
11. If accept: output message (do NOT auto-commit)
12. If edit: open in $EDITOR or inline prompt
13. If regenerate: go to step 8 with feedback
```

### Data Flow: Doctor Mode

```
1. Check git binary availability
2. Check if current dir is a git repo
3. Check LLM provider config (env vars)
4. Test LLM provider connectivity (optional lightweight call)
5. Show health status with color-coded results
6. Exit 0 if all checks pass, exit 1 if critical failures
```

---

## 12. CLI UX Specification

### Commands

```
commit-critic analyze [options]
commit-critic write [options]
commit-critic doctor [options]
```

### Global Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | false | Output as structured JSON |
| `--verbose` | boolean | false | Show detailed debug output |
| `--version` | boolean | - | Show version |
| `--help` | boolean | - | Show help |

### Analyze Command Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--url <url>` | string | - | Remote repository URL to clone and analyze |
| `--count <n>` | number | 50 | Number of commits to analyze |
| `--strict` | boolean | false | Fail fast on LLM errors (no fallback) |
| `--provider <name>` | string | env | Override AI provider (openai, openrouter, lmstudio, vllm, ollama) |
| `--model <name>` | string | env | Override model ID |
| `--no-llm` | boolean | false | Skip LLM critique, use deterministic scoring only |

### Write Command Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--type <type>` | string | - | Pre-select commit type (feat, fix, docs, etc.) |
| `--no-llm` | boolean | false | Skip LLM suggestion, use template only |
| `--provider <name>` | string | env | Override AI provider |
| `--model <name>` | string | env | Override model ID |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | Provider name | `openai` |
| `AI_MODEL` | Model ID | `gpt-4.1` |
| `AI_STRICT_MODE` | Fail fast on LLM errors | `false` |
| `AI_TEMPERATURE` | Generation temperature | `0.1` |
| `AI_MAX_TOKENS` | Max output tokens | `4096` |
| `AI_MAX_RETRIES` | Max retry count | `2` |
| `AI_FALLBACK_CHAIN` | Comma-separated provider:model fallback chain | (empty) |
| `OPENAI_API_KEY` | OpenAI API key | (required for openai) |
| `OPENROUTER_API_KEY` | OpenRouter API key | (required for openrouter) |
| `LM_STUDIO_BASE_URL` | LM Studio base URL | `http://localhost:1234/v1` |
| `VLLM_BASE_URL` | vLLM base URL | `http://localhost:8000/v1` |
| `OLLAMA_BASE_URL` | Ollama base URL | `http://localhost:11434/v1` |
| `NO_COLOR` | Disable colors | (unset) |
| `COMMIT_CRITIC_CONFIG_DIR` | Config directory override | `~/.config/commit-critic` |

### Output Format: Rich Terminal

```
commit-critic analyze

Analyzing last 50 commits...

[████████░░] 80% — 40/50 commits analyzed

┊ ✍️  analyze    abc1234 feat: add user auth  0.3s
┊ ✍️  analyze    def5678 fix: resolve race condition  0.2s
┊ ✍️  analyze    ghi9012 Update stuff  0.1s

═══════════════════════════════════════════════════════
  Commit Analysis Report — 50 commits
═══════════════════════════════════════════════════════

  Overall Score: 7.2/10  ████████░░

  42 commits passed (84%)
   6 commits with warnings (12%)
   2 commits with errors (4%)

─── Issues ────────────────────────────────────────────

  ✗ abc1234  "fix stuff"
    Score: 2/10
    [critical] Subject too vague — consider: "fix(auth): handle token expiry in refresh flow"
    [warning]  Missing body — explain what changed and why
    [suggestion] Add scope to indicate affected component

  ⚠ def5678  "feat: add new feature"
    Score: 5/10
    [warning]  Subject generic — "new feature" doesn't communicate intent
    [suggestion] Specify what feature: "feat(dashboard): add user activity chart"

  ✓ ghi9012  "refactor(api): extract rate limiter middleware"
    Score: 9/10
    [suggestion] Consider adding body to explain the refactoring rationale

─── Summary ───────────────────────────────────────────

  Top issues:
  1. Vague subjects (12 commits) — be specific about what changed
  2. Missing body text (8 commits) — explain WHY, not just WHAT
  3. Missing scope (5 commits) — indicate affected component

  Analysis completed in 2.8s
```

### Output Format: JSON

```json
{
  "version": "1.0.0",
  "command": "analyze",
  "repo": "/path/to/repo",
  "commitCount": 50,
  "overallScore": 7.2,
  "summary": {
    "passed": 42,
    "warnings": 6,
    "errors": 2
  },
  "commits": [
    {
      "hash": "abc1234",
      "message": "fix stuff",
      "score": 2,
      "issues": [
        {
          "category": "subject",
          "severity": "critical",
          "message": "Subject too vague",
          "suggestion": "fix(auth): handle token expiry in refresh flow"
        }
      ]
    }
  ],
  "topIssues": [
    { "category": "vague-subject", "count": 12 },
    { "category": "missing-body", "count": 8 }
  ],
  "durationMs": 2800
}
```

---

## 13. LLM Provider And Config Specification

### Provider Resolution Chain

```
1. --provider flag (highest priority)
2. AI_PROVIDER env var
3. Config file (~/.config/commit-critic/config.json)
4. Default: openai
```

### Provider Configuration

```ts
// src/config/ai-config.ts

interface ProviderConfig {
  name: string;
  provider: any;
  modelId: string;
  capabilities: {
    structuredOutput: boolean;
    jsonExtraction: boolean;
    maxTokens: number;
  };
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  'openai:gpt-4.1': {
    structuredOutput: true,
    jsonExtraction: false,
    maxTokens: 4096,
  },
  'lmstudio:llama-3.3-70b': {
    structuredOutput: true,
    jsonExtraction: true,
    maxTokens: 4096,
  },
  'ollama:llama3.2': {
    structuredOutput: false,
    jsonExtraction: true,
    maxTokens: 2048,
  },
};
```

[Source: 03-ai-sdk-research.md, Section 6.2]

### Middleware Chain for Local Models

```ts
const middlewares = [];
if (config.capabilities.jsonExtraction) {
  middlewares.push(extractJsonMiddleware());
}
middlewares.push(
  defaultSettingsMiddleware({
    settings: {
      temperature: config.temperature || 0.1,
      maxOutputTokens: config.maxTokens || 4096,
    },
  })
);
```

[Source: 03-ai-sdk-research.md, Section 6.2]

### Fallback Chain

```ts
// AI_FALLBACK_CHAIN=lmstudio:llama-3.3-70b,openai:gpt-4.1
async function executeWithFallback<T>(
  task: (model: any) => Promise<T>,
  modelChain: string[]
): Promise<T> {
  for (const modelKey of modelChain) {
    try {
      const model = getconfiguredModel(modelKey);
      return await task(model);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        continue; // Try next model
      }
      throw error; // Non-recoverable
    }
  }
  throw new Error(`All models failed: ${modelChain.join(', ')}`);
}
```

[Source: 03-ai-sdk-research.md, Section 6.3]

---

## 14. Commit Scoring Rubric

### Hybrid Scoring: Deterministic + LLM

**Deterministic baseline** (fast, rule-based, no LLM needed):

| Category | Weight | Rules |
|----------|--------|-------|
| **Structure** | 20% | Subject/body separation, conventional commit format, blank line between subject and body |
| **Subject Quality** | 25% | Length <= 50 chars, imperative mood, no period, capitalized, not empty |
| **Conventional Commits** | 20% | Valid type (feat/fix/docs/etc.), lowercase type, optional scope, valid format |
| **Body Quality** | 15% | Wrapped at 72 chars, explains context, not empty when diff is large |
| **Diff Correlation** | 10% | Message length proportional to diff size (commrate pattern) |
| **Git Manual Style** | 10% | Chris Beams' 7 rules compliance |

[Source: 06-oss-tools-research.md, Section 4.1-4.4]

**LLM semantic scoring** (contextual, nuanced):

| Category | Weight | Evaluation |
|----------|--------|------------|
| **Specificity** | 25% | Mentions specific components/functions, not vague |
| **Intent Communication** | 25% | Explains WHY, not just WHAT |
| **Clarity** | 25% | Clear, concise, professional language |
| **Actionability** | 25% | Enables a reader to understand the change without seeing the diff |

### Combined Score

```
finalScore = (deterministicScore * 0.6) + (llmScore * 0.4)
```

- Deterministic score is always computed (fast, offline-capable)
- LLM score is computed when provider is available
- `--no-llm` flag skips LLM scoring (uses deterministic only, scaled to 10)

### Severity Levels

| Score Range | Severity | Display |
|-------------|----------|---------|
| 9-10 | Excellent | Green checkmark |
| 7-8 | Good | Green checkmark |
| 5-6 | Needs Improvement | Yellow warning |
| 3-4 | Poor | Yellow warning |
| 1-2 | Critical | Red error |

### Issue Categories

```ts
type IssueCategory = 'type' | 'scope' | 'subject' | 'body' | 'convention' | 'specificity' | 'intent' | 'clarity';
type IssueSeverity = 'critical' | 'warning' | 'suggestion';
```

---

## 15. Context Management Strategy

### 50 Commits Analysis

```ts
// Fetch last N commits with full context
const proc = Bun.spawn([
  'git', 'log', '--format=%H%n%s%n%b%n---COMMIT_SEPARATOR---',
  '-n', String(count),
  '--no-merges',  // Exclude merge commits
], { stderr: 'pipe' });

const output = await proc.stdout.text();
const commits = parseCommitLog(output);
```

For each commit, include:
- Hash (short)
- Subject line
- Body (if present)
- Author, date (for context)

### Staged Diffs for Write Mode

```ts
// Read staged changes
const diffProc = Bun.spawn(['git', 'diff', '--staged'], { stderr: 'pipe' });
let diff = await diffProc.stdout.text();

// Truncate if too large (50K char limit)
const MAX_DIFF_CHARS = 50000;
if (diff.length > MAX_DIFF_CHARS) {
  diff = diff.slice(0, MAX_DIFF_CHARS) + '\n\n[Diff truncated — ' + (diff.length - MAX_DIFF_CHARS) + ' chars omitted]';
}
```

[Source: 06-oss-tools-research.md, Section 2.3 — aicommits truncates at 30K chars]

### Remote Repo Analysis

```ts
// Clone remote repo to temp directory
const tempDir = await Bun.$`mktemp -d`.quiet().text();

try {
  await Bun.$`git clone --depth 50 ${url} ${tempDir}`;
  // Run analysis in tempDir
  const result = await analyzeRepo(tempDir, count);
  return result;
} finally {
  // Always cleanup
  await Bun.$`rm -rf ${tempDir}`;
}
```

- Use `--depth 50` for shallow clone (faster, less disk)
- Clean up in `finally` block to ensure temp dir is removed even on error
- Show progress: `Cloning ${url}...` to stderr

---

## 16. Dependency Shortlist

### Production Dependencies

| Package | Version | Purpose | Why Needed | Alternative Considered | Risk | Recommendation |
|---------|---------|---------|------------|----------------------|------|----------------|
| `clipanion` | ^4.0.0-rc.2 | CLI argument parsing | Subcommands, type inference, auto-help, zero deps | `util.parseArgs` (no subcommands), `commander` (Bun execArgv issues), `yargs` (heavy) | Low — well-maintained, powers Yarn Berry | **USE** |
| `ai` | ^4.0.0 | AI SDK core | `generateText`, `Output.object()`, provider registry, middleware | Raw `fetch` (manual, no structured output), `langchain` (heavy, overkill) | Medium — evolving API (v6 migration) | **USE** |
| `@ai-sdk/openai` | ^1.0.0 | OpenAI provider | Native OpenAI support with structured output | Raw fetch to OpenAI API | Low — official Vercel package | **USE** |
| `@ai-sdk/openai-compatible` | ^1.0.0 | OpenAI-compatible provider | Local models (vLLM, LM Studio, Ollama), OpenRouter | Separate packages per provider | Low — official Vercel package | **USE** |
| `zod` | ^3.24.0 | Schema validation | LLM output validation, config validation, type inference | `joi` (older), `yup` (less TS-friendly) | Negligible — industry standard | **USE** |
| `picocolors` | ^1.1.1 | Terminal colors | 0.3 KB gzipped, NO_COLOR support, fast | `chalk` (13 KB, unnecessary features) | Negligible — tiny, stable | **USE** |
| `prompts` | ^2.4.2 | Interactive prompts | Write mode: text/select inputs | `inquirer` (heavier), `enquirer` (less popular) | Low — mature, widely used | **USE** |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking (`tsc --noEmit`) |
| `@types/prompts` | TypeScript definitions for prompts |
| `bun-types` | Bun API type definitions (bundled with Bun) |

### Total Dependency Count

- **Production: 7 packages** (clipanion, ai, @ai-sdk/openai, @ai-sdk/openai-compatible, zod, picocolors, prompts)
- **Dev: 2 packages** (typescript, @types/prompts)
- **Built-in (zero deps):** Bun runtime, Bun.spawn, fetch, Bun.file, Bun.test, util.parseArgs

---

## 17. Security And Supply-Chain Notes

### API Key Handling

- API keys are read from environment variables only
- Never stored in config files or logged
- Config files (if used) have restrictive permissions (0o600)
- Atomic config writes (write to `.tmp`, then `rename()`)

[Source: 01-steel-research.md, Section 5 — atomic config writes]

### Dependency Security

- Minimal dependency count (7 production packages) reduces attack surface
- All production dependencies are well-maintained, widely-used packages
- `bun install --frozen-lockfile` in CI ensures reproducible builds
- Consider adding `bun audit` to CI pipeline

### Subprocess Security

- `Bun.spawn` uses array arguments (no shell injection)
- Remote repo URLs are validated before use in `git clone`
- Temp directories are created with `mktemp -d` (secure random names)

### Git Binary Trust

- The tool shells out to `git` which is a system binary
- No custom git hooks are installed
- No modifications to `.git/` directory

### Supply Chain

- Bun's built-in package manager with lockfile
- All npm packages are from official sources (Vercel for AI SDK, Yarn team for clipanion)
- No native/C++ dependencies (avoids compilation supply chain risks)

---

## 18. Testing And Verification Plan

### Test Strategy (Three Layers — following Steel CLI pattern)

[Source: 01-steel-research.md, Section 6]

#### Layer 1: Unit Tests

```ts
// src/__tests__/scorer.test.ts
import { test, expect } from 'bun:test';
import { scoreCommit } from '../core/scorer';

test('scores a perfect conventional commit', () => {
  const result = scoreCommit({
    subject: 'fix(auth): handle token expiry in refresh flow',
    body: 'When the refresh token expires, the auth middleware now catches the error and redirects to login.',
    diffLength: 200,
  });
  expect(result.score).toBeGreaterThanOrEqual(8);
  expect(result.issues.length).toBe(0);
});

test('flags a vague commit message', () => {
  const result = scoreCommit({
    subject: 'fix stuff',
    body: '',
    diffLength: 500,
  });
  expect(result.score).toBeLessThan(4);
  expect(result.issues.some(i => i.severity === 'critical')).toBe(true);
});

test('detects missing conventional commit type', () => {
  const result = scoreCommit({
    subject: 'Added new feature',
    body: '',
    diffLength: 100,
  });
  expect(result.issues.some(i => i.category === 'type')).toBe(true);
});
```

#### Layer 2: Integration Tests

```ts
// src/__tests__/git.test.ts
import { test, expect } from 'bun:test';
import { getCommits } from '../core/git';

test('reads commits from a real git repo', async () => {
  const commits = await getCommits('/tmp/test-repo', 5);
  expect(commits.length).toBe(5);
  expect(commits[0]).toHaveProperty('hash');
  expect(commits[0]).toHaveProperty('subject');
});

test('handles repo with no commits', async () => {
  const commits = await getCommits('/tmp/empty-repo', 50);
  expect(commits.length).toBe(0);
});
```

#### Layer 3: Black-Box / E2E Tests

```ts
// src/__tests__/e2e.test.ts
import { test, expect } from 'bun:test';
import { spawn } from 'bun';

test('analyze command produces JSON output', async () => {
  const proc = spawn([
    'bun', 'run', 'src/cli.ts', 'analyze', '--json', '--count', '5'
  ], {
    cwd: '/tmp/test-repo',
    env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-fake-key' },
  });

  const output = await proc.stdout.text();
  const result = JSON.parse(output);

  expect(result).toHaveProperty('version');
  expect(result).toHaveProperty('commitCount');
  expect(result).toHaveProperty('overallScore');
  expect(result).toHaveProperty('commits');
});
```

### Key Test Cases

| Test | What It Proves |
|------|---------------|
| Perfect conventional commit scores high | Scoring rubric works correctly |
| Vague commit scores low | Scoring catches bad commits |
| Missing type detected | Conventional commit validation works |
| JSON output is valid | --json flag produces parseable output |
| Auto-JSON on pipe | Piped output is JSON |
| --no-llm works offline | Deterministic scoring works without LLM |
| Remote repo clone/analyze/cleanup | Remote analysis lifecycle works |
| Temp dir cleanup on error | No orphaned temp directories |
| Large diff truncation | Handles repos with massive diffs |
| Empty repo handling | Graceful error for repos with no commits |
| Missing API key error | Clear error message when provider not configured |
| NO_COLOR respected | Colors disabled when NO_COLOR set |

---

## 19. README And .env.example Plan

### README Structure

```markdown
# commit-critic

AI-powered commit message critic and writer.

## Install

```bash
# Via npm (requires Bun)
bun install -g commit-critic

# Or use directly
bunx commit-critic analyze
```

## Quick Start

```bash
# Analyze last 50 commits
commit-critic analyze

# Analyze a remote repo
commit-critic analyze --url https://github.com/user/repo

# Interactive commit writer
commit-critic write

# JSON output for CI/CD
commit-critic analyze --json
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
```

## Commands

... (detailed command reference)

## Scoring

... (explain scoring rubric)

## Output Formats

... (terminal vs JSON examples)

## Contributing

... (development setup, test commands)
```

### .env.example

```bash
# === Primary Provider ===
# Provider: openai | openrouter | lmstudio | vllm | ollama
AI_PROVIDER=openai

# Model ID within the selected provider
AI_MODEL=gpt-4.1

# Strict mode: fail fast on structured output errors
AI_STRICT_MODE=false

# === Generation Settings ===
AI_TEMPERATURE=0.1
AI_MAX_TOKENS=4096
AI_MAX_RETRIES=2

# === Fallback Chain ===
# Comma-separated provider:model pairs
# AI_FALLBACK_CHAIN=lmstudio:llama-3.3-70b,openai:gpt-4.1

# === OpenAI ===
OPENAI_API_KEY=sk-...

# === OpenRouter ===
# OPENROUTER_API_KEY=sk-or-...

# === LM Studio ===
# LM_STUDIO_BASE_URL=http://localhost:1234/v1
# LM_STUDIO_MODEL=llama-3.3-70b

# === vLLM ===
# VLLM_BASE_URL=http://localhost:8000/v1
# VLLM_API_KEY=
# VLLM_MODEL=mistral-7b-instruct

# === Ollama ===
# OLLAMA_BASE_URL=http://localhost:11434/v1
# OLLAMA_MODEL=llama3.2
```

---

## 20. Scaffold File Tree

```
commit-critic/
├── .env.example
├── .gitignore
├── bun.lock
├── bunfig.toml
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── src/
│   ├── cli.ts                          # Entry point: shebang + clipanion setup
│   ├── commands/
│   │   ├── analyze.ts                  # AnalyzeCommand class
│   │   ├── write.ts                    # WriteCommand class
│   │   └── doctor.ts                   # DoctorCommand class
│   ├── core/
│   │   ├── git.ts                      # Git operations (Bun.spawn wrappers)
│   │   ├── analyzer.ts                 # Commit message analysis engine
│   │   ├── scorer.ts                   # Deterministic scoring rules engine
│   │   ├── writer.ts                   # Interactive commit writer logic
│   │   ├── llm.ts                      # LLM client (AI SDK v6 integration)
│   │   └── remote.ts                   # Remote repo clone/analyze/cleanup
│   ├── types/
│   │   ├── commit.ts                   # Commit types (hash, subject, body, author, date)
│   │   ├── analysis.ts                 # Analysis result types (score, issues, suggestions)
│   │   ├── config.ts                   # Config types (AI config, app config)
│   │   └── scoring.ts                  # Scoring rubric types (Issue, Severity, Category)
│   ├── ui/
│   │   ├── output.ts                   # Rich terminal output (picocolors)
│   │   ├── prompts.ts                  # Interactive prompts wrapper (prompts lib)
│   │   ├── spinner.ts                  # Animated spinner (unicode frames)
│   │   ├── progress.ts                 # Progress bar (8-level block characters)
│   │   └── json.ts                     # JSON output formatting
│   ├── config/
│   │   ├── ai-config.ts                # AI provider config resolution
│   │   └── app-config.ts               # App config resolution (config dir, settings)
│   ├── utils/
│   │   ├── env.ts                      # Environment variable helpers
│   │   ├── temp-dir.ts                 # Temporary directory management
│   │   └── diff.ts                     # Diff parsing and truncation
│   └── __tests__/
│       ├── scorer.test.ts              # Scoring rubric unit tests
│       ├── analyzer.test.ts            # Analysis logic tests
│       ├── git.test.ts                 # Git operations tests
│       ├── llm.test.ts                 # LLM integration tests (mocked provider)
│       ├── output.test.ts              # Output formatting tests
│       ├── config.test.ts              # Config resolution tests
│       └── e2e.test.ts                 # End-to-end integration tests
├── dist/                               # Build output (gitignored)
│   ├── cli.js                          # npm bin target
│   ├── commit-critic-linux-x64         # Standalone Linux binary
│   ├── commit-critic-darwin-arm64      # Standalone macOS ARM binary
│   ├── commit-critic-darwin-x64        # Standalone macOS Intel binary
│   └── commit-critic-windows-x64.exe   # Standalone Windows binary
├── research/                           # Research docs
│   ├── 01-steel-research.md
│   ├── 02-bun-cli-research.md
│   ├── 03-ai-sdk-research.md
│   ├── 04-rust-research.md
│   ├── 05-terminal-patterns-research.md
│   ├── 06-oss-tools-research.md
│   └── 07-architecture-synthesis.md    # This file
└── .github/
    └── workflows/
        └── build.yml                   # CI: test + compile binaries on tag
```

---

## 21. Implementation Milestones

### Milestone 1: Foundation (Day 1-2)
- [ ] Initialize project: `bun init`, install dependencies
- [ ] Set up clipanion CLI with `analyze`, `write`, `doctor` commands
- [ ] Implement `--json` global flag and auto-JSON on pipe
- [ ] Implement semantic exit codes
- [ ] Set up tsconfig.json, bunfig.toml
- [ ] Write README skeleton

### Milestone 2: Git Operations (Day 2-3)
- [ ] Implement `git.ts`: `getCommits()`, `getStagedDiff()`, `isGitRepo()`
- [ ] Implement `remote.ts`: shallow clone, cleanup
- [ ] Implement diff truncation utility
- [ ] Write unit tests for git operations

### Milestone 3: Deterministic Scoring (Day 3-4)
- [ ] Implement `scorer.ts`: all deterministic rules
  - Structure check (subject/body separation)
  - Subject quality (length, imperative mood, capitalization, period)
  - Conventional commits validation (type, scope, format)
  - Body quality (wrapping, context)
  - Diff correlation (message length vs diff size)
  - Git manual style (Chris Beams' 7 rules)
- [ ] Write comprehensive unit tests for scoring rubric
- [ ] Verify scoring against known good/bad commit messages

### Milestone 4: LLM Integration (Day 4-5)
- [ ] Implement `ai-config.ts`: provider resolution, config loading
- [ ] Implement `llm.ts`: AI SDK integration with hybrid structured output
- [ ] Implement Zod schemas for LLM output
- [ ] Implement `extractJsonMiddleware` for local models
- [ ] Implement fallback chain
- [ ] Write tests with mocked LLM provider

### Milestone 5: Analysis Engine (Day 5-6)
- [ ] Implement `analyzer.ts`: combine deterministic + LLM scoring
- [ ] Implement `--no-llm` mode (deterministic only)
- [ ] Implement `--strict` mode (fail fast)
- [ ] Write integration tests

### Milestone 6: Terminal Output (Day 6-7)
- [ ] Implement `output.ts`: rich terminal output with picocolors
- [ ] Implement `spinner.ts`: animated spinner during analysis
- [ ] Implement `progress.ts`: progress bar with 8-level blocks
- [ ] Implement `json.ts`: structured JSON output
- [ ] Implement auto-JSON on pipe detection
- [ ] Write output formatting tests

### Milestone 7: Write Mode (Day 7-8)
- [ ] Implement `writer.ts`: interactive commit writer
- [ ] Implement prompts for type, scope, description
- [ ] Implement LLM suggestion generation
- [ ] Implement accept/edit/regenerate flow
- [ ] Write tests for write mode

### Milestone 8: Doctor Command (Day 8)
- [ ] Implement `doctor.ts`: health checks
- [ ] Check git availability, repo detection, LLM connectivity
- [ ] Color-coded output with fix suggestions

### Milestone 9: Polish (Day 9)
- [ ] Error hints on all error paths
- [ ] `NO_COLOR` support
- [ ] `--help` with categorized examples
- [ ] Command aliases (`a` for `analyze`, `w` for `write`)
- [ ] Version flag
- [ ] Config file support (optional, `~/.config/commit-critic/config.json`)

### Milestone 10: Build and Distribution (Day 10)
- [ ] `bun build --compile` for all platforms
- [ ] GitHub Actions CI workflow
- [ ] npm package.json bin field
- [ ] Final README with examples
- [ ] `.env.example`
- [ ] E2E smoke tests

---

## 22. Risks, Unknowns, And Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI SDK v6 API changes | Medium | Medium | Pin exact versions, abstract LLM calls behind interface |
| Bun `--compile` binary size (~20-30 MB) | Certain | Low | Acceptable for dev tool; npm distribution is lightweight |
| Local model structured output failures | High | Medium | Hybrid fallback strategy, `extractJsonMiddleware` |
| Large diffs causing LLM timeouts | Medium | Medium | Diff truncation at 50K chars with notification |
| Git binary not available | Low | High | Clear error message, check in doctor command |
| Cross-compiled binary issues | Low | Medium | Test on native runners in CI |

### Unknowns

1. **AI SDK v6 stability**: The v6 migration guide indicates API changes. Pin versions and monitor for breaking changes. [Source: 03-ai-sdk-research.md, Section 2.2]
2. **clipanion v4 RC**: clipanion v4 is in release candidate. v3.2.1 is stable. Consider using v3.2.1 for production stability. [Source: 02-bun-cli-research.md, Section 3.3]
3. **Ollama structured output reliability**: Ollama converts JSON schemas to GBNF grammars but doesn't validate the full response. Client-side Zod validation is essential. [Source: 03-ai-sdk-research.md, Section 4.4]

### Open Questions

1. **Should `--write` support `--amend` mode?** — Amend the last commit's message. Useful but adds complexity. Defer to v2.
2. **Should there be a config file format?** — JSON config at `~/.config/commit-critic/config.json` for persistent settings. Useful but env vars cover most needs. Defer to v2.
3. **Should commit-critic support pre-commit hooks?** — A `--hook` mode that runs in `prepare-commit-msg`. Useful for CI/CD. Defer to v2.
4. **Should there be a `--fix` mode?** — Auto-fix common issues (add conventional commit type, capitalize subject). Risky but high value. Defer to v2.

---

## 23. Final CTO Recommendation

### Direct Answers to Research Questions

**Q: Should the final implementation be TypeScript+Bun, Rust, or hybrid?**
A: **TypeScript+Bun**. The AI/LLM integration layer is the core differentiator, and TypeScript's AI SDK v6 + Zod ecosystem is unmatched. Rust offers performance advantages that are irrelevant for this I/O-bound workload. Hybrid adds complexity without proportional benefit. [Source: 04-rust-research.md, Section 8.1]

**Q: If TypeScript+Bun, what exact libraries should be used and why?**
A:
- `clipanion` — Type-safe CLI parsing, zero deps, powers Yarn Berry
- `ai` + `@ai-sdk/openai` + `@ai-sdk/openai-compatible` — Unified LLM interface, structured output, multi-provider
- `zod` — Schema validation for LLM output and config
- `picocolors` — Terminal colors (0.3 KB, 14x smaller than chalk)
- `prompts` — Interactive prompts for write mode
[Source: 02-bun-cli-research.md, Section 8; 03-ai-sdk-research.md, Section 1]

**Q: If Rust is not used, what did Rust research reveal and why is it not worth the complexity?**
A: Rust research revealed that `git2` is problematic (SSH issues, C deps), the OpenAI client ecosystem is fragmented, and there's no Zod equivalent for structured output validation. The 2-4 month learning curve, slow compile times (10-60s), and the fact that Commit Critic is I/O-bound make Rust's advantages (sub-ms startup, small binary) irrelevant. [Source: 04-rust-research.md, Sections 3.5, 3.7, 3.8, 5, 6.2]

**Q: If Rust is used, what part of the stack owns Rust and how does AI SDK fit?**
A: N/A — Rust is not used. If it were, the hybrid approach (Rust CLI + TypeScript AI core via HTTP) would add IPC complexity without benefit. [Source: 04-rust-research.md, Section 4.3]

**Q: Should Git access use the git binary, a JS Git library, Rust git library, or a hybrid?**
A: **Git binary via `Bun.spawn`/`Bun.$`**. The `git2` Rust crate has SSH/auth issues and even major projects are migrating away from it. `isomorphic-git` lacks SSH support and is slower. `simple-git` is a valid alternative but `Bun.spawn` is simpler and avoids an extra dependency. [Source: 04-rust-research.md, Section 3.5; 02-bun-cli-research.md, Section 5.1]

**Q: How should remote repo analysis clone and clean up repos?**
A: Shallow clone (`git clone --depth 50`) to a `mktemp -d` directory, analyze, then clean up in a `finally` block. Show progress to stderr. [Source: 02-bun-cli-research.md, Section 5.1; Section 15 of this doc]

**Q: How should the tool support OpenAI-compatible local providers?**
A: Through `@ai-sdk/openai-compatible` with `createOpenAICompatible()`. Configure via env vars: `AI_PROVIDER=lmstudio`, `LM_STUDIO_BASE_URL`, `AI_MODEL`. All local providers (vLLM, LM Studio, Ollama) use the same OpenAI-compatible interface. [Source: 03-ai-sdk-research.md, Sections 3.1, 4.1]

**Q: How should it handle weak local models?**
A: Hybrid structured output strategy: try `Output.object()` first, catch `NoObjectGeneratedError`, fall back to `generateText()` + manual JSON parsing + Zod validation. Use `extractJsonMiddleware()` to strip markdown code fences. Configure `structuredOutput: false` for known weak models. [Source: 03-ai-sdk-research.md, Sections 5.2, 5.3, 6.1]

**Q: Should scoring be deterministic, LLM-based, or hybrid?**
A: **Hybrid**. Deterministic baseline (60% weight) for fast, offline-capable scoring. LLM semantic scoring (40% weight) for contextual, nuanced evaluation. `--no-llm` flag for deterministic-only mode. [Source: 06-oss-tools-research.md, Section 8.3; Section 14 of this doc]

**Q: How should commit stats be computed?**
A: Via `git log --format=%H%n%s%n%b -n 50 --no-merges` parsed line-by-line. For diff sizes: `git diff --stat` or `git diff --numstat` per commit. [Source: 02-bun-cli-research.md, Section 5.1]

**Q: How should rich terminal output and --json output be structured?**
A: Rich terminal: colored, structured output with emoji prefixes, progress bars, severity indicators. JSON: structured object with `version`, `command`, `commitCount`, `overallScore`, `summary`, `commits[]`, `topIssues[]`, `durationMs`. Auto-switch to JSON when stdout is piped. [Source: 01-steel-research.md, Section 2; Section 12 of this doc]

**Q: What should --write do when there are no staged changes?**
A: Show a clear error message: "No staged changes found. Stage files with `git add` first." Exit with code 1. Do NOT proceed.

**Q: What should happen if no API key/provider is configured?**
A: Show a clear error with hint: "Error: No LLM provider configured. Set OPENAI_API_KEY or configure a local provider. Run `commit-critic doctor` for diagnostics." If `--no-llm` is passed, proceed with deterministic scoring only. Exit with code 3 (auth error) following Steel's semantic exit codes. [Source: 01-steel-research.md, Section 4]

**Q: What tests prove the solution works?**
A: Three layers:
1. Unit tests: scoring rubric, git operations, config resolution
2. Integration tests: LLM integration (mocked), analysis engine
3. Black-box tests: compiled binary output, JSON format, exit codes
[Source: 01-steel-research.md, Section 6; Section 18 of this doc]

**Q: What is the smallest polished version that still feels elite?**
A: The MVP includes:
- `analyze` command with deterministic + LLM scoring
- `write` command with interactive prompts and LLM suggestions
- Rich terminal output with colors, progress bars, emoji
- `--json` flag and auto-JSON on pipe
- Multi-provider support (OpenAI + at least one local)
- `doctor` command for health checks
- Semantic exit codes and error hints
- `bun build --compile` standalone binary

### Preferred Direction Validation

The preferred direction is **validated and confirmed**:

| Decision | Status | Notes |
|----------|--------|-------|
| Standalone Bun TypeScript CLI package | CONFIRMED | clipanion + picocolors + prompts + AI SDK |
| AI SDK multi-provider LLM layer | CONFIRMED | `createProviderRegistry` + `@ai-sdk/openai-compatible` |
| OpenAI-compatible local model support | CONFIRMED | vLLM, LM Studio, Ollama via `createOpenAICompatible()` |
| Zod schemas for LLM output validation | CONFIRMED | `Output.object()` + manual Zod parse fallback |
| Deterministic baseline + LLM critique | CONFIRMED | 60/40 weight split, `--no-llm` flag |
| Rich terminal output by default | CONFIRMED | picocolors + spinner + progress bar |
| --json for machine-readable output | CONFIRMED | Global flag + auto-detection on pipe |
| git binary via Bun.spawn | CONFIRMED | Array args, no shell injection |
| Remote repos by shallow temp clone | CONFIRMED | `--depth 50`, cleanup in finally |
| --write suggests, user accepts/edits | CONFIRMED | Does NOT auto-commit by default |
| README, .env.example, tests | CONFIRMED | Full documentation and test coverage |
| bun build --compile executable | CONFIRMED | Cross-platform binaries via CI |

### Final Word

Commit Critic is a well-scoped project with a clear market gap (AI-powered commit message critique with explainable scoring). The TypeScript+Bun stack is the right choice — it leverages the team's existing expertise, provides access to the best AI/LLM tooling (AI SDK v6 + Zod), and produces a functional CLI with minimal friction. The 10-day implementation plan is achievable, and the architecture is clean enough that a coding agent can implement it without redoing research.

The key to success is the **hybrid scoring approach** (deterministic + LLM) and the **multi-provider support** from day one. These are the differentiators that no existing tool offers.

---

## Appendix A: package.json

```json
{
  "name": "commit-critic",
  "version": "0.1.0",
  "description": "AI-powered commit message critic and writer",
  "type": "module",
  "main": "./dist/cli.js",
  "bin": {
    "commit-critic": "./dist/cli.js"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build ./src/cli.ts --outdir ./dist --target=bun --minify",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "compile:linux": "bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile ./dist/commit-critic-linux-x64 --minify",
    "compile:mac-arm": "bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile ./dist/commit-critic-darwin-arm64 --minify",
    "compile:mac-intel": "bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile ./dist/commit-critic-darwin-x64 --minify",
    "compile:windows": "bun build ./src/cli.ts --compile --target=bun-windows-x64 --outfile ./dist/commit-critic-windows-x64.exe --minify"
  },
  "dependencies": {
    "clipanion": "^3.2.1",
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/openai-compatible": "^1.0.0",
    "zod": "^3.24.0",
    "picocolors": "^1.1.1",
    "prompts": "^2.4.2"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/prompts": "^2.4.9"
  }
}
```

## Appendix B: tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"],
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Appendix C: bunfig.toml

```toml
[install]
peer = false

[test]
# Timeout for test runs
timeout = 30000
```

## Appendix D: .gitignore

```
node_modules/
dist/
.env
*.tsbuildinfo
coverage/
```
