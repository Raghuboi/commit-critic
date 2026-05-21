# Steel CLI and Cookbook — Deep Research Report

Date: 2026-05-20

## Commit SHAs

| Repo | SHA |
|------|-----|
| steel-dev/cli | `f911b480a31d3ca234e311ee3ec78cce4748e05a` |
| steel-dev/steel-cookbook | `92f29742253e2b6c6801d109e18232768e5291a0` |

## 1. Architecture Summary

### Steel CLI — CLI, Not TUI

Steel CLI is a **traditional CLI** (command-line interface), not a TUI (terminal user interface). It uses a request-response model: each invocation parses args, runs a command, prints output, and exits. There are no persistent terminal layouts, no curses/panes, no interactive menus drawn in the terminal.

**Key architectural decisions:**

- **Language:** Rust, edition 2024
- **CLI framework:** `clap` with derive macros + `clap_complete` for shell completions
- **Async runtime:** `tokio` (full features)
- **Error handling:** `anyhow` for application-level errors, `thiserror` for custom domain errors (`ApiError`)
- **Serialization:** `serde` + `serde_json`
- **HTTP client:** `reqwest` with rustls
- **Interactive prompts:** `dialoguer` (used sparingly — mainly in `init` flow)
- **Database:** `rusqlite` (SQLite, bundled) for credentials storage
- **Browser engine:** Custom `agent-browser` library from a separate git repo
- **Config storage:** JSON file at `~/.config/steel/config.json`
- **IPC:** Unix domain sockets for daemon communication (browser sessions)
- **Telemetry:** PostHog via custom batched HTTP client
- **Packaging:** Dual distribution — Rust binary via `cargo-dist` + npm wrapper (`@steel-dev/cli`)

### Module Layout

```
src/
  main.rs           — 10-line entry point: parse -> run -> handle_error
  lib.rs            — module declarations only
  commands/
    mod.rs          — Cli struct, Command enum, run() dispatcher
    browser/        — Browser subcommands (start, stop, sessions, live, captcha, batch)
      action.rs     — 1400+ lines: all browser action subcommands (navigate, click, fill, etc.)
    scrape.rs       — Web scraping command
    screenshot.rs   — Screenshot command
    pdf.rs          — PDF generation command
    login.rs        — OAuth login with local TCP callback server
    logout.rs       — Logout command
    config.rs       — Show current config
    doctor.rs       — Environment health check
    describe.rs     — Structured command introspection (for AI agents)
    completion.rs   — Shell completion generation
    init/           — Onboarding flow
    dev/            — Local development runtime
    forge.rs        — Project scaffolding
    credentials/    — Credential management (CRUD)
    profile/        — Browser profile management
    settings.rs     — Settings management
    update.rs       — Self-update
    cache.rs        — Cache management
  api/
    client.rs       — SteelClient: authenticated HTTP requests
    session.rs      — Session API operations
    top_level.rs    — Top-level API operations
  browser/
    daemon/         — Browser daemon IPC (client, server, protocol, process)
    engine.rs       — Browser engine abstraction
    lifecycle.rs    — Browser lifecycle management
    passthrough.rs  — Request passthrough
    profile_porter.rs / profile_store.rs — Profile import/export
    routing.rs      — Request routing
    runtime.rs      — Runtime abstraction
  config/
    mod.rs          — Config directory resolution
    auth.rs         — Auth resolution (env var > config file)
    settings.rs     — Config struct, API mode resolution
  telemetry.rs      — PostHog telemetry with batching
  util/
    api.rs          — Global API context (OnceLock pattern)
    output.rs       — JSON/text output mode, error classification, exit codes
    url.rs          — URL normalization with https fallback
```

### Steel Cookbook

A documentation/recipe collection (not a code repo). Contains:
- `registry.yaml` — Structured metadata for all examples (title, slug, path, description, authors, language, topics, dates)
- `authors.yaml` — Author metadata
- `CONTRIBUTING.md` — Strict writing guidelines
- `AGENTS.md` — AI agent contributor guide
- `README.md` — Public-facing catalog with language-specific indexes

