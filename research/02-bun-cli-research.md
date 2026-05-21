# Bun TypeScript CLI Research Report

**Project:** Commit Critic -- AI Commit Message Critic
**Date:** May 20, 2026
**Author:** Hermes Agent (research subagent)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Bun Built-in CLI Capabilities](#2-bun-built-in-cli-capabilities)
3. [CLI Argument Parsing: Built-in vs External](#3-cli-argument-parsing-built-in-vs-external)
4. [Terminal UX Libraries](#4-terminal-ux-libraries)
5. [Bun Runtime APIs for CLI Development](#5-bun-runtime-apis-for-cli-development)
6. [Executable Packaging Plan](#6-executable-packaging-plan)
7. [Recommended Project Structure](#7-recommended-project-structure)
8. [Dependency Shortlist](#8-dependency-shortlist)
9. [Risks and Workarounds](#9-risks-and-workarounds)
10. [Source Citations](#10-source-citations)

---

## 1. Executive Summary

Bun is well-suited for building the Commit Critic CLI. Its built-in capabilities (TypeScript support, `Bun.argv`, `util.parseArgs`, `Bun.spawn`, `Bun.file`, built-in test runner, and `bun build --compile` for standalone executables) cover most needs without external dependencies.

**Key recommendations:**

- **CLI parsing:** Use `clipanion` for type-safe, zero-dependency argument parsing with subcommands (`--analyze`, `--write`). It powers Yarn Berry and infers types from option declarations.
- **Terminal colors:** Use `picocolors` (0.3 KB gzipped, 14x smaller than chalk, 2x faster). Used by PostCSS, SVGO, Babel.
- **Interactive prompts:** Use `prompts` for the `--write` interactive mode. Lightweight, Promise-based, well-maintained.
- **Terminal UI:** Do NOT use Ink or blessed. The commit critic needs a simple prompt-based interface, not a full-screen TUI. The React overhead of Ink is unjustified for this use case.
- **Executable packaging:** Use `bun build --compile` for standalone binaries. Cross-compile to Linux x64, macOS arm64, Windows x64 via CI.
- **npm distribution:** Dual-publish via `package.json#bin` (for `bunx commit-critic`) AND standalone binaries (for GitHub Releases).

**Total estimated dependencies: 3** (clipanion, picocolors, prompts)

---

## 2. Bun Built-in CLI Capabilities

### 2.1 TypeScript Execution

Bun runs TypeScript natively with zero configuration -- no `tsc` or transpilation step needed during development.

```bash
bun run src/cli.ts --analyze
```

### 2.2 Command-line Arguments

Bun exposes `Bun.argv` (alias of `process.argv`):

```ts
console.log(Bun.argv);
// [ '/path/to/bun', '/path/to/cli.ts', '--flag1', '--flag2', 'value' ]
```

### 2.3 Built-in Argument Parsing

Bun supports Node.js's `util.parseArgs` (built into Bun's runtime):

```ts
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    analyze: { type: "boolean" },
    url: { type: "string" },
    json: { type: "boolean" },
  },
  strict: true,
  allowPositionals: true,
});
```

**Limitations of `util.parseArgs`:**
- No subcommand support (e.g., `commit-critic analyze` vs `commit-critic write`)
- No auto-generated `--help` output
- No type inference -- all values are `string | boolean | undefined`
- No validation beyond type checking
- No default values handling for complex scenarios
- No mutual exclusion of flags

### 2.4 Environment Variables

Bun reads `.env` files automatically (`.env`, `.env.local`, `.env.production` etc.). Access via `process.env`, `Bun.env`, or `import.meta.env` (all aliases). TypeScript augmentation is supported:

```ts
declare module "bun" {
  interface Env {
    OPENAI_API_KEY: string;
    OPENAI_BASE_URL: string;
  }
}
```

### 2.5 Test Runner

Bun includes a Jest-compatible test runner:

```bash
bun test
```

- Supports TypeScript natively
- File patterns: `*.test.ts`, `*.spec.ts`
- `--watch` mode, `--test-name-pattern` filtering
- JUnit XML output for CI
- GitHub Actions annotations out of the box

### 2.6 Shebang Support

```ts
#!/usr/bin/env bun
// cli.ts content
```

Bun respects shebangs. When used with `package.json#bin`, the shebang `#!/usr/bin/env bun` ensures Bun runs the script even when invoked via `bunx`.

---

## 3. CLI Argument Parsing: Built-in vs External

### 3.1 Comparison Matrix

| Feature | `util.parseArgs` (built-in) | `clipanion` | `commander.js` | `yargs` | `meow` | `arg` |
|---------|----------------------------|-------------|----------------|---------|--------|-------|
| Zero deps | Yes | Yes | No (1 dep) | No (many) | No (2) | Yes |
| Type inference | None | Full (TS) | Partial | None | Partial | Manual |
| Subcommands | No | Yes | Yes | Yes | No | No |
| Auto --help | No | Yes | Yes | Yes | Yes | No |
| Auto --version | No | Yes | Yes | Yes | Yes | No |
| Validation | Basic | Via Typanion | Manual | Manual | Manual | Manual |
| Bundle size | 0 KB | ~5 KB | ~30 KB | ~80 KB | ~10 KB | ~2 KB |
| Bun compatibility | Native | Good | Known issues (execArgv) | Good | Good | Good |
| Learning curve | Low | Medium | Low | Medium | Low | Low |

### 3.2 Commander.js and Bun: Known Issues

Commander.js v12+ has a known issue with Bun where `process.execArgv` incorrectly includes script arguments (e.g., `-e`), causing Commander's auto-detection to misfire. Workaround: pass `process.argv` explicitly to `program.parseAsync(process.argv)`. This was fixed in Bun v1.1.16, but it demonstrates fragility.

### 3.3 Recommendation: clipanion

**clipanion** is the best fit for Commit Critic because:

1. **Zero runtime dependencies** -- critical for a minimal CLI
2. **Full TypeScript type inference** -- `Option.String()` infers `string | undefined`, `Option.Boolean()` infers `boolean`
3. **Native subcommand support** -- `analyze` and `write` are separate command classes
4. **Powers Yarn Berry** -- proven at scale
5. **Works on Bun** -- confirmed compatible
6. **Auto-generated help** -- good-looking help pages out of the box

Example structure:

```ts
import { Command, Option, Cli, runExit } from "clipanion";

class AnalyzeCommand extends Command {
  static paths = [["analyze"]];
  static usage = Command.Usage({
    description: "Analyze recent commit messages",
    details: `
      Analyzes the last N commits for quality issues.
    `,
  });

  url = Option.String("--url", {
    description: "Remote repository URL to clone and analyze",
  });
  count = Option.String("--count", {
    description: "Number of commits to analyze (default: 50)",
    validator: t => Number(t) > 0,
  });
  json = Option.Boolean("--json", {
    description: "Output results as JSON",
  });

  async execute() {
    // ... analysis logic
    this.context.stdout.write(JSON.stringify(results) + "\n");
  }
}

class WriteCommand extends Command {
  static paths = [["write"]];
  static usage = Command.Usage({
    description: "Interactive commit message writer",
  });

  json = Option.Boolean("--json", {
    description: "Output commit message as JSON",
  });

  async execute() {
    // ... interactive prompt logic
    this.context.stdout.write(message + "\n");
  }
}

const [node, app, ...args] = Bun.argv;
const cli = new Cli({
  binaryLabel: "Commit Critic",
  binaryName: `${node} ${app}`,
  binaryVersion: "1.0.0",
});
cli.register(AnalyzeCommand);
cli.register(WriteCommand);
cli.runExit(args);
```

### 3.4 Alternative: util.parseArgs + manual dispatch

If we want truly zero dependencies, we can use `util.parseArgs` with manual subcommand dispatch:

```ts
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    analyze: { type: "boolean" },
    write: { type: "boolean" },
    url: { type: "string" },
    json: { type: "boolean" },
    count: { type: "string" },
  },
  allowPositionals: true,
  strict: false,
});

const command = positionals[0] || (values.analyze ? "analyze" : values.write ? "write" : null);

switch (command) {
  case "analyze": await runAnalyze(values); break;
  case "write": await runWrite(values); break;
  default: printHelp(); process.exit(1);
}
```

This works but requires manual help text, manual validation, and no type safety. We recommend clipanion for maintainability.

---

## 4. Terminal UX Libraries

### 4.1 Colors: picocolors vs chalk

| Metric | picocolors | chalk |
|--------|-----------|-------|
| Gzipped size | 0.3 KB | 13 KB |
| Loading time | 0.5 ms | 6.2 ms |
| Dependencies | 0 | 2-3 |
| 256-color support | No | Yes |
| TrueColor (hex) | No | Yes |
| NO_COLOR support | Yes | Yes |
| Chaining | Nested calls | Method chaining |
| Used by | PostCSS, SVGO, Babel, Jest | ESLint, Create React App |

**Recommendation: picocolors**

Commit Critic only needs basic colors (red for errors, green for success, yellow for warnings, cyan for info). picocolors covers this at 1/44th the size of chalk. The migration from chalk is trivial (just replace `chalk.red(text)` with `pc.red(text)`).

### 4.2 Interactive Prompts: prompts

For the `--write` interactive mode, we need a prompt library. Options:

| Library | Size | Dependencies | Features | TS Support |
|---------|------|-------------|----------|------------|
| `prompts` | ~20 KB | 1 (kleur) | Text, select, toggle, multiselect, date | Yes |
| `inquirer` | ~40 KB | 3 | Same + checkbox, rawlist | Yes |
| `enquirer` | ~15 KB | 0 | Same as inquirer | Yes |

**Recommendation: prompts**

- Lightweight, Promise-based API
- Used by Create React App, Gatsby, and many others
- Clean output, good defaults
- Works well with Bun

```ts
import prompts from "prompts";

const response = await prompts([
  {
    type: "text",
    name: "description",
    message: "Describe what this commit does:",
  },
  {
    type: "select",
    name: "type",
    message: "Commit type:",
    choices: [
      { title: "feat", value: "feat" },
      { title: "fix", value: "fix" },
      { title: "refactor", value: "refactor" },
      { title: "docs", value: "docs" },
    ],
  },
]);
```

### 4.3 Full TUI Libraries: NOT RECOMMENDED

| Library | Paradigm | Deps | Use Case Fit |
|---------|----------|------|-------------|
| Ink (React) | React components | react, yoga-layout, chalk | Overkill -- needs React ecosystem |
| blessed | Imperative widgets | 0 | Dead project (last commit ~2 years ago) |
| OpenTUI | React/Solid/Vue + Zig FFI | react, zig-ffi | Pre-1.0, not production-ready |

**Verdict:** Commit Critic is a prompt-based tool, not a dashboard. It asks questions, shows results, and exits. A full-screen TUI adds unnecessary complexity and dependencies. Use `prompts` + `picocolors` for the interactive experience.

---

## 5. Bun Runtime APIs for CLI Development

### 5.1 Bun.spawn -- Running Git Commands

`Bun.spawn()` is the primary way to run git commands:

```ts
// Get last 50 commits
const proc = Bun.spawn([
  "git", "log", "--format=%H|%s|%b", "-n", "50"
], {
  stderr: "pipe",
});

const output = await proc.stdout.text();
const exitCode = await proc.exited;

if (exitCode !== 0) {
  const error = await proc.stderr.text();
  throw new Error(`git log failed: ${error}`);
}

const commits = output.trim().split("\n").map(line => {
  const [hash, ...rest] = line.split("|");
  return { hash, message: rest.join("|") };
});
```

For remote repos (`--url`), clone first:

```ts
const tempDir = await Bun.$`mktemp -d`.quiet().text();
await Bun.$`git clone ${url} ${tempDir}`;
// ... analyze ...
await Bun.$`rm -rf ${tempDir}`;
```

**Note:** Bun also provides a template literal API `Bun.$` for shell commands, which is more concise than `Bun.spawn` for simple cases:

```ts
const { stdout } = await Bun.$`git log --format=%H -n 50`.text();
```

### 5.2 Bun.file -- File I/O

`Bun.file()` returns a `BunFile` (extends `Blob`) for efficient file reading:

```ts
// Read .gitconfig
const config = await Bun.file(".gitconfig").text();

// Read JSON
const packageJson = await Bun.file("package.json").json();

// Stream large files
for await (const chunk of Bun.file("largefile.txt").stream()) {
  // process chunk
}
```

### 5.3 Bun.env -- Typed Environment Variables

```ts
declare module "bun" {
  interface Env {
    OPENAI_API_KEY: string;
    OPENAI_BASE_URL: string;
    OPENAI_MODEL: string;
  }
}

const apiKey = Bun.env.OPENAI_API_KEY; // typed as string
```

### 5.4 fetch -- Built-in HTTP Client

Bun has a native `fetch` implementation (no node-fetch needed):

```ts
// Call OpenAI-compatible API
const response = await fetch(`${Bun.env.OPENAI_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Bun.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: Bun.env.OPENAI_MODEL || "gpt-4o",
    messages: [
      { role: "system", content: "You are a commit message critic..." },
      { role: "user", content: commitMessage },
    ],
  }),
});

const result = await response.json();
```

### 5.5 Bun.test -- Test Runner

```ts
// src/__tests__/analyzer.test.ts
import { test, expect } from "bun:test";
import { analyzeCommit } from "../analyzer";

test("analyzes a good commit message", async () => {
  const result = await analyzeCommit("feat: add user authentication");
  expect(result.score).toBeGreaterThan(0.8);
});

test("flags a bad commit message", async () {
  const result = await analyzeCommit("fix stuff");
  expect(result.issues.length).toBeGreaterThan(0);
});
```

Run with: `bun test`

---

## 6. Executable Packaging Plan

### 6.1 Development Mode

During development, run directly with Bun:

```bash
bun run src/cli.ts analyze
bun run src/cli.ts write
```

### 6.2 npm Distribution (package.json#bin)

```json
{
  "name": "commit-critic",
  "version": "1.0.0",
  "bin": {
    "commit-critic": "./dist/cli.js"
  },
  "scripts": {
    "build": "bun build ./src/cli.ts --outdir ./dist --target=bun",
    "dev": "bun run src/cli.ts",
    "test": "bun test",
    "compile:linux": "bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile ./dist/commit-critic-linux-x64",
    "compile:mac-arm": "bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile ./dist/commit-critic-darwin-arm64",
    "compile:mac-intel": "bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile ./dist/commit-critic-darwin-x64",
    "compile:windows": "bun build ./src/cli.ts --compile --target=bun-windows-x64 --outfile ./dist/commit-critic-windows-x64.exe"
  }
}
```

Entry point with shebang:

```ts
// src/cli.ts
#!/usr/bin/env bun
import { Cli, runExit } from "clipanion";
// ... CLI setup
```

### 6.3 Standalone Executable Distribution

Build standalone binaries for GitHub Releases:

```bash
# Linux x64 (most common)
bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile ./dist/commit-critic-linux-x64 --minify

# macOS Apple Silicon
bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile ./dist/commit-critic-darwin-arm64 --minify

# macOS Intel
bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile ./dist/commit-critic-darwin-x64 --minify

# Windows x64
bun build ./src/cli.ts --compile --target=bun-windows-x64 --outfile ./dist/commit-critic-windows-x64.exe --minify
```

**Binary sizes:** Expect ~20-30 MB per binary (Bun runtime + bundled code). This is acceptable for a CLI tool that bundles an entire runtime.

### 6.4 Cross-compilation

Bun supports cross-compilation natively. All targets can be built from a single machine (e.g., macOS ARM64 developer machine can build Linux, Windows, and macOS x64 binaries).

### 6.5 CI/CD Pipeline (GitHub Actions)

```yaml
name: Build
on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: bun-linux-x64
            name: commit-critic-linux-x64
          - os: macos-latest
            target: bun-darwin-arm64
            name: commit-critic-darwin-arm64
          - os: macos-latest
            target: bun-darwin-x64
            name: commit-critic-darwin-x64
          - os: ubuntu-latest
            target: bun-windows-x64
            name: commit-critic-windows-x64.exe
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun build ./src/cli.ts --compile --target=${{ matrix.target }} --outfile ./dist/${{ matrix.name }} --minify
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/${{ matrix.name }}
```

### 6.6 macOS Code Signing

For macOS Gatekeeper compliance:

```bash
codesign --deep --force -vvvv --sign "XXXXXXXXXX" --entitlements entitlements.plist ./dist/commit-critic-darwin-arm64
```

Requires an Apple Developer certificate and `entitlements.plist` with JIT permissions.

---

## 7. Recommended Project Structure

```
commit-critic/
├── bun.lock
├── bunfig.toml              # Bun configuration
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── cli.ts               # Entry point: shebang + clipanion setup
│   ├── commands/
│   │   ├── analyze.ts       # AnalyzeCommand class
│   │   └── write.ts         # WriteCommand class
│   ├── core/
│   │   ├── git.ts           # Git operations (Bun.spawn wrappers)
│   │   ├── analyzer.ts      # Commit message analysis logic
│   │   ├── writer.ts        # Interactive commit writer
│   │   └── llm.ts           # LLM client (OpenAI-compatible fetch)
│   ├── types/
│   │   ├── commit.ts        # Commit types
│   │   ├── analysis.ts      # Analysis result types
│   │   └── config.ts        # Config types
│   ├── ui/
│   │   ├── output.ts        # Formatted output (picocolors)
│   │   └── prompts.ts       # Interactive prompts wrapper
│   └── utils/
│       ├── env.ts           # Environment variable helpers
│       └── temp-dir.ts      # Temporary directory management
├── src/__tests__/
│   ├── analyzer.test.ts
│   ├── git.test.ts
│   ├── writer.test.ts
│   └── llm.test.ts
├── dist/                    # Build output (gitignored)
│   ├── cli.js               # npm bin target
│   ├── commit-critic-linux-x64
│   ├── commit-critic-darwin-arm64
│   ├── commit-critic-darwin-x64
│   └── commit-critic-windows-x64.exe
└── research/                # Research docs (this file)
```

### 7.1 Key Design Decisions

1. **Commands in separate files** -- Each clipanion command gets its own file for testability and maintainability.
2. **Core logic decoupled from CLI** -- `analyzer.ts`, `git.ts`, and `llm.ts` are pure modules that can be tested independently of clipanion.
3. **UI layer separate from logic** -- `output.ts` handles all terminal formatting, keeping logic clean.
4. **Types in dedicated folder** -- Centralized type definitions for IDE support.

---

## 8. Dependency Shortlist

### 8.1 Required Dependencies

| Package | Version | Purpose | Why Needed | Alternative Considered | Risk | Recommendation |
|---------|---------|---------|------------|----------------------|------|----------------|
| `clipanion` | ^3.2.1 | CLI argument parsing | Subcommands, type inference, auto-help, zero deps | `util.parseArgs` (built-in, no subcommands), `commander` (Bun execArgv issues), `yargs` (heavy) | Low -- well-maintained, powers Yarn Berry | **USE** |
| `picocolors` | ^1.1.1 | Terminal colors | 0.3 KB gzipped, NO_COLOR support, fast | `chalk` (13 KB, unnecessary features), ANSI codes manually (tedious) | Negligible -- tiny, stable, widely used | **USE** |
| `prompts` | ^2.4.2 | Interactive prompts | `--write` mode needs text/select inputs | `inquirer` (heavier), `enquirer` (less popular), raw readline (no styling) | Low -- mature, widely used | **USE** |

### 8.2 Optional Dependencies

| Package | Version | Purpose | Why Considered | Recommendation |
|---------|---------|---------|---------------|----------------|
| `typanion` | ^3.14.0 | Runtime validation for clipanion | Extra validation for option values | **DEFER** -- manual validation sufficient for v1 |
| `zod` | ^3.24.0 | Schema validation | Validate LLM responses, config files | **DEFER** -- manual checks for v1, add if needed |
| `ink` | ^5.0.0 | React TUI | Rich interactive UI for `--write` mode | **REJECT** -- overkill for prompt-based interaction |
| `commander` | ^12.1.0 | CLI parsing | Familiar API | **REJECT** -- clipanion is type-safe and zero-dep |

### 8.3 Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking (Bun runs TS natively, but `tsc --noEmit` catches issues) |
| `@types/prompts` | TypeScript definitions for prompts library |

### 8.4 Total Dependency Count

- **Production:** 3 packages (clipanion, picocolors, prompts)
- **Dev:** 2 packages (typescript, @types/prompts)
- **Built-in (zero deps):** Bun runtime, util.parseArgs, fetch, Bun.spawn, Bun.file, Bun.test

---

## 9. Risks and Workarounds

### 9.1 Bun Ecosystem Maturity

**Risk:** Bun is newer than Node.js. Some npm packages may not be fully compatible.

**Mitigation:**
- Commit Critic uses only well-tested, simple packages (clipanion, picocolors, prompts)
- Bun has excellent Node.js API compatibility
- `bun build --compile` bundles everything, so runtime deps are irrelevant for binary distribution

### 9.2 Binary Size

**Risk:** Standalone executables are ~20-30 MB due to bundled Bun runtime.

**Mitigation:**
- npm distribution (`package.json#bin`) is lightweight -- users install via `bun install -g commit-critic` and only pay the Bun runtime cost once
- Binary distribution is optional (GitHub Releases for users who want zero-install)
- `--minify` reduces the bundled code size

### 9.3 Cross-compilation Reliability

**Risk:** Cross-compiled binaries may have platform-specific issues.

**Mitigation:**
- Use GitHub Actions with native runners for each platform (macOS runner for macOS builds, Ubuntu runner for Linux builds)
- Windows can be cross-compiled from Linux (confirmed working)
- Add smoke tests in CI that run the binary on each platform

### 9.4 Windows Support

**Risk:** Windows has different line endings, path separators, and git behavior.

**Mitigation:**
- Use `Bun.spawn` with array arguments (no shell parsing issues)
- Use `path.join()` and `path.sep` for cross-platform paths
- Test on Windows via GitHub Actions (`windows-latest` runner)
- Bun has a built-in shell for Windows that supports bash-like syntax

### 9.5 LLM API Reliability

**Risk:** OpenAI-compatible API calls may fail, timeout, or return unexpected formats.

**Mitigation:**
- Implement retry logic with exponential backoff
- Set reasonable timeouts (30s default)
- Validate LLM response format before parsing
- Support `--json` output for programmatic consumption
- Allow `OPENAI_BASE_URL` override for local models (ollama, LM Studio, etc.)

### 9.6 Git Repository Edge Cases

**Risk:** Shallow clones, bare repos, repos without commits, repos with unusual encodings.

**Mitigation:**
- Check for git repo existence before running git commands
- Handle git errors gracefully with user-friendly messages
- Support `--url` for remote repos by cloning to a temp directory
- Clean up temp directories in `finally` blocks

### 9.7 clipanion Bun Compatibility

**Risk:** clipanion uses `process.argv` which should work fine with Bun, but edge cases may exist.

**Mitigation:**
- clipanion explicitly supports Bun (used by Yarn Berry which runs on Bun)
- Use `Bun.argv` when constructing the CLI instance for clarity
- Test on Bun specifically during development

---

## 10. Source Citations

All URLs accessed on May 20, 2026.

### Bun Documentation
- [Bun Executables](https://bun.com/docs/bundler/executables) -- Single-file executable compilation, cross-compilation targets
- [Bun LLM Full Docs](https://bun.sh/llms-full.txt) -- Comprehensive Bun API reference
- [Bun CLI Init](https://bun.com/docs/cli/init) -- Running package.json scripts
- [Bun bunx](https://bun.com/docs/pm/bunx) -- Package executables and bin field
- [Bun argv parsing guide](https://bun.sh/guides/process/argv) -- util.parseArgs with Bun.argv
- [Bun Build API](https://bun.sh/reference/bun/build) -- Bun.build() function reference
- [Bun compile option](https://bun.sh/reference/bun/BuildConfig/compile) -- Compile target options

### CLI Parsing Libraries
- [clipanion GitHub](https://github.com/arcanis/clipanion) -- Type-safe CLI library, zero deps
- [clipanion Docs](http://mael.dev/clipanion/docs/getting-started/) -- Getting started guide
- [clipanion Validation](https://mael.dev/clipanion/docs/validation) -- Typanion integration
- [Commander.js Bun execArgv issue](https://github.com/oven-sh/bun/issues/11673) -- Known incompatibility
- [Commander.js -e flag bug](https://github.com/tj/commander.js/issues/2205) -- Fixed in Bun v1.1.16
- [Optique CLI parser blog](http://blog.brightcoding.dev/2025/09/24/type-safe-cli-argument-parsing-for-typescript-an-in-depth-look-at-optique) -- Type-safe CLI parsing comparison

### Terminal Libraries
- [picocolors GitHub](https://github.com/alexeyraspopov/picocolors) -- Benchmarks, API docs
- [picocolors npm](https://www.npmjs.com/package/picocolors) -- Package info
- [chalk vs picocolors comparison](https://ilovejs.net/compare/chalk-vs-picocolors) -- Detailed comparison
- [Ink GitHub](https://github.com/vadimdemedes/ink) -- React for CLIs, 38k stars
- [blessed vs Ink comparison](https://www.libhunt.com/compare-blessed-vs-ink) -- TUI library comparison
- [TUI comparison matrix](https://github.com/wistrand/melker/blob/main/agent_docs/tui-comparison.md) -- Comprehensive TUI library comparison

### npm and Distribution
- [npm package.json bin field](https://docs.npmjs.com/cli/v9/configuring-npm/package-json/) -- Bin field documentation
- [Bun CLI tutorial](https://devopsforjavascript.dev/blog/build-cli-typescript-bun) -- Building CLI with Bun and TypeScript
- [package.json bin tutorial](https://sergiodxa.com/tutorials/use-package-json-bin-to-create-a-cli) -- Using bin for CLI scripts

### Bun Cross-compilation
- [Bun v1.1.5 Release Notes](https://bun.com/blog/release-notes/bun-v1.1.5) -- Cross-compilation feature announcement
- [Cross-compilation PR](https://github.com/oven-sh/bun/pull/10477) -- Implementation details

---

## Appendix A: Recommended package.json

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
    "picocolors": "^1.1.1",
    "prompts": "^2.4.2"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/prompts": "^2.4.9"
  }
}
```

## Appendix B: Recommended tsconfig.json

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

Note: `bun-types` is bundled with Bun and provides TypeScript definitions for all Bun APIs. No separate installation needed.
