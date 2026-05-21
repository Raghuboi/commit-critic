# src/core/ — Core Logic Conventions

## Module Responsibilities

### git.ts
- All git operations via `Bun.spawn` or `Bun.$`
- Never use shell-string interpolation — always argv mode
- Functions: `getCommits`, `getStagedDiff`, `isGitRepo`, `cloneRepo`
- Commit type imported from `../types/commit`

### scorer.ts
- Deterministic scoring rules (offline-capable)
- Categories: structure, subject quality, conventional commits, body quality, diff correlation, git manual style
- Returns `ScoringResult` with score (0-10) and issues array
- No LLM calls — pure functions

### llm.ts
- AI SDK integration (generateText, Output.object)
- Multi-provider support via provider config
- Structured output with Zod schemas
- Fallback for weak local models
- Functions: `analyzeCommitWithLLM`, `generateCommitMessage`

### analyzer.ts
- Combines deterministic + LLM scoring
- Handles --no-llm mode
- Batch processing of commits
- Functions: `analyzeCommit`, `analyzeCommits`

### writer.ts
- Interactive commit writer flow
- Uses @inquirer/prompts for user input
- Reads staged diff, generates suggestion
- Does NOT auto-commit — user controls commit
- Functions: `runWriter`, `generateSuggestion`

### remote.ts
- Remote repo handling (clone, analyze, cleanup)
- Uses temp directories with guaranteed cleanup
- Functions: `analyzeRemoteRepo`, `isValidRepoUrl`

## Scoring Contract

- Deterministic score: 0-10 based on objective rules
- LLM score: 0-10 based on semantic evaluation
- Final score: weighted combination (configurable)
- Issues: array of `{ category, severity, message, suggestion? }`

## Git Command Patterns

```typescript
// Bun.spawn (argv mode — always use this)
const proc = Bun.spawn(['git', 'log', '--format=%H%n%s%n%b%n---END---', '-n', String(count)], {
  cwd: repoPath,
  stdout: 'pipe',
  stderr: 'pipe',
});

// Bun.$ (template literal — also safe, auto-escapes)
const output = await Bun.$`git log --format=%H -n ${count}`.text();
```

## Error Cases

- Empty repos: return empty arrays
- Non-git directories: return false from isGitRepo
- Failed git commands: check exit code, parse stderr
- Remote clone failures: cleanup temp dir in finally block