## 2. CLI vs TUI — UX Patterns

Steel CLI is **definitively a CLI**, not a TUI. Evidence:

1. **No terminal UI library** — No `crossterm`, `ratatui`, `tui-rs`, or similar in dependencies
2. **Request-response model** — Each command invocation is a discrete operation: parse args, execute, output, exit
3. **Status messages to stderr** — Uses a `status!` macro that prints to stderr only in non-JSON mode
4. **JSON mode** — `--json` flag switches all output to structured JSON for programmatic consumption
5. **Auto-detection** — When stdout is piped (non-TTY), automatically switches to JSON mode
6. **Minimal interactivity** — `dialoguer` used only in the `init` onboarding flow for human prompts
7. **Doctor command** — Uses colored ANSI symbols (checkmarks, crosses) for health checks, but this is still CLI output, not a TUI

### UX Patterns Used

- **`--json` global flag** — Structured output for automation
- **Auto-JSON on pipe** — Detects `stdout().is_terminal()` and enables JSON mode when piped
- **`NO_COLOR` env var** — Respects the no-color standard
- **`STEEL_FORCE_TTY`** — Override auto-detection
- **Status messages to stderr** — Separates machine-readable stdout from human-readable stderr
- **Color-coded doctor output** — Green checkmarks, yellow warnings, red failures
- **SilentExit sentinel** — Commands that already printed their own output use a sentinel error to exit with a code without double-printing
- **Command aliases** — `login`/`auth`, `navigate`/`open`/`goto`, `close`/`quit`/`exit`
- **Flattened subcommands** — Browser actions (click, fill, snapshot) are flattened under `steel browser` rather than nested deeper
- **`--all` flag for tree dump** — `describe` command supports recursive tree output
- **`describe` command** — Structured introspection for AI agents (returns command tree as JSON)

## 3. Command Patterns

### Global Flags Pattern

```rust
// steel-cli@f911b48:src/commands/mod.rs:216-244
#[derive(Parser)]
#[command(name = "steel", version, about = "...", after_long_help = LONG_HELP)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
    #[arg(long, global = true)]
    pub json: bool,
    #[arg(long, global = true)]
    pub local: bool,
    #[arg(long, global = true)]
    pub api_url: Option<String>,
}
```

Global flags (`--json`, `--local`, `--api-url`) apply to all subcommands.

### Subcommand Hierarchy

```
steel
  └── Command enum (clap Subcommand)
        ├── Scrape, Screenshot, Pdf (leaf commands)
        ├── Browser (nested subcommands)
        │     ├── Start, Stop, Sessions, Live
        │     ├── Captcha { Solve, Status }
        │     └── Action (flattened: Navigate, Click, Fill, Snapshot, etc.)
        ├── Credentials { List, Create, Update, Delete }
        ├── Dev { Install, Start, Stop }
        └── Profile { List, Import, Sync, Delete }
```

### Command Runner Pattern

Each command module exports a `run(args: Args) -> anyhow::Result<()>` function:

```rust
// steel-cli@f911b48:src/commands/scrape.rs:38-74
pub async fn run(args: Args) -> anyhow::Result<()> {
    let url = resolve_tool_url(args.url.as_deref())?;
    let (mode, base_url, auth) = api::resolve_with_auth();
    let client = SteelClient::new()?;
    let response = client.scrape(...).await?;
    if output::is_json() {
        output::success_data(response);
    } else {
        // human-readable output
    }
    Ok(())
}
```

### Telemetry Integration

Every command is wrapped with telemetry tracking:

