# Senior Agent Prompt — commit-critic v1 Remaining Tasks

**Context:** You are implementing the remaining deferred tasks for commit-critic, a Bun + TypeScript CLI tool for AI-powered commit message critique. The core engine is already implemented and passing all tests. Your job is to research, design, and implement the remaining features using patterns from Hermes Agent, Steel CLI, and OSS examples.

**Working directory:** `/home/raghuboi/Desktop/projects/commit-critic`

**Primary sources:**
- Hermes Agent CLI internals: `~/.hermes/hermes-agent/hermes_cli/`
- Steel CLI source: `.internal/reference/steel-cli/` (if available) or `.internal/research/01-steel-research.md`
- OSS examples: clipanion, aicommits, OpenCommit, commitlint
- AI SDK v7 canary: `node_modules/ai/`, `node_modules/@ai-sdk/`

---

## Phase 0: Research (Read-Only)

Before writing any code, read and analyze:

1. **Hermes patterns:**
   - `~/.hermes/hermes-agent/hermes_cli/cli_output.py` — print helpers, prompt patterns
   - `~/.hermes/hermes-agent/agent/display.py` — KawaiiSpinner (lines 559-780), TTY detection, non-TTY fallback
   - `~/.hermes/hermes-agent/agent/rate_limit_tracker.py` — `_bar()` progress bar function
   - `~/.hermes/hermes-agent/hermes_cli/completion.py` — shell completion generation
   - `~/.hermes/hermes-agent/agent/error_classifier.py` — error classification

2. **Steel patterns:**
   - `.internal/research/01-steel-research.md` — exit codes, SilentExit, error classification, config resolution
   - `.internal/research/07-architecture-synthesis.md` — full architecture summary

3. **Current commit-critic state:**
   - `src/cli.ts` — clipanion setup, current command registration
   - `src/commands/*.ts` — existing commands
   - `src/ui/*.ts` — current output, spinner, progress implementations
   - `src/core/*.ts` — core engine (git, scorer, llm, analyzer, writer, remote)
   - `src/config/*.ts` — config resolution
   - `src/utils/exit-codes.ts` — centralized exit codes
   - `package.json` — dependencies and scripts
   - `tsconfig.json` — TypeScript config

4. **AI SDK v7 canary:**
   - `node_modules/ai/dist/index.d.ts` — verify `generateText`, `Output`, `NoObjectGeneratedError` APIs
   - `node_modules/ai/dist/test/index.d.ts` — `MockLanguageModelV4` for testing

---

## Phase 1: Fallback Chain Execution (P2)

**Current state:** `src/core/llm.ts` parses `fallbackChain` from config but never executes it.

**Goal:** Implement actual fallback chain execution when the primary provider fails.

**Requirements:**
- If `generateText` throws, try the next provider in `fallbackChain`
- Each fallback attempt should use the same prompt/parameters
- After all fallbacks exhausted, throw a clear error listing all attempted providers
- Respect `--no-llm` flag (skip LLM entirely, use deterministic scoring only)
- Log fallback attempts to stderr (not stdout, to avoid breaking JSON output)

**Reference patterns:**
- Steel CLI: error classification (auth vs network vs API client vs API server)
- Hermes: error classifier pattern
- aicommits: graceful fallback when API unavailable

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `llm.test.ts` — mock primary failure, fallback succeeds
- New test: `llm.test.ts` — all fallbacks fail, throws clear error

---

## Phase 2: Parallel Deterministic Scoring (P2)

**Current state:** `analyzeCommits` in `src/core/analyzer.ts` processes commits sequentially.

**Goal:** Score commits in parallel using `Promise.all` or `Promise.allSettled`.

**Requirements:**
- Deterministic scoring (no LLM) is pure and side-effect-free — safe to parallelize
- LLM analysis should remain sequential to avoid rate limiting
- Progress bar should still work correctly with parallel execution
- Maintain deterministic output order (same as input order)

**Reference patterns:**
- Hermes: batch_runner.py for parallel processing
- Steel: sequential command execution (no parallel pattern — we innovate here)

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- `analyzer.test.ts` — batch test still passes with correct ordering

---

## Phase 3: `describe` Command (P2)

