# Deep Research Plan — Remaining Tasks for commit-critic v1

**Generated:** 2026-05-21
**Scope:** Multi-wave research against Hermes Agent, Steel CLI, and OSS examples to produce execution-ready artifacts for a senior agent.
**Output:** Research artifacts in `__reports__/research/`

---

## Remaining Task Inventory

From the THIRD-PASS-IMPROVEMENT-PLAN, the following items were deferred or identified as needing deeper research before implementation:

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Fallback chain execution (`fallbackChain` parsed but never executed) | P2 | RESEARCH |
| 2 | Parallel deterministic scoring (currently sequential) | P2 | RESEARCH |
| 3 | `describe` command for AI agents (structured introspection) | P2 | RESEARCH |
| 4 | Global `--json` flag (currently per-command only) | P2 | RESEARCH |
| 5 | JSON envelope wrapping with error codes and hints | P2 | RESEARCH |
| 6 | Shell completion generation (clipanion support) | P2 | RESEARCH |
| 7 | Project-level config file (currently env+flags only) | P2 | RESEARCH |
| 8 | Structured diff parsing (currently raw diff + truncation) | P2 | RESEARCH |
| 9 | Enhanced `doctor` with connectivity probes and version checks | P2 | RESEARCH |
| 10 | Telemetry (opt-out, batched) — evaluate need | P2 | RESEARCH |

---

## Research Wave Plan

### Wave 1: Hermes Agent Internals (Primary Source)
**Goal:** Extract CLI patterns from Hermes Agent's Python codebase that apply to commit-critic's TypeScript CLI.

**Files to analyze:**
- `~/.hermes/hermes-agent/hermes_cli/cli_output.py` — print_info/success/warning/error, prompt helpers
- `~/.hermes/hermes-agent/hermes_cli/commands.py` — command registry, slash command dispatch
- `~/.hermes/hermes-agent/agent/display.py` — KawaiiSpinner (frames, TTY detection, patch_stdout handling)
- `~/.hermes/hermes-agent/agent/rate_limit_tracker.py` — ASCII progress bar `_bar()` function
- `~/.hermes/hermes-agent/hermes_cli/completion.py` — shell completion generation
- `~/.hermes/hermes-agent/agent/error_classifier.py` — error classification patterns
- `~/.hermes/hermes-agent/hermes_cli/skills_config.py` — config resolution chain

**Research questions:**
1. How does Hermes centralize exit codes? Does it use constants or literals?
2. How does the KawaiiSpinner handle non-TTY environments (Docker, pipes)?
3. What is the skin engine architecture for theming CLI output?
4. How does Hermes classify errors into user-facing categories?
5. What patterns exist for config file resolution (env > file > default)?
6. How is shell completion generated and distributed?

**Artifact output:** `__reports__/research/01-hermes-patterns.md`

---

### Wave 2: Steel CLI Internals (Primary Source)
**Goal:** Extract Rust CLI patterns from Steel CLI that translate to TypeScript/Bun.

**Files to analyze (from `.internal/reference/steel-cli/`):**
- `src/util/output.rs` — exit codes, SilentExit, error classification, JSON/text mode
- `src/commands/mod.rs` — global flags pattern, command dispatch, telemetry wrapper
- `src/config/auth.rs` — auth resolution chain (env > config > none)
- `src/config/settings.rs` — atomic config writes, base URL resolution
- `src/commands/doctor.rs` — health check implementation
- `src/commands/describe.rs` — structured command introspection
- `src/commands/completion.rs` — shell completion generation
- `src/util/api.rs` — OnceLock global context pattern
- `src/telemetry.rs` — batched telemetry with opt-out

**Research questions:**
1. How does Steel's `SilentExit` sentinel work? Can we implement a TypeScript equivalent?
2. What is the exact error classification logic (auth vs network vs API client vs API server)?
3. How does Steel implement atomic config writes with permission setting?
4. What does the `describe` command return? Can we build a TypeScript equivalent?
5. How does Steel's telemetry batching work? Is it worth adopting?
6. What is the `status!` macro pattern for stderr messages?

**Artifact output:** `__reports__/research/02-steel-patterns.md`

---

### Wave 3: OSS CLI Examples (Secondary Sources)
**Goal:** Find open-source TypeScript/Bun CLI tools that implement deferred features.

**Repositories to search:**
1. **clipanion examples** — Shell completion, global flags
2. **aicommits** (TypeScript) — Config file, multi-generation, diff truncation
3. **OpenCommit** (TypeScript) — Provider registry, config system
4. **commitlint** (TypeScript) — Rule engine, structured output
5. **git-ai-commit** (Go) — Hook fallback, graceful degradation
6. **mit-lint** (Rust) — Rich error display with code spans
7. **Vercel's `turbo`** (Rust) — Progress bars, parallel execution
8. **Bun's own CLI** — How Bun handles global flags and subcommands

**Research questions:**
1. Which OSS tools implement project-level config files? What formats (JSON, YAML, TOML)?
2. How do tools handle parallel execution of independent tasks?
3. What patterns exist for structured diff parsing (not just raw text)?
4. How do CLI tools implement shell completion for multiple shells (bash/zsh/fish)?
5. What is the standard for JSON envelope wrapping in CLI tools?

**Artifact output:** `__reports__/research/03-oss-patterns.md`

---

### Wave 4: AI SDK v7 Canary Deep Dive
**Goal:** Verify all AI SDK v7 canary APIs used in commit-critic and identify improvements.

**Files to analyze:**
- `node_modules/ai/dist/index.d.ts` — `generateText`, `Output`, `NoObjectGeneratedError`
- `node_modules/@ai-sdk/provider/dist/index.d.ts` — `LanguageModelV4` interface
- `node_modules/@ai-sdk/openai-compatible/dist/index.d.ts` — `createOpenAICompatible` options
- `node_modules/ai/dist/test/index.d.ts` — `MockLanguageModelV4` for testing

**Research questions:**
1. What is the exact `LanguageModelV4GenerateResult` shape? (We already discovered inputTokens needs cacheRead/cacheWrite, outputTokens needs text/reasoning)
2. Does `generateText` support `fallbackProvider` or `fallbackModel` natively?
3. What middleware patterns exist in v7? Can we use `extractJsonMiddleware`?
4. How does `Output.object()` handle models that don't support structured output?
5. What is the `providerRegistry` pattern in v7? Can we replace our switch statement?

**Artifact output:** `__reports__/research/04-ai-sdk-v7-patterns.md`

---

### Wave 5: Synthesis and Execution Plan
**Goal:** Synthesize all research into prioritized, execution-ready task specifications.

**Input:** Artifacts from Waves 1-4
**Output:**
1. `__reports__/research/05-execution-plan.md` — Prioritized task list with file paths, acceptance criteria, and verification steps
2. `__reports__/research/06-senior-agent-prompt.md` — The prompt you requested

---

## Research Artifact Directory Structure

```
__reports/
  research/
    01-hermes-patterns.md
    02-steel-patterns.md
    03-oss-patterns.md
    04-ai-sdk-v7-patterns.md
    05-execution-plan.md
    06-senior-agent-prompt.md
```

---

## Completion Criteria

- [ ] All 5 research waves completed
- [ ] Each artifact contains: findings, code snippets, applicability assessment, implementation notes
- [ ] Execution plan prioritizes tasks by impact/effort ratio
- [ ] Senior agent prompt is self-contained and references no external context