```rust
// steel-cli@f911b48:src/commands/mod.rs:342-395
pub async fn run(cli: Cli) -> anyhow::Result<()> {
    let telemetry_context = telemetry_command_path(&cli.command)
        .map(|path| crate::telemetry::command_context(&path));
    // ... init output, api, telemetry ...
    if let Some(ref context) = telemetry_context {
        crate::telemetry::track_command_started(context);
    }
    let started_at = std::time::Instant::now();
    let result = match cli.command { ... };
    if let Some(ref context) = telemetry_context {
        let duration = started_at.elapsed();
        match &result {
            Ok(()) => crate::telemetry::track_command_completed(context, duration),
            Err(err) => crate::telemetry::track_command_failed(context, duration, err),
        }
    }
    crate::telemetry::flush_best_effort().await;
    result
}
```

## 4. Error Handling

### Two-Tier Error System

1. **Domain errors** (`thiserror`) — Custom error types with structured variants:

```rust
// steel-cli@f911b48:src/api/client.rs:10-32
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum ApiError {
    #[error("Missing Steel API key. Run `steel login` or set `STEEL_API_KEY`.")]
    MissingAuth,
    #[error("Failed to reach Steel API at {url}.")]
    Unreachable { url: String, #[source] source: reqwest::Error },
    #[error("Steel API request failed ({status}): {message}")]
    RequestFailed { status: u16, message: Cow<'static, str>, body: Option<Value> },
    #[error(transparent)]
    Other(#[from] reqwest::Error),
}
```

2. **Application errors** (`anyhow`) — Used throughout command handlers for convenience:

```rust
// steel-cli@f911b48:src/util/url.rs:53-67
pub fn resolve_tool_url(url_arg: Option<&str>) -> anyhow::Result<String> {
    let candidate = url_arg
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow::anyhow!("Missing URL. Provide a target URL as the first argument."))?;
    let normalized = normalize_url(candidate);
    Url::parse(&normalized).map_err(|_| anyhow::anyhow!("Invalid URL: {candidate}"))?;
    Ok(normalized)
}
```

### Error Classification and Exit Codes

```rust
// steel-cli@f911b48:src/util/output.rs:64-70
pub mod exit_code {
    pub const GENERAL: i32 = 1;
    pub const AUTH: i32 = 3;
    pub const NETWORK: i32 = 4;
    pub const API_CLIENT: i32 = 5;
    pub const API_SERVER: i32 = 6;
}
```

Errors are classified by type, mapped to semantic exit codes, and include hints for recovery:

```rust
// steel-cli@f911b48:src/util/output.rs:186-213
pub fn handle_error(err: &anyhow::Error) -> ! {
    if let Some(SilentExit(code)) = err.downcast_ref::<SilentExit>() {
        std::process::exit(*code);
    }
    let (code, error_code, hint) = classify_error(err);
    let msg = format!("{err:#}");
    if is_json() {
        // JSON error output with error_code and hint fields
    } else {
        eprintln!("Error: {msg}");
        if let Some(h) = hint {
            eprintln!("Hint: {h}");
        }
    }
    std::process::exit(code);
}
```

### SilentExit Sentinel

Commands that already printed their own output use `SilentExit` to avoid double-printing:

```rust
// steel-cli@f911b48:src/util/output.rs:72-84
pub struct SilentExit(pub i32);
impl std::fmt::Display for SilentExit { ... }
impl std::error::Error for SilentExit {}
```

## 5. Config/Env Handling

### Auth Resolution Chain

```rust
// steel-cli@f911b48:src/config/auth.rs:32-59
pub fn resolve_auth_with(env_api_key: Option<&str>, config_api_key: Option<&str>) -> Auth {
    // 1. STEEL_API_KEY env var
    if let Some(key) = env_api_key { ... return Auth { source: AuthSource::Env } }
    // 2. config.json apiKey
    if let Some(key) = config_api_key { ... return Auth { source: AuthSource::Config } }
    Auth { api_key: None, source: AuthSource::None }
}
```

### API URL Resolution Chain

```rust
// steel-cli@f911b48:src/config/settings.rs:29-65
pub fn resolve_base_url(&self, explicit_url, env_vars, local_config_url) -> String {
    // Priority: explicit --api-url > env var > config > default
}
```