**Current state:** No `describe` command exists.

**Goal:** Implement a `describe` command that returns structured command introspection for AI agents.

**Requirements:**
- `commit-critic describe` returns JSON with:
  - Command tree (analyze, write, doctor, describe)
  - Available flags per command
  - Environment variables used
  - Example invocations
- `commit-critic describe --all` returns full tree recursively
- Output is always JSON (no rich text mode)
- Useful for AI agents that want to discover commit-critic's capabilities

**Reference patterns:**
- Steel CLI: `src/commands/describe.rs` — structured command introspection
- clipanion: command metadata introspection via `Cli` instance

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `e2e.test.ts` — `describe` returns valid JSON with expected keys

---

## Phase 4: Global `--json` Flag (P2)

**Current state:** `--json` is a per-command flag on `analyze` only.

**Goal:** Make `--json` a global flag that works on all commands.

**Requirements:**
- `commit-critic --json analyze` works
- `commit-critic --json doctor` works
- `commit-critic --json write` works (prints message as JSON)
- Global flag should be parsed before subcommand dispatch
- clipanion supports global flags via `@Option({global: true})` on the base command class

**Reference patterns:**
- Steel CLI: `#[arg(long, global = true)] pub json: bool` in the Cli struct
- clipanion docs: global options pattern

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `e2e.test.ts` — `--json` flag works with each command

---

## Phase 5: JSON Envelope Wrapping (P2)

**Current state:** `--json` outputs raw analysis results without metadata.

**Goal:** Wrap JSON output in a standard envelope with metadata.

**Requirements:**
- JSON envelope shape:
  ```json
  {
    "version": "1.0.0",
    "command": "analyze",
    "timestamp": "2026-05-21T12:00:00Z",
    "success": true,
    "data": { ... },
    "error": null,
    "meta": {
      "commitsAnalyzed": 5,
      "durationMs": 1234,
      "provider": "openai"
    }
  }
  ```
- On error, envelope contains `success: false` and `error` object with code, message, hint
- Error codes match centralized exit codes (`EXIT_AUTH_ERROR`, etc.)
- Backward compatible: raw data still accessible via a flag if needed

**Reference patterns:**
- Steel CLI: `output::success_data()` and JSON error output
- Hermes: structured response envelopes

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `output.test.ts` — envelope shape validation
- New test: `output.test.ts` — error envelope with code and hint

---

## Phase 6: Shell Completion (P2)

**Current state:** No shell completion support.

**Goal:** Generate shell completion scripts for bash, zsh, fish.

**Requirements:**
- `commit-critic completion bash` prints bash completion script
- `commit-critic completion zsh` prints zsh completion script
- `commit-critic completion fish` prints fish completion script
- clipanion may have built-in completion support (research needed)
- If clipanion doesn't support it, implement manual completion generation
- Completion should include commands, flags, and enum values (commit types)

**Reference patterns:**
- Steel CLI: `clap_complete` for shell completion generation
- Hermes: `hermes_cli/completion.py` for completion logic
- clipanion docs: check for completion plugin or pattern

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `e2e.test.ts` — completion script contains expected commands
- Manual test: `source <(commit-critic completion bash)` and tab-complete

---

## Phase 7: Project-Level Config File (P2)

**Current state:** Config is env vars + CLI flags only.

**Goal:** Support a project-level config file `.commit-critic.json`.

**Requirements:**
- Config resolution chain: CLI flag > env var > `.commit-critic.json` > `~/.commit-critic.json` > default
- Config file shape:
  ```json
  {
    "provider": "openai",
    "model": "gpt-4.1",
    "apiKey": "sk-...",
    "baseUrl": null,
    "fallbackChain": ["openrouter"],
    "defaultCount": 10,
    "noColor": false,
    "includeMerges": true
  }
  ```
- API key in config file should trigger a warning (prefer env var)
- Config file should be validated with Zod schema
- Atomic write pattern (write to temp, rename)

**Reference patterns:**
- Steel CLI: `src/config/settings.rs` — atomic config writes, resolution chain
- Hermes: `~/.hermes/config.yaml` pattern
- aicommits: `.aicommits` config file

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `config.test.ts` — config file resolution chain
- New test: `config.test.ts` — config file validation with Zod

