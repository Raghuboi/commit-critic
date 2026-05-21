# src/ — Source Code Conventions

## Import Rules

- Types always from `../types/` (or `../types/commit` etc.)
- Never import types from core modules (e.g., don't import `Commit` from `../core/git`)
- Core modules import from types, not from each other where possible
- UI modules import from types and core
- Commands import from core and ui

## Naming

- Commands: `AnalyzeCommand`, `WriteCommand`, `DoctorCommand` (PascalCase, extends Command)
- Functions: camelCase, verb-first (`getCommits`, `scoreCommit`, `analyzeCommit`)
- Types: PascalCase (`Commit`, `AnalysisResult`, `ScoringResult`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_CONFIG_DIR`, `COMMIT_TYPES`)

## Error Handling

- Return errors as strings or null for validation functions
- Throw for unexpected errors
- Commands should write errors to stderr and exit with semantic codes

## clipanion Patterns

```typescript
import { Command, Option } from 'clipanion';

export class MyCommand extends Command {
  static paths = [['my'], ['m']];
  static usage = Command.Usage({
    category: 'Category',
    description: 'Short description',
    details: `Long description.`,
    examples: [
      ['Example 1', 'commit-critic my'],
    ],
  });

  flag = Option.Boolean('--flag', false, {
    description: 'Flag description',
  });

  async execute() {
    // Implementation
  }
}
```

## File Organization

- One class/function per file when it exceeds ~100 lines
- Related utilities in `utils/`
- Shared types in `types/`
- Config resolution in `config/`
- Terminal output in `ui/`