### Config Directory

```rust
// steel-cli@f911b48:src/config/mod.rs:15-26
pub fn config_dir_with(env_val: Option<&str>) -> PathBuf {
    // STEEL_CONFIG_DIR env var -> ~/.config/steel
}
```

### Atomic Config Writes

```rust
// steel-cli@f911b48:src/config/settings.rs:158-177
pub fn write_config_to(path: &Path, config: &Config) -> Result<()> {
    // Write to .json.tmp, then rename (atomic on Unix)
    // Set dir permissions to 0o700, file to 0o600
}
```

### Global Context Pattern (OnceLock)

```rust
// steel-cli@f911b48:src/util/api.rs:12-19
static LOCAL: AtomicBool = AtomicBool::new(false);
static API_URL: OnceLock<Option<String>> = OnceLock::new();
pub fn init(local: bool, api_url: Option<String>) { ... }
```

Called once at startup, then resolved lazily by command handlers.

## 6. Test Strategy

### Three-Layer Testing

1. **Unit tests** — Inline `#[cfg(test)] mod tests` in every source file
2. **Property-based tests** — Using `proptest` + `proptest-derive` for protocol messages
3. **Black-box integration tests** — `tests/cli_blackbox.rs` exercises the compiled binary via `std::process::Command`

### Test Patterns

- **Per-test temp directories** — `STEEL_CONFIG_DIR` set to `tempfile::tempdir()` in black-box tests
- **Mock servers** — `wiremock` for API client tests
- **Env var serialization** — `std::sync::Mutex<()>` guard for tests that mutate env vars
- **Property-based testing** — `#[cfg_attr(test, derive(proptest_derive::Arbitrary))]` on protocol structs
- **Serialization roundtrip tests** — Verify JSON serialization/deserialization preserves data
- **Help text verification** — Tests verify that `--help` output contains expected flags/subcommands

### Test File Names

```
tests/
  cli_blackbox.rs        — Binary-level integration tests
  output_parity.rs       — Output format consistency
  browser_flag_parity.rs — Flag consistency checks
  cli-spec.json          — Command tree spec (used for testing)
  cli_compat.rs          — CLI compatibility tests
  dev_command.rs         — Dev command tests
  action_coverage.rs     — Action command coverage
  native_api_coverage.rs — Native API coverage
  lifecycle_contract.rs  — Lifecycle contract tests
```

## 7. Packaging and Distribution

### Dual Distribution

1. **Rust binary** — Built via `cargo-dist` with targets:
   - `aarch64-apple-darwin`, `x86_64-apple-darwin`
   - `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`
   - Install path: `~/.steel/bin`
   - Archive format: `.tar.gz`

2. **npm wrapper** — `@steel-dev/cli` package:
   - `bin/steel.js` — JS wrapper script
   - `scripts/postinstall.js` — Downloads native binary on `npm install`
   - Allows `npm install -g @steel-dev/cli`

### Install Script

```bash
# steel-cli@f911b48:install.sh:1-260
# Portable POSIX shell script with:
# - TTY detection for interactive vs non-interactive mode
# - Old Node.js CLI detection and removal
# - Shell completion auto-installation (bash/zsh/fish)
# - PATH management in shell rc files
```

### Release Process

- **cargo-dist** for binary releases
- **cargo-cliff** for changelog generation from conventional commits
- **cargo-deny** for license and security auditing
- **typos** for spell checking
- **GitHub Actions** for CI (with dependabot)

## 8. Coding Conventions to Imitate

### DO Copy

1. **Tiny `main.rs`** — 10 lines: parse -> run -> handle_error. All logic in `lib.rs`.

2. **`--json` global flag + auto-detection** — Rich terminal output by default, JSON when piped or `--json` passed.

3. **Semantic exit codes** — Different codes for auth, network, API client, API server errors.

4. **Error hints** — Every error includes a `Hint:` line suggesting recovery action.