---

## Phase 8: Structured Diff Parsing (P2)

**Current state:** Diff is treated as raw text with simple truncation.

**Goal:** Parse diff into structured format for better analysis.

**Requirements:**
- Parse `git diff` output into:
  - Files changed (path, additions, deletions)
  - Hunks (old start, new start, old lines, new lines)
  - Line types (added, removed, context)
- Use structured diff for:
  - Better commit message suggestions (know which files changed)
  - Token budget management (count tokens per file)
  - Scoring correlation (large diffs without body = penalty)
- Keep raw diff fallback for complex cases

**Reference patterns:**
- aicommits: diff truncation with notification
- git-ai-commit: diff parsing for scope detection
- commitlint: structured rule application

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `diff.test.ts` — parse diff into structured format
- New test: `diff.test.ts` — handle binary files, renames, mode changes

---

## Phase 9: Enhanced Doctor (P2)

**Current state:** Doctor checks git binary, repo detection, LLM config.

**Goal:** Add connectivity probes, version checks, and fix suggestions.

**Requirements:**
- Check git version (>= 2.20 recommended)
- Check Node.js/Bun version
- Check LLM provider connectivity (lightweight ping, not full API call)
- Check config file validity
- Check for updates (compare current version with latest npm version)
- Categorized checks: git, environment, LLM, config
- Each check: status (ok/warn/error), message, fix suggestion
- Overall status: ok if all checks pass, warn if any warnings, error if any errors

**Reference patterns:**
- Steel CLI: `src/commands/doctor.rs` — categorized checks with fix suggestions
- Hermes: health check patterns

**Verification:**
- `bun run typecheck` passes
- `bun test` passes
- New test: `doctor.test.ts` — doctor returns categorized checks
- New test: `doctor.test.ts` — doctor detects missing config

---

## Phase 10: Telemetry Evaluation (P2)

**Current state:** No telemetry.

**Goal:** Evaluate whether telemetry is needed and implement if yes.

**Requirements:**
- Research: Does a dev tool like commit-critic benefit from telemetry?
- If yes:
  - Anonymous usage tracking (command invoked, flags used, error rates)
  - Opt-out via `COMMIT_CRITIC_NO_TELEMETRY=1` or config
  - Batched events (queue and flush periodically, not per-command)
  - No PII, no commit messages, no diffs
  - Clear privacy policy in README
- If no: Document decision in `__reports__/research/10-telemetry-decision.md`

**Reference patterns:**
- Steel CLI: `src/telemetry.rs` — PostHog batched telemetry
- Hermes: telemetry patterns (if any)

**Verification:**
- Decision documented
- If implemented: `bun run typecheck` passes, tests pass

---

## Cross-Cutting Concerns

### Error Handling
- All new features must use centralized exit codes from `src/utils/exit-codes.ts`
- All errors must include a `Hint:` line suggesting recovery action
- Use `SilentExit` pattern (or TypeScript equivalent) for commands that print their own output

### Testing
- Every new feature gets at least one test
- Use `MockLanguageModelV4` from `ai/test` for LLM-related tests
- Use temp directories for file-system tests
- Use `Bun.spawn` for git operation tests (not JS git libraries)

### NO_COLOR Support
- All new UI features must respect `NO_COLOR` environment variable
- Use `noColor` helper from `src/utils/env.ts`

### JSON Mode
- All new features must work in `--json` mode
- Status/progress messages go to stderr
- Data output goes to stdout

---

## Verification Gates

After each phase, run:
```bash
bun install
bun run typecheck
bun test
bun run build
bun run compile:linux
```

Before every atomic commit:
```bash
bun run typecheck
bun test
bun run build
```

---

## Commit Strategy
- Create atomic local commits at phase boundaries
- Use conventional commit messages
- Do not push
- Do not commit secrets or internal reference mirrors

---

## Final Deliverables
- All phases implemented and verified
- Research artifacts in `__reports__/research/`
- Updated README with new features
- Updated `.env.example` with new config options
- Atomic local commits exist
- Final response includes: commands run, changed files, commit hashes, known deferrals, remaining risks
