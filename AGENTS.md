# commit-critic

AI-powered commit message critic and writer. Bun + TypeScript CLI.

## Mission

Analyze commit message quality with AI-powered scoring (deterministic pre-filters + LLM-owned critique) and help developers write better commits.

---

## First Steps

1. Read the nearest `AGENTS.md` (root → src/ → src/core/ → src/__tests__/)
2. Read `src/cli.ts` for entry point and command routing
3. Read `src/types/` for shared type definitions
4. Make the smallest correct change that fits local patterns
5. Verify with `bun run typecheck && bun test`

---

## Must-Run Commands

```bash
bun install              # Install dependencies
bun run dev --help       # Run in development mode
bun run typecheck        # Type check
bun test                 # Run tests
bun run build            # Build bundled JS
bun run compile:linux    # Build native Linux binary
```

---

## Architecture

- **CLI framework**: clipanion (class-based commands)
- **AI SDK**: Vercel AI SDK v7 canary (generateText, Output.object)
- **Providers**: OpenAI, OpenAI-compatible (LM Studio, vLLM, Ollama)
- **Schema validation**: Zod
- **Colors**: picocolors (NO_COLOR compliant)
- **Prompts**: @inquirer/prompts (interactive write mode)
- **Git access**: `Bun.spawn` / `Bun.$` (subprocess)
- **Scoring**: Hybrid — deterministic rules + LLM semantic evaluation

---

## Module Boundaries

```
src/
  cli.ts              # Entry point: clipanion CLI setup
  commands/           # clipanion command classes
    analyze.ts        # AnalyzeCommand
    write.ts          # WriteCommand
    doctor.ts         # DoctorCommand
  core/               # Core logic
    analyzer.ts       # Analysis engine (combines scoring)
    git.ts            # Git operations via Bun.spawn
    llm.ts            # LLM client (AI SDK integration)
    scorer.ts         # Deterministic scoring rules
    writer.ts         # Interactive commit writer
    remote.ts         # Remote repo handling
  types/              # Shared type definitions
    analysis.ts       # AnalysisResult, AnalysisSummary, JsonOutput
    commit.ts         # Commit interface
    config.ts         # AIConfig, AppConfig, ResolvedConfig
    scoring.ts        # Issue, ScoringResult, ScoreBreakdown
  config/             # Config resolution
    ai-config.ts      # AI provider config
    app-config.ts     # App config
  ui/                 # Terminal output
    output.ts         # Rich terminal rendering
    json.ts           # JSON output formatting
    progress.ts       # Progress bar
    prompts.ts        # Interactive prompts
    spinner.ts        # Animated spinner
  utils/              # Utilities
    diff.ts           # Diff parsing and truncation
    env.ts            # Environment variable helpers
    temp-dir.ts       # Temp directory management
  __tests__/          # Tests
```

---

## Conventions

- **Types**: All types in `src/types/`. Core modules import from types, not from each other.
- **Git access**: Always use `Bun.spawn` argv mode (never shell-string interpolation).
- **Colors**: Use picocolors. Respect NO_COLOR.
- **Output**: Data to stdout, status to stderr.
- **JSON**: Auto-JSON when stdout is not TTY. `--json` flag forces JSON.
- **Exit codes**: 0 (success), 1 (general error), 3 (auth), 4 (network), 5 (API client), 6 (API server)
- **Error hints**: Every error should have an actionable hint.
- **Secrets**: Never print full API keys. Mask as `sk-...`.

---

## Search Order

1. Nearest AGENTS.md
2. Code search (rg)
3. Local docs
4. Web search

---

## Public vs Private

- **Public**: README.md, src/, LICENSE, package.json
- **Private (gitignored)**: .internal/, .hermes/, research/, reference/, references/