5. **`SilentExit` sentinel** — Commands that print their own output use a sentinel to exit cleanly.

6. **Global context via `OnceLock`/`AtomicBool`** — Set once at startup, read lazily.

7. **`status!` macro** — Status messages to stderr, suppressed in JSON mode.

8. **Config atomic writes** — Write to `.tmp`, then `rename()`. Set restrictive permissions.

9. **Auth resolution chain** — Env var > config file > none, with source tracking.

10. **`describe` command** — Structured command introspection for AI agents.

11. **`doctor` command** — Health check with categorized checks, fix suggestions, and overall status.

12. **Command aliases** — Common alternatives (`navigate`/`open`/`goto`).

13. **Flattened subcommands** — Keep command depth shallow for discoverability.

14. **Comprehensive `--help`** — `after_long_help` with categorized examples.

15. **Shell completion** — `clap_complete` for bash/zsh/fish/powershell/elvish.

16. **Black-box tests** — Test the compiled binary, not just library code.

17. **Property-based testing** — `proptest` for protocol message validation.

18. **Conventional commits** — `cargo-cliff` for changelog generation.

19. **`cargo-deny`** — License and security auditing.

20. **`typos`** — Spell checking in CI.

21. **`clippy` lints** — Strict clippy configuration with `nursery` warnings.

22. **`unsafe_code = "deny"`** — Deny unsafe code by default, opt-in with `#[allow(unsafe_code)]`.

23. **Telemetry with opt-out** — Anonymous usage tracking with clear opt-out mechanism.

24. **Telemetry batching** — Events queued and flushed periodically, not sent immediately.

25. **Test isolation** — Per-test temp directories, env var guards, mock servers.

### DO NOT Copy

1. **PostHog telemetry** — Steel is a commercial product; your tool may not need or want telemetry.

2. **Browser daemon architecture** — Steel's daemon model is complex and specific to browser automation.

3. **npm wrapper distribution** — Only relevant if distributing via npm.

4. **OAuth login flow** — Steel's login involves browser-based OAuth with a local TCP callback server.

5. **`dialoguer` interactive prompts** — Steel uses these minimally; your tool may need more or less interactivity.

6. **`agent-browser` dependency** — This is Steel's proprietary browser engine.

7. **Cookie/credential storage** — SQLite-based credential management is specific to browser automation.

8. **Cookbook structure** — Steel's cookbook is a documentation collection, not a code project.

9. **Install script complexity** — Steel's install.sh handles old Node.js CLI migration, shell completion, and PATH management.

10. **`cliff.toml` changelog config** — Steel uses `cargo-cliff` which is Rust-specific.

## 9. Evidence Table

