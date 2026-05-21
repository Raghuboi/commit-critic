# Rust Ecosystem Research Report — Commit Critic CLI

> **Date:** May 20, 2026
> **Scope:** Evaluate Rust for the Commit Critic CLI tool — ecosystem, crates, architecture tradeoffs
> **Project:** AI Commit Message Critic (commit-critic)
> **Reference:** Steel CLI (Rust), Bun/TypeScript CLI (Bun research)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Steel CLI Rust Usage — Evidence-Based Analysis](#2-steel-cli-rust-usage--evidence-based-analysis)
3. [Rust CLI Ecosystem — Crate-by-Crate Assessment](#3-rust-cli-ecosystem--crate-by-crate-assessment)
4. [Architecture Comparison: Rust vs TypeScript vs Hybrid](#4-architecture-comparison-rust-vs-typescript-vs-hybrid)
5. [Learning Curve Risk Assessment](#5-learning-curve-risk-assessment)
6. [What Rust Genuinely Improves vs What It Does Not](#6-what-rust-genuinely-improves-vs-what-it-does-not)
7. [Rust Pros/Cons Matrix](#7-rustproscons-matrix)
8. [Recommendation](#8-recommendation)
9. [Source Citations](#9-source-citations)

---

## 1. Executive Summary

**Recommendation: TypeScript-first (Bun), NOT Rust. Confidence: 75%.**

Rust offers genuine advantages for CLI tools — sub-millisecond startup, tiny binaries, and excellent TUI support via ratatui. However, for Commit Critic specifically, these advantages are outweighed by:

1. **The team is much stronger in TypeScript** — the learning curve cost (2-4 months per developer) is a real productivity tax
2. **The AI/LLM integration layer is inherently TypeScript-friendly** — AI SDK v6, Zod schemas, and OpenAI-compatible providers are all native to the JS/TS ecosystem
3. **Commit Critic is I/O-bound, not CPU-bound** — it calls LLM APIs and reads git output. Rust's CPU speed advantage is irrelevant here
4. **Bun solves the distribution problem** — `bun build --compile` produces standalone binaries (20-30 MB) with zero runtime dependency
5. **The `git2` crate is problematic** — it adds ~1 MB of C code (libgit2 + libssh2 + OpenSSL), has known SSH/auth issues, and even major projects like `jj` are migrating away from it to subprocess shelling

The only area where Rust genuinely shines for this project is **TUI quality** (ratatui vs Ink). If Commit Critic evolves into a rich terminal dashboard with real-time updates, charts, and panes, ratatui would be superior. But for a prompt-based tool that reads commits, calls an API, and prints results, the TUI advantage is marginal.

---

## 2. Steel CLI Rust Usage — Evidence-Based Analysis

Steel CLI is a production Rust CLI (~11,000 LOC across 40+ files). Here's what we learned from examining its codebase:

### 2.1 Why Steel Uses Rust — Inferred from Evidence

| Reason | Evidence | Relevance to Commit Critic |
|--------|----------|---------------------------|
| **Single binary distribution** | Dual distribution: Rust binary via `cargo-dist` + npm wrapper that downloads the binary | Low — Bun `--compile` achieves the same |
| **Zero runtime dependency** | No Node.js required; binary runs standalone | Low — Bun compiled binaries also standalone |
| **Browser automation** | Custom `agent-browser` library for headless browser control | N/A — Commit Critic has no browser needs |
| **SQLite credential storage** | `rusqlite` with bundled SQLite for encrypted credential storage | Low — Commit Critic doesn't need credential storage |
| **Unix domain socket IPC** | Browser daemon communicates via Unix sockets | N/A — Commit Critic has no daemon |
| **HTTP API client** | `reqwest` with rustls for Steel API calls | Medium — Commit Critic needs HTTP for LLM APIs |
| **Structured output** | `--json` flag + auto-detection when piped | Medium — same pattern needed in TS |
| **Shell completions** | `clap_complete` generates bash/zsh/fish/powershell/elvish | Low — clipanion also generates completions |
| **Telemetry** | PostHog integration with batching | N/A — commercial product feature |

### 2.2 Steel's Architecture Patterns

Steel follows a clean pattern that could be replicated in TypeScript:

```
main.rs (10 lines) → Cli::parse() → commands::run(cli) → handle_error(e)
```

Key patterns worth adopting regardless of language:
- **Tiny entry point** — all logic in `lib.rs` / library code
- **`--json` global flag** with auto-detection when stdout is piped
- **Semantic exit codes** (auth=3, network=4, api_client=5, api_server=6)
- **Error hints** — every error includes a recovery suggestion
- **`SilentExit` sentinel** — commands that print their own output exit cleanly
- **Config cascade** — env var > CLI flag > config file > defaults
- **Atomic config writes** — write to `.tmp`, then `rename()`
- **`describe` command** — structured introspection for AI agents

### 2.3 Steel's Dependencies (for comparison)

```toml
# Core CLI
clap = { version = "4.5", features = ["derive"] }
clap_complete = "4.5"

# Async + HTTP
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "rustls-tls", "multipart"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"

# Error handling
anyhow = "1"
thiserror = "2"

# Interactive prompts
dialoguer = "0.12"

# Database
rusqlite = { version = "0.39", features = ["bundled"] }

# Crypto (for credential encryption)
aes = "0.8"
aes-gcm = "0.10"
pbkdf2 = "0.12"
sha2 = "0.10"
hmac = "0.12"

# Utilities
tempfile = "3"
dirs = "6"
url = "2"
base64 = "0.22"
parking_lot = "0.12"
jiff = "0.2"

# Browser engine (Steel-specific)
browser-engine = { git = "https://github.com/steel-dev/agent-browser" }
```

### 2.4 Steel's Build Profile

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

This produces a highly optimized binary. With LTO and stripping, Steel's binary is approximately 10-15 MB (estimated from similar Rust CLIs with comparable dependencies).

---

## 3. Rust CLI Ecosystem — Crate-by-Crate Assessment

### 3.1 clap (CLI Argument Parsing)

| Aspect | Details |
|--------|---------|
| **Version** | 4.5 (derive API) |
| **Downloads** | 200M+ total |
| **Role** | Industry-standard CLI argument parsing |
| **Strengths** | Compile-time validation via derive macros, auto `--help`, shell completion generation, subcommand hierarchies, env var binding, global flags |
| **Weaknesses** | Derive macros add compile time; steep learning curve for complex configurations |
| **TS Equivalent** | `clipanion` (Yarn Berry), `commander.js`, `yargs` |
| **Verdict** | Excellent, but clipanion covers 90% of use cases in TS |

### 3.2 ratatui (Terminal UI)

| Aspect | Details |
|--------|---------|
| **Version** | 0.30.0 (latest), widgets split to `ratatui-widgets` 0.3.0 |
| **Downloads** | 26.5M total, 9.6M in last 90 days |
| **Stars** | 20,318 on GitHub |
| **Role** | Widget-based TUI framework (fork of archived `tui-rs`) |
| **Backend** | `crossterm` (default), `termion`, `termwiz` |
| **Widgets** | Block, Paragraph, Table, List, Tabs, Chart, BarChart, Gauge, Sparkline, Calendar, Canvas |
| **Strengths** | Mature ecosystem, 3,768 reverse dependencies, active community (260 contributors), templates via `cargo-generate`, excellent examples |
| **Weaknesses** | Requires understanding of terminal rendering loop, manual event handling, no React-like declarative paradigm |
| **TS Equivalent** | `Ink` (React for terminals), `blessed` |
| **Verdict** | Best-in-class for Rust TUIs. Superior to Ink for complex dashboards, but Ink is more intuitive for React developers. For Commit Critic's prompt-based needs, neither is strictly necessary. |

### 3.3 crossterm (Terminal Backend)

| Aspect | Details |
|--------|---------|
| **Version** | 0.29.x |
| **Role** | Cross-platform terminal control (events, raw mode, colors, cursor) |
| **Strengths** | Works on Windows/macOS/Linux, no external dependencies, used by ratatui as default backend |
| **TS Equivalent** | Built into Node.js/Bun via `process.stdout` |
| **Verdict** | Only needed if building TUIs. Not relevant for simple CLI output. |

### 3.4 dialoguer vs inquire (Interactive Prompts)

| Feature | dialoguer | inquire |
|---------|-----------|---------|
| **Stars** | ~2.5K | ~5K |
| **Maintenance** | Slower releases | More active |
| **Password feedback** | No visual feedback | Real-time masked characters |
| **Calendar picker** | No | Yes (`DateSelect`) |
| **Autocomplete** | Basic | Built-in for `Text` prompts |
| **Custom types** | No | Yes (`CustomType`) |
| **Backend** | `console` crate | `crossterm` (default), `termion`, `console` |
| **Dependency count** | ~5 | ~10 |

**Industry trend:** Projects like Apollo Rover and Linebender are migrating from `dialoguer` to `inquire` for better UX.

**TS Equivalent:** `prompts`, `inquirer`, `@clack/prompts`

**Verdict:** `inquire` is the better Rust choice, but `prompts` in TypeScript is equally capable for Commit Critic's needs.

### 3.5 git2 (libgit2 Binding)

| Aspect | Details |
|--------|---------|
| **Version** | 0.20.4 (latest, Feb 2026) |
| **Downloads** | 78.7M total, 11.6M in last 90 days |
| **Reverse deps** | 1,524 crates |
| **Underlying** | libgit2 1.9.2 (C library) |
| **Strengths** | Thread-safe, memory-safe git operations, read/write support |
| **Weaknesses** | **Major:** SSH support is broken by default (requires libssh2 + OpenSSL), adds ~1 MB of C code, build failures on some platforms, version pinning issues |
| **Industry trend** | **jj (Jujutsu) is actively removing git2** in favor of shelling out to `git` subprocess + `gitoxide` for local operations. Reason: SSH auth failures, packaging problems, performance issues |
| **TS Equivalent** | `simple-git` (shells out to git), `isomorphic-git` (pure JS) |
| **Verdict** | **AVOID for Commit Critic.** Shelling out to `git` via `std::process::Command` (Rust) or `Bun.spawn` (TS) is simpler, more reliable, and avoids the C dependency. Even major Rust git tools are moving away from it. |

### 3.6 reqwest (HTTP Client)

| Aspect | Details |
|--------|---------|
| **Version** | 0.12.x |
| **Role** | Full-featured async HTTP client |
| **Features** | JSON, streaming, multipart, rustls/TLS, cookies, redirects |
| **Strengths** | Excellent async/await support, built on hyper, rustls by default (no OpenSSL) |
| **Weaknesses** | Pulls in significant dependencies (tokio, hyper, rustls) |
| **TS Equivalent** | `fetch` (built into Bun/Node), `undici` |
| **Verdict** | Excellent for Rust, but Bun's built-in `fetch` is simpler and covers all LLM API needs |

### 3.7 OpenAI-compatible clients (Rust)

| Crate | Version | Notes |
|-------|---------|-------|
| `async-openai` | 0.29.8 | Unofficial, comprehensive API coverage, SSE streaming |
| `async-openai-compat` | 0.29.8 | Fork of async-openai for OpenAI-compatible providers |
| `openai-client-base` | 0.12.0 | Auto-generated from OpenAPI spec, foundation for higher-level clients |
| `api_openai_compatible` | Latest | Provider-neutral OpenAI wire protocol |

**Verdict:** The Rust OpenAI client ecosystem exists but is fragmented and unofficial. The TypeScript AI SDK v6 (`@ai-sdk/openai`, `@ai-sdk/openai-compatible`) is far more mature, with structured output (Zod schemas), provider registry, middleware, and fallback support. This is a **significant advantage for TypeScript**.

### 3.8 serde + schemars (JSON/Schema)

| Aspect | Details |
|--------|---------|
| **serde** | Version 1.x, 400M+ downloads. The de facto serialization framework for Rust. |
| **schemars** | Version 1.2.1 (Feb 2026). Generates JSON Schema from Rust types via `#[derive(JsonSchema)]`. |
| **Strengths** | Zero-copy deserialization, full serde attribute compatibility, JSON Schema 2020-12 support |
| **TS Equivalent** | Built-in JSON.stringify/parse, `zod` for validation + schema generation |
| **Verdict** | serde is Rust's killer feature, but Zod in TypeScript provides equivalent validation + schema generation with less boilerplate. For LLM structured outputs, Zod is actually the better fit. |

### 3.9 tokio (Async Runtime)

| Aspect | Details |
|--------|---------|
| **Version** | 1.x |
| **Role** | Async runtime (multi-threaded or current-thread) |
| **Strengths** | Industry standard, powers most of Rust's async ecosystem |
| **Weaknesses** | `features = ["full"]` adds significant compile time and binary size; requires understanding of async/await in Rust context |
| **TS Equivalent** | Built into JS event loop (Bun/Node) |
| **Verdict** | Essential for Rust async, but JavaScript's native async/await is simpler and equally capable for I/O-bound workloads |

### 3.10 anyhow + thiserror (Error Handling)

| Crate | Role |
|-------|------|
| **anyhow** | Application-level error handling (`Result<(), anyhow::Error>`). Context chain via `.context()`. |
| **thiserror** | Custom error types with `#[derive(Error)]`. Structured error variants. |

**Pattern:** `thiserror` for domain errors (e.g., `ApiError`), `anyhow` for application-level convenience.

**TS Equivalent:** `Error` subclasses, `zod` error formatting, custom error classes.

**Verdict:** Rust's error handling is more explicit and compile-time enforced, but TypeScript's error handling is adequate for this use case.

### 3.11 tracing (Structured Logging)

| Aspect | Details |
|--------|---------|
| **Version** | 0.1.x |
| **Role** | Structured, scoped, async-aware diagnostics |
| **Strengths** | Zero-cost when disabled, works with tokio, multiple backends (console, JSON, OpenTelemetry) |
| **TS Equivalent** | `pino`, `winston`, `debug` |
| **Verdict** | Excellent for Rust, but `pino` in TypeScript is equally capable for CLI logging |

### 3.12 Testing: assert_cmd + insta + tempfile

| Crate | Role |
|-------|------|
| **assert_cmd** | CLI integration testing — runs the compiled binary and asserts on output/exit codes |
| **insta** | Snapshot testing — captures expected output and diffs on changes |
| **tempfile** | Temporary file/directory management for test isolation |

**TS Equivalent:** Bun's built-in test runner + `execa` for subprocess testing

**Verdict:** Rust's testing ecosystem is excellent, but Bun's test runner covers the same needs.

---

## 4. Architecture Comparison: Rust vs TypeScript vs Hybrid

### 4.1 Option A: Rust-Only

```
commit-critic (Rust binary)
├── clap (CLI parsing)
├── reqwest + async-openai-compat (LLM API calls)
├── serde + schemars (JSON/schema)
├── std::process::Command (git subprocess)
├── inquire (interactive prompts)
├── ratatui + crossterm (TUI, if needed)
├── tokio (async runtime)
├── anyhow + thiserror (error handling)
└── tracing (logging)
```

**Pros:**
- Sub-millisecond startup time
- ~5-10 MB binary (without git2)
- Zero runtime dependency
- Excellent TUI with ratatui
- Compile-time safety

**Cons:**
- No native AI SDK — must build LLM client from scratch or use fragmented unofficial crates
- No Zod equivalent for structured output validation (schemars generates schemas but doesn't validate at runtime the same way)
- Steep learning curve for TypeScript team
- Slower iteration cycle (Rust compile times: 10-60 seconds vs instant in TS)
- No React ecosystem for TUI (if ratatui is chosen)

### 4.2 Option B: TypeScript-Only (Bun)

```
commit-critic (Bun-compiled binary or npm package)
├── clipanion (CLI parsing)
├── AI SDK v6 (@ai-sdk/openai-compatible) (LLM API calls)
├── Zod (structured output validation)
├── Bun.spawn / Bun.$ (git subprocess)
├── prompts / @clack/prompts (interactive prompts)
├── picocolors (terminal colors)
├── fetch (built-in HTTP)
└── Bun test (testing)
```

**Pros:**
- Team's existing expertise — immediate productivity
- AI SDK v6 provides unified LLM interface with structured output, provider registry, middleware, fallbacks
- Zod schemas are the natural fit for LLM structured outputs
- Instant iteration (no compilation step during development)
- `bun build --compile` produces standalone binaries
- Rich ecosystem for CLI tools (clipanion, prompts, picocolors)
- OpenAI-compatible providers work out of the box

**Cons:**
- ~20-30 MB binary (Bun runtime bundled)
- ~50-100ms startup time (vs sub-ms for Rust)
- Requires Bun or Node.js for npm distribution
- GC overhead (negligible for I/O-bound workload)

### 4.3 Option C: Hybrid (Rust CLI shell + TypeScript AI core)

```
commit-critic (Rust binary)
├── clap (CLI parsing)
├── ratatui (TUI)
├── reqwest (HTTP client)
└── Calls external TypeScript service via HTTP
    └── TypeScript AI core (AI SDK v6 + Zod)
        └── Runs as local HTTP server or subprocess
```

**Pros:**
- Best of both worlds: Rust CLI/TUI + TypeScript AI layer
- Team works primarily in TypeScript

**Cons:**
- **Two processes to manage** — complexity of IPC
- **Two languages to maintain** — doubles the maintenance burden
- **Two build pipelines** — Rust + TypeScript CI
- **Two dependency trees** — security auditing doubles
- **Slower development** — changes in either layer require rebuilding both
- **No clear boundary** — where does the CLI end and the AI core begin?
- **Over-engineering** — adds complexity without proportional benefit

### 4.4 Architecture Comparison Matrix

| Factor | Rust-Only | TypeScript (Bun) | Hybrid |
|--------|-----------|-------------------|--------|
| **Team productivity** | Low (learning curve) | **High** (existing skills) | Medium (split focus) |
| **LLM integration** | Hard (fragmented crates) | **Easy** (AI SDK v6) | Medium (HTTP boundary) |
| **Structured output** | Manual (schemars + serde) | **Native** (Zod + AI SDK) | **Native** (TS side) |
| **Startup time** | **~1ms** | ~50-100ms | ~1ms (Rust shell) |
| **Binary size** | **~5-10 MB** | ~20-30 MB | ~5-10 MB |
| **Distribution** | **Single binary** | Single binary (Bun) or npm | Single binary + TS dep |
| **TUI quality** | **Excellent** (ratatui) | Good (Ink/prompts) | **Excellent** (ratatui) |
| **Git integration** | Subprocess (recommended) | **Subprocess** (Bun.spawn) | Subprocess |
| **Dev iteration speed** | Slow (10-60s compile) | **Instant** | Slow (dual builds) |
| **Maintenance burden** | Medium | **Low** | **High** |
| **Ecosystem maturity** | **Mature** (CLI crates) | **Mature** (AI + CLI) | Complex |

---

## 5. Learning Curve Risk Assessment

### 5.1 Rust Learning Curve for TypeScript Developers

Based on multiple sources (corrode.dev, byteiota.com, Bret Cameron's experience):

| Phase | Duration | What Happens |
|-------|----------|--------------|
| **Weeks 1-2** | Syntax & basics | Variables, types, ownership basics, borrowing |
| **Weeks 3-4** | **Borrow checker fights** | The hardest phase — lifetime errors, references vs ownership |
| **Month 2** | Memory model | Stack vs heap, `String` vs `&str`, `Box`, `Rc`, `Arc` |
| **Months 3-4** | Idiomatic comfort | Traits, generics, async/await in Rust context, ecosystem patterns |

**Key quote from corrode.dev:** "Most developers need 2-4 months to become comfortable with Rust's ownership model. They'll go through a phase of 'fighting the borrow checker' — this is normal and temporary."

**Key quote from Bret Cameron:** "Rust's initial learning curve seems steeper than other languages I have tried in recent years... you can only log values once the compiler is happy."

### 5.2 Specific Risks for This Team

1. **No Rust champion on the team** — Without someone who already knows Rust, the team will struggle with ownership/borrowing questions. Every blocker requires looking up documentation or asking AI, which slows progress significantly.

2. **Async Rust is harder than async TS** — Rust's async/await has additional complexity around `Send`/`Sync` bounds, lifetimes in async contexts, and the need to understand the tokio runtime. TypeScript's async/await is straightforward.

3. **Error handling mental model shift** — Moving from exceptions/promises to `Result<T, E>` and the `?` operator requires rewiring how the team thinks about error propagation.

4. **Compile-time feedback loop** — Rust's compile times (10-60 seconds for a medium project) mean the edit-compile-run cycle is significantly slower than TypeScript's instant execution.

5. **Ecosystem navigation** — Finding the right crate, understanding its API, and dealing with version conflicts is a skill that takes time to develop. In TypeScript, the team already knows how to navigate npm.

### 5.3 Mitigation Strategies (if Rust is chosen)

1. **Designate a Rust champion** — One team member invests 2-4 weeks to learn Rust first, then mentors others
2. **Start with synchronous code** — Avoid async initially; add tokio only when needed
3. **Use AI-assisted development** — Claude Code / Copilot can help with Rust patterns, but human review is essential
4. **Leverage established patterns** — Follow Steel CLI's architecture closely
5. **Accept slower initial velocity** — Plan for 50-70% productivity during the first month

---

## 6. What Rust Genuinely Improves vs What It Does Not

### 6.1 What Rust GENUINELY Improves

| Area | Improvement | Magnitude |
|------|-------------|-----------|
| **Startup time** | Sub-millisecond vs 50-100ms | **10-100x faster** |
| **Binary size** | 5-10 MB vs 20-30 MB | **2-3x smaller** |
| **Memory usage** | ~5 MB idle vs ~100 MB idle | **20x less memory** |
| **TUI quality** | ratatui widgets (charts, tables, gauges) vs Ink components | **Superior for complex dashboards** |
| **Compile-time safety** | Ownership/borrowing prevents memory bugs | **Eliminates entire class of bugs** |
| **Distribution** | Single static binary, no runtime needed | **Truly zero-dependency** |
| **Native feel** | Feels like a system tool (like `git`, `jq`) | **Better integration with shell ecosystem** |

### 6.2 What Rust Does NOT Improve (for this project)

| Area | Why It Doesn't Matter |
|------|----------------------|
| **CPU performance** | Commit Critic is I/O-bound (LLM API calls, git output). CPU speed is irrelevant. |
| **API call speed** | Network latency dominates. Rust's faster HTTP client saves milliseconds on requests that take seconds. |
| **JSON parsing** | serde is faster than JSON.parse, but JSON parsing is microseconds vs seconds of API latency. |
| **Git operations** | Shelling out to `git` subprocess is the same in both languages. `git2` crate adds complexity without benefit. |
| **Structured output** | Zod in TypeScript is actually BETTER for LLM structured outputs than schemars in Rust. |
| **Developer experience** | TypeScript's instant feedback, rich tooling, and AI SDK ecosystem provide a superior DX for this use case. |
| **Security** | Commit Critic doesn't handle sensitive data at a level where memory safety matters. LLM API keys are env vars in both cases. |
| **Concurrency** | Sequential LLM API calls don't benefit from Rust's fine-grained concurrency. |

### 6.3 The Real Question

The fundamental question is: **Does Commit Critic need to feel like `git` or `jq`, or does it need to feel like a developer tool?**

- If it needs to feel like a system utility (instant startup, tiny binary, zero dependencies), Rust wins.
- If it needs to be a practical developer tool that integrates with the AI ecosystem, TypeScript wins.

For a commit message critic, the latter is more important. Developers care about the quality of the AI analysis, not whether the CLI starts in 1ms or 50ms.

---

## 7. Rust Pros/Cons Matrix

### Pros

| # | Pro | Impact | Evidence |
|---|-----|--------|----------|
| 1 | Sub-millisecond startup | Medium | Steel CLI, benchmark data |
| 2 | Tiny binary (5-10 MB) | Medium | Rust compile profiles |
| 3 | Zero runtime dependency | Medium | Single static binary |
| 4 | ratatui TUI ecosystem | High (if TUI needed) | 20K+ stars, 26M downloads |
| 5 | Compile-time safety | Low (for this project) | Ownership/borrowing |
| 6 | Excellent CLI patterns | Medium | clap derive, Steel CLI patterns |
| 7 | Memory efficiency | Low (for this project) | ~5 MB vs ~100 MB idle |
| 8 | Native shell integration | Low | Feels like system tool |

### Cons

| # | Con | Impact | Evidence |
|---|-----|--------|----------|
| 1 | Steep learning curve (2-4 months) | **Critical** | corrode.dev, multiple sources |
| 2 | Slow compile times (10-60s) | **High** | Rust ecosystem consensus |
| 3 | No AI SDK equivalent | **Critical** | Fragmented unofficial crates vs AI SDK v6 |
| 4 | No Zod equivalent | **High** | schemars generates schemas but doesn't validate |
| 5 | git2 crate problems | **High** | SSH issues, C deps, jj removing it |
| 6 | Smaller ecosystem | Medium | 160K crates vs 3M npm packages |
| 7 | Harder to hire for | Medium | 2.27M Rust devs vs millions of TS devs |
| 8 | Async complexity | High | Send/Sync, lifetimes in async |
| 9 | No React-like TUI paradigm | Medium | ratatui is imperative, not declarative |
| 10 | Build tooling complexity | Medium | Cargo features, cross-compilation |

---

## 8. Recommendation

### 8.1 Primary Recommendation: TypeScript (Bun)

**Confidence: 75%**

Build Commit Critic in TypeScript using Bun as the runtime. This leverages the team's existing expertise, provides access to the AI SDK v6 ecosystem, and produces a functional CLI with minimal friction.

**Stack:**
- **Runtime:** Bun
- **CLI parsing:** clipanion
- **LLM integration:** AI SDK v6 (`@ai-sdk/openai-compatible`)
- **Structured output:** Zod + `Output.object()`
- **Git integration:** `Bun.spawn` / `Bun.$` (subprocess)
- **Interactive prompts:** `prompts` or `@clack/prompts`
- **Terminal colors:** `picocolors`
- **Distribution:** `bun build --compile` for standalone binaries + npm package

**Why this wins:**
1. The AI/LLM layer is the core differentiator of Commit Critic, and TypeScript's AI SDK v6 + Zod ecosystem is unmatched
2. The team can ship immediately without a learning curve
3. Bun's `--compile` flag solves the distribution problem
4. The 50-100ms startup time is imperceptible for an interactive developer tool
5. The 20-30 MB binary size is acceptable for a developer tool

### 8.2 When to Reconsider Rust

Revisit this decision if:
1. **Commit Critic evolves into a rich TUI dashboard** — real-time commit analytics, charts, multi-pane layouts. ratatui would be superior here.
2. **Startup time becomes a bottleneck** — if Commit Critic is called in pre-commit hooks and 50ms adds up across hundreds of invocations.
3. **The team gains Rust expertise** — if another project introduces Rust to the team, the learning curve cost drops to zero.
4. **Binary size matters for distribution** — if Commit Critic needs to be embedded in other tools or distributed in size-constrained environments.

### 8.3 Hybrid Approach: NOT Recommended

**Confidence: 90% against**

A hybrid architecture (Rust CLI shell + TypeScript AI core) adds complexity without proportional benefit. The IPC boundary between the two layers creates maintenance overhead, and the team would need to maintain two codebases, two build pipelines, and two dependency trees. The only scenario where this makes sense is if Commit Critic needs a Rust TUI (ratatui) but the AI logic must stay in TypeScript — but even then, Ink provides adequate TUI capabilities in TypeScript.

---

## 9. Source Citations

| # | Source | URL | Key Finding |
|---|--------|-----|-------------|
| 1 | Steel CLI Cargo.toml | `references/steel-cli/Cargo.toml` | Rust CLI dependency stack |
| 2 | Steel CLI main.rs | `references/steel-cli/src/main.rs` | 10-line entry point pattern |
| 3 | Steel CLI commands/mod.rs | `references/steel-cli/src/commands/mod.rs` | CLI architecture, subcommand dispatch |
| 4 | Steel CLI output.rs | `references/steel-cli/src/util/output.rs` | JSON/text output, error classification |
| 5 | Steel CLI auth.rs | `references/steel-cli/src/config/auth.rs` | Auth resolution chain |
| 6 | Modern Rust CLI Dev 2026 | techbytes.app | Clap v5, Tokio, serde patterns |
| 7 | CLI Architecture Patterns | wiki.charleschen.ai | Real-world Rust CLI patterns |
| 8 | AI CLI Tools Comparison | mer.vin/2025/12 | OpenAI switched to Rust, Claude stays TS |
| 9 | CLI Development Frameworks | devtoolsguide.com | Framework comparison matrix |
| 10 | Native TypeScript Performance | sebastian-staffa.eu | Bun vs Node.js benchmarks |
| 11 | OpenClaw vs ZeroClaw | kilo.ai | TS vs Rust agent comparison |
| 12 | git2-rs CHANGELOG | github.com/rust-lang/git2-rs | Recent fixes, version history |
| 13 | jj git2 deprecation | github.com/jj-vcs/jj/issues/5548 | jj removing git2 in favor of subprocess |
| 14 | cargo-generate git2 removal | github.com/cargo-generate/issues/67 | Shelling out to git vs libgit2 |
| 15 | dialoguer vs inquire | github.com/apollographql/rover/issues/2497 | Apollo Rover migrating to inquire |
| 16 | async-openai-compat | crates.io/crates/async-openai-compat | Rust OpenAI-compatible client |
| 17 | schemars | docs.rs/schemars | JSON Schema generation from Rust types |
| 18 | ratatui | github.com/ratatui/ratatui | 20K+ stars, 26M downloads |
| 19 | ratatui-widgets | crates.io/crates/ratatui-widgets | 4.4M downloads |
| 20 | Rust learning curve | corrode.dev/learn/migration-guides/typescript-to-rust | 2-4 months to proficiency |
| 21 | TypeScript vs Rust 2025 | byteiota.com | Ecosystem adoption analysis |
| 22 | TS to Rust experience | bretcameron.com/blog | Personal migration experience |
| 23 | TS to Rust migration | darrenholland.com/blog | API migration case study |
| 24 | AI-assisted TS to Rust | byteiota.com/typescript-to-rust-migration | 100k lines in 30 days with AI |
| 25 | git2 binary size impact | github.com/bgreenwell/lstr/pull/5 | git2 reduces binary from 4.3M to 3.6M |
| 26 | FrankenTUI vs Ratatui | docs.frankentui.com | TUI framework comparison |

---

## Appendix A: Recommended TypeScript Stack (if following recommendation)

```json
{
  "name": "commit-critic",
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build ./src/cli.ts --outdir ./dist --target=bun",
    "compile": "bun build ./src/cli.ts --compile --outfile ./dist/commit-critic --minify",
    "test": "bun test"
  },
  "dependencies": {
    "clipanion": "^4.0.0-rc.2",
    "@ai-sdk/openai-compatible": "^1.0.0",
    "ai": "^4.0.0",
    "zod": "^3.24.0",
    "prompts": "^2.4.2",
    "picocolors": "^1.1.1"
  }
}
```

## Appendix B: Recommended Rust Stack (if choosing Rust)

```toml
[package]
name = "commit-critic"
version = "0.1.0"
edition = "2024"

[dependencies]
clap = { version = "4.5", features = ["derive"] }
clap_complete = "4.5"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
thiserror = "2"
inquire = "0.8"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tempfile = "3"

# DO NOT use git2 — shell out to git instead
# For TUI (optional):
# ratatui = "0.29"
# crossterm = "0.28"

[dev-dependencies]
assert_cmd = "2"
insta = "1"
wiremock = "0.6"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```