| Finding | Citation |
|---------|----------|
| Rust edition 2024 | `steel-cli@f911b48:Cargo.toml:4` |
| clap derive + clap_complete | `steel-cli@f911b48:Cargo.toml:18-19` |
| tokio async runtime | `steel-cli@f911b48:Cargo.toml:23` |
| anyhow + thiserror error handling | `steel-cli@f911b48:Cargo.toml:24,26` |
| dialoguer for interactive prompts | `steel-cli@f911b48:Cargo.toml:29` |
| rusqlite for credentials | `steel-cli@f911b48:Cargo.toml:32` |
| serde + serde_json | `steel-cli@f911b48:Cargo.toml:21-22` |
| reqwest with rustls | `steel-cli@f911b48:Cargo.toml:20` |
| agent-browser dependency | `steel-cli@f911b48:Cargo.toml:42` |
| main.rs entry point (10 lines) | `steel-cli@f911b48:src/main.rs:1-10` |
| lib.rs module declarations | `steel-cli@f911b48:src/lib.rs:1-8` |
| Cli struct with global flags | `steel-cli@f911b48:src/commands/mod.rs:216-244` |
| Command enum with subcommands | `steel-cli@f911b48:src/commands/mod.rs:246-315` |
| LONG_HELP constant (after_long_help) | `steel-cli@f911b48:src/commands/mod.rs:21-214` |
| Command runner with telemetry | `steel-cli@f911b48:src/commands/mod.rs:342-395` |
| JSON/text output mode | `steel-cli@f911b48:src/util/output.rs:19-29` |
| Auto-JSON on pipe detection | `steel-cli@f911b48:src/util/output.rs:20-28` |
| NO_COLOR support | `steel-cli@f911b48:src/util/output.rs:25` |
| STEEL_FORCE_TTY override | `steel-cli@f911b48:src/util/output.rs:21-22` |
| status! macro (stderr, JSON-aware) | `steel-cli@f911b48:src/util/output.rs:54-60` |
| Semantic exit codes | `steel-cli@f911b48:src/util/output.rs:64-70` |
| SilentExit sentinel | `steel-cli@f911b48:src/util/output.rs:72-84` |
| Error classification with hints | `steel-cli@f911b48:src/util/output.rs:186-257` |
| JSON error output format | `steel-cli@f911b48:src/util/output.rs:195-204` |
| Text error output with hints | `steel-cli@f911b48:src/util/output.rs:205-210` |
| ApiError domain types | `steel-cli@f911b48:src/api/client.rs:10-32` |
| SteelClient HTTP client | `steel-cli@f911b48:src/api/client.rs:68-136` |
| Auth resolution chain | `steel-cli@f911b48:src/config/auth.rs:32-59` |
| AuthSource enum (Env/Config/None) | `steel-cli@f911b48:src/config/auth.rs:5-10` |
| API mode resolution | `steel-cli@f911b48:src/config/settings.rs:29-78` |
| EnvVars injectable for testing | `steel-cli@f911b48:src/config/settings.rs:81-96` |
| Config struct with serde | `steel-cli@f911b48:src/config/settings.rs:102-129` |
| Atomic config writes | `steel-cli@f911b48:src/config/settings.rs:158-177` |
| Config directory resolution | `steel-cli@f911b48:src/config/mod.rs:15-30` |
| Global API context (OnceLock) | `steel-cli@f911b48:src/util/api.rs:12-19` |
| API resolve_with_auth | `steel-cli@f911b48:src/util/api.rs:45-49` |
| URL normalization | `steel-cli@f911b48:src/util/url.rs:38-49` |
| resolve_tool_url with validation | `steel-cli@f911b48:src/util/url.rs:53-67` |
| Browser action subcommands (flattened) | `steel-cli@f911b48:src/commands/browser/action.rs:25-162` |
| Command aliases | `steel-cli@f911b48:src/commands/browser/action.rs:29,50,160` |
| describe command for AI agents | `steel-cli@f911b48:src/commands/describe.rs:1-334` |
| describe --all recursive tree | `steel-cli@f911b48:src/commands/describe.rs:170-202` |
| doctor command health checks | `steel-cli@f911b48:src/commands/doctor.rs:1-436` |
| doctor color-coded output | `steel-cli@f911b48:src/commands/doctor.rs:326-359` |
| login OAuth flow | `steel-cli@f911b48:src/commands/login.rs:1-291` |
| completion command | `steel-cli@f911b48:src/commands/completion.rs:1-62` |
| Telemetry module | `steel-cli@f911b48:src/telemetry.rs:1-500` |
| Telemetry batching | `steel-cli@f911b48:src/telemetry.rs:277-310` |
| Telemetry opt-out | `steel-cli@f911b48:src/telemetry.rs:73-96` |
| Daemon IPC via Unix sockets | `steel-cli@f911b48:src/browser/daemon/process.rs:49-51` |
| Daemon spawn with env var params | `steel-cli@f911b48:src/browser/daemon/process.rs:95-119` |
| Daemon protocol (tagged enum) | `steel-cli@f911b48:src/browser/daemon/protocol.rs:72-313` |
| proptest for protocol messages | `steel-cli@f911b48:src/browser/daemon/protocol.rs:66,73` |
| Black-box integration tests | `steel-cli@f911b48:tests/cli_blackbox.rs:1-450` |
| Per-test temp dirs | `steel-cli@f911b48:tests/cli_blackbox.rs:16-24` |
| wiremock for API tests | `steel-cli@f911b48:tests/cli_blackbox.rs:1-6` |
| cargo-dist config | `steel-cli@f911b48:dist-workspace.toml:1-28` |
| Release targets | `steel-cli@f911b48:dist-workspace.toml:15` |
| cargo-cliff changelog | `steel-cli@f911b48:cliff.toml:1-46` |
| Conventional commits | `steel-cli@f911b48:cliff.toml:26-42` |
| cargo-deny security audit | `steel-cli@f911b48:deny.toml:1-41` |
| License allowlist | `steel-cli@f911b48:deny.toml:16-28` |
| clippy lints | `steel-cli@f911b48:Cargo.toml:61-68` |
| unsafe_code deny | `steel-cli@f911b48:Cargo.toml:59` |
| Release profile (LTO, strip) | `steel-cli@f911b48:Cargo.toml:70-80` |
| npm wrapper package.json | `steel-cli@f911b48:package.json:1-21` |
| install.sh script | `steel-cli@f911b48:install.sh:1-260` |
| Shell completion auto-install | `steel-cli@f911b48:install.sh:156-220` |
| Cookbook registry.yaml | `steel-cookbook@92f2974:registry.yaml:1-431` |
| Cookbook CONTRIBUTING.md | `steel-cookbook@92f2974:CONTRIBUTING.md:1-105` |
| Cookbook AGENTS.md | `steel-cookbook@92f2974:AGENTS.md:1-80` |
| Cookbook voice/style rules | `steel-cookbook@92f2974:CONTRIBUTING.md:37-81` |
| Cookbook writing rules (no em-dashes, no pitch openers) | `steel-cookbook@92f2974:CONTRIBUTING.md:60-79` |

## 10. Relevance to Commit Critic

### What to Adopt

1. **Clap derive macros** — The same pattern works perfectly for our `--analyze`, `--analyze --url`, and `--write` modes.

2. **`--json` global flag** — Directly applicable. Rich terminal by default, JSON as option.

3. **Semantic exit codes** — Use different codes for different failure modes (auth, network, analysis errors).

4. **Error hints** — Every error should suggest what to do next.

5. **`status!` macro** — Status messages to stderr, suppressed in JSON mode.

6. **Doctor command pattern** — Could adapt as a `--health` or `--check` mode.

7. **Conventional commits enforcement** — Steel uses `cargo-cliff` with conventional commit parsers. We can use the same pattern for our commit message validation.

8. **Test strategy** — Unit tests inline, property-based tests for validators, black-box tests for the binary.

9. **Config resolution** — Env var > config file > defaults, with source tracking.

10. **Atomic file writes** — Write to `.tmp`, then rename.

### Rust vs TypeScript Consideration

Steel CLI proves that Rust is an excellent choice for CLI tools:
- **Single binary** — No runtime dependency (unlike Node.js)
- **Fast startup** — No VMS warmup
- **Memory efficient** — Critical for tools that may run in CI/CD
- **Type safety** — Compile-time validation of command structure
- **Ecosystem** — `clap`, `anyhow`, `thiserror`, `serde` are mature and well-documented

However, the team is TypeScript-strong, and the Steel CLI codebase is ~10K lines of Rust. A TypeScript equivalent using `commander.js` or `yargs` would be significantly faster to develop. The key question is whether the performance/dependency benefits of Rust outweigh the development speed of TypeScript for this specific use case.

### Key Takeaway

Steel CLI is an excellent reference for CLI architecture, error handling, output formatting, and test strategy. Its patterns around `--json` mode, semantic exit codes, error hints, and black-box testing are directly applicable to Commit Critic regardless of the language choice.
