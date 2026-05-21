# OSS Tools Research: Commit Message Analysis

> Research date: 2025-07-13
> Scope: AI commit message generators, conventional commit tools, commit quality linters/scorers, terminal UX libraries, and git helper libraries.

---

## 1. Comparable Tool Matrix

### 1.1 AI-Powered Commit Message Generators

| Tool | Language | Stars | Approach | UX | Provider Support | Key Features |
|------|----------|-------|----------|----|-----------------|--------------|
| **aicommits** (Nutlope) | TypeScript | ~9K | LLM + git diff | CLI with intro/outro, spinner, selection list | TogetherAI, OpenAI, Anthropic, Groq, xAI, OpenRouter, Ollama, LM Studio, custom OpenAI-compatible | Multiple formats (plain, conventional, gitmoji, subject+body), multi-generation, custom prompts, git hook, clipboard mode, diff truncation |
| **OpenCommit/oco** (di-sukharev) | JavaScript/TypeScript | ~7K | LLM + git diff | CLI with config subcommand, GitHub Action | OpenAI, Anthropic, Ollama, custom providers via env vars | Prompt modules (conventional-commit, @commitlint), message templates, emoji, description, language i18n, GitHub Action for post-push improvement |
| **ai-commit** (renatogalera) | Go | N/A | LLM + git diff + review | Interactive TUI with keybindings | OpenAI, Google Gemini, Anthropic, DeepSeek, Ollama, OpenRouter | AI code review, commit message style review, streaming TUI, interactive split commits, semantic release, changelog generation, ticket auto-detection |
| **ai-commit** (nguyenvanduocit) | Go | N/A | LLM + git diff | CLI with chat-style refinement | OpenAI (GPT-3.5/4) | Chat-based message refinement, auto-commit, auto-tag, auto-push |
| **git-ai-commit** (skkdevcraft) | Go | N/A | LLM + git diff + hook | CLI + prepare-commit-msg hook | OpenAI, Anthropic, Ollama, LM Studio (any OpenAI-compatible) | Git config-based setup, stdin diff support, graceful hook fallback (never blocks commit), ready-to-paste config commands |
| **geminicommit** (tfkhdyt) | Go | ~200 | Gemini API + git diff | CLI with flags | Google Gemini only | Conventional commits, PR generation, multi-language, custom API endpoints |
| **aicommit** (coder) | Go | ~150 | LLM + git diff + style guide | CLI with dry-run, amend, context flags | OpenAI, OpenAI-compatible (via OPENAI_BASE_URL) | COMMITS.md style guide support, context flag for additional info, amend mode |
| **ai-gen-commit** (yankeexe) | Python | ~10 | LLM + git diff | CLI with flags | OpenAI, Gemini, TogetherAI, Groq, DeepSeek, Qwen, Ollama, custom | Multi-provider, in-place editing, custom format, debug mode |
| **ocmt** (R44VC0RP) | TypeScript | ~80 | LLM + git diff | Interactive CLI with confirmation | OpenCode.ai | Conventional commits, changelog generation, customizable config.md |

### 1.2 Conventional Commit Tools (Non-AI)

| Tool | Language | Stars | Approach | UX | Key Features |
|------|----------|-------|----------|----|--------------|
| **commitizen/cz-cli** | JavaScript | ~17.5K | Interactive prompts | CLI wizard | Adapter system (cz-conventional-changelog, cz-git, etc.), 1.5M weekly npm downloads |
| **cz-git** | TypeScript | N/A | Interactive prompts + AI | CLI wizard with search/selection | Lightweight, OpenAI support, emoji, issue linking, commitlint integration, 45K weekly downloads |
| **commitizen-tools/commitizen** (Python) | Python | ~3.4K | Interactive prompts | CLI wizard | cz bump (version management), changelog generation, cz check (validation), pre-commit hooks |
| **commitlint** | TypeScript | ~18.4K | Linting/validation | CLI + pre-commit hook | Rule-based validation, shareable configs, parser presets, prompt CLI, 20+ rules |
| **gitlint** | Python | ~950 | Rule-based linting | CLI + pre-commit hook | Configurable rules, commit history linting, Python-based |

### 1.3 Commit Quality Scoring/Analysis Tools

| Tool | Language | Stars | Approach | UX | Key Features |
|------|----------|-------|----------|----|--------------|
| **commrate** | Rust | ~5 | Heuristic scoring (A-F grades) | CLI with pager | Multi-rule scoring: subject/body structure, line wrapping, subject length, diff size vs message length, exception detection |
| **commitalyzer** | Rust | N/A | Rule-based linting | CLI for git hooks | Pre-defined rulesets, designed for git hooks |
| **mit-lint** / **git-mit** | Rust | ~78 | Lint rules with rich error output | CLI + git hooks | miette-based error display, conventional commit check, subject/body rules, issue ID checks (JIRA, GitHub, Pivotal) |
| **conventional_commits_linter** | Rust | N/A | Spec-compliant linting | CLI binary | Strict Conventional Commits v1.0.0 compliance, no dependencies (binary), configurable subjective rules |
| **conventional_commits** (Rust lib) | Rust | N/A | Parsing library | Library | Tokenizer, parser, type/scope/description/body/footer extraction, breaking change detection |

### 1.4 Terminal UX Libraries

| Library | Language | Stars | Downloads | Paradigm | Key Features |
|---------|----------|-------|-----------|----------|--------------|
| **ink** | TypeScript | N/A | 4M/week | React for CLIs | Yoga flexbox layout, React components, hooks (useInput, useStdin, useApp), 5.3K dependents |
| **ink-ui** | TypeScript | ~2K | N/A | React component library for Ink | Spinner, ProgressBar, Alert, theming via ThemeProvider |
| **blessed** / **unblessed** | JS/TypeScript | N/A | N/A | Imperative widgets | 30+ widgets, forms, tables, images. unblessed: modern TS rewrite with browser support |
| **commander.js** | TypeScript | N/A | 46M/week | CLI argument parsing | Subcommands, flags, help generation, the de facto standard |
| **clap** | Rust | N/A | N/A | CLI argument parsing | Derive macro, subcommands, value parsing, the Rust standard |
| **dialoguer** | Rust | ~2K | N/A | Interactive prompts | Select, input, confirm, multi-select, password prompts |
| **ratatui** | Rust | ~5K | N/A | Terminal UI framework | Layout system, widgets (blocks, charts, tables, lists), blocking/event mode |
| **tui-rs** | Rust | ~4K | N/A | Terminal UI framework | Cursive-style TUI, widgets, event handling |

### 1.5 Git Helper Libraries

| Library | Language | Stars | Downloads | Approach | Key Features |
|---------|----------|-------|-----------|----------|--------------|
| **simple-git** | TypeScript | ~3.8K | 7.9M/week | Wrapper around git binary | Promise-based API, excellent TS support, Bun compatible, requires git installed |
| **isomorphic-git** | JavaScript | ~8K | 744K/week | Pure JS git implementation | Browser + Node.js, no git binary needed, no SSH support, slower than native |
| **nodegit** | JavaScript/C++ | ~5.7K | 29K/week | Native bindings to libgit2 | Fast, full git features, complex installation, native deps |
| **git2** (Rust) | Rust | N/A | N/A | Rust bindings to libgit2 | Native performance, full git features, requires libgit2 system dep |

---

## 2. Architecture Patterns

### 2.1 Common Architecture Flow

Nearly all AI commit tools follow the same pattern:

```
1. Read staged diff (git diff --staged / --cached)
2. [Optional] Truncate diff if too large
3. [Optional] Read commit history for style context
4. [Optional] Read project config (commitlint, COMMITS.md, .aicommit.yml)
5. Build prompt (system + user messages)
6. Send to LLM provider
7. Parse/sanitize response
8. [Optional] Shorten if too long
9. [Optional] Present in TUI for review/edit
10. Execute git commit with generated message
```

### 2.2 Provider Configuration Strategies

| Strategy | Tools Using It | Details |
|----------|---------------|---------|
| **Env vars only** | aicommit (coder), geminicommit | OPENAI_API_KEY, OPENAI_BASE_URL, GEMINI_API_KEY |
| **Config file** | aicommits, ai-commit (Go), git-ai-commit | JSON/YAML config in ~/.config/ or project root |
| **Git config** | git-ai-commit | ai-commit.endpoint, ai-commit.model, ai-commit.apiKey in ~/.gitconfig |
| **Interactive setup** | aicommits, OpenCommit | `aicommits setup` or `oco config set` wizard |
| **Custom OpenAI-compatible** | aicommits, OpenCommit, ai-gen-commit | base_url + api_key pattern for any OpenAI-compatible endpoint |

### 2.3 Diff Handling Strategies

| Strategy | Tool | Details |
|----------|------|---------|
| **Hard truncate** | aicommits | Truncates at 30,000 chars with "[Diff truncated due to size]" |
| **Per-file chunking** | OpenCommit | Splits by file, generates per-file messages, joins them |
| **Token-based limit** | OpenCommit | MAX_REQ_TOKENS = 3900, skips files that exceed |
| **Configurable limit** | git-ai-commit | ai-commit.maxDiffBytes (default 200KB) |
| **File exclusion** | aicommits, ai-gen-commit, aicommit (mingeme) | --exclude flag or config patterns |

---

## 3. Prompt Strategy Analysis

### 3.1 aicommits Prompt Strategy

**System prompt structure:**
```
You are an expert Git commit message writer specializing in analyzing code changes
and creating precise, meaningful commit messages.

Your task is to generate exactly N conventional style commit message(s) based on the
provided git diff.

## Requirements:
1. Language: Write all messages in {locale}
2. Format: Strictly follow the {type} commit format:
   <type>(<optional scope>): <description>
3. Allowed Types: {JSON of type-to-description mapping}

## Guidelines:
- Subject line: Max {maxLength} characters, imperative mood, no period
- Analyze the diff to understand:
  * What files were changed
  * What functionality was added, modified, or removed
  * The scope and impact of changes
```

**Key observations:**
- Uses structured markdown with numbered requirements
- Provides type-to-description JSON mapping for conventional commits
- Provides emoji-to-description JSON mapping for gitmoji
- Temperature: 0.4 (low for consistency)
- Max output tokens: 2000
- Max retries: 2
- Has a secondary "shorten" prompt for messages exceeding maxLength
- User message is the raw git diff

### 3.2 OpenCommit Prompt Strategy

**System prompt (conventional-commit module):**
```
You are to act as the author of a commit message in git. Your mission is to create
clean and comprehensive commit messages in the conventional commit convention.
I'll send you an output of 'git diff --staged' command, and you convert it into a
commit message. {emoji instruction}, use the present tense. {description instruction}
```

**Key observations:**
- Simpler, more conversational prompt
- Conditional instructions based on config (emoji, description)
- Includes a few-shot example in the prompt (server.ts diff example)
- Max request tokens: 3900
- Supports two prompt modules: conventional-commit and @commitlint
- The @commitlint module reads local commitlint config and generates prompts dynamically
- Custom prompts supported via OCO_CUSTOM_PROMPT (PR #508)

### 3.3 ai-commit (Go) Prompt Strategy

**Features:**
- Custom prompt templates via `--template` flag and `promptTemplate` config
- Template placeholders: `{COMMIT_MESSAGE}`, `{GIT_BRANCH}`, `{TICKET_ID}`
- Style review prompt for `--review-message` flag
- Separate prompts for code review (`ai-commit review`)
- Prompt template stored in config file

### 3.4 git-ai-commit Prompt Strategy

**Features:**
- Conventional Commits format with subject + bullet-point body
- Follows Conventional Commits spec strictly
- Max diff bytes configurable
- Graceful fallback: if LLM unavailable, hook exits cleanly

### 3.5 mingeme/aicommit Prompt Strategy

**Features:**
- YAML config file (.aicommit.yml) with separate system and user prompt templates
- `{{diff}}` placeholder for diff injection
- Global config support (~/.config/aicommit/)
- File exclusion patterns in config

---

## 4. Scoring and Quality Evaluation Approaches

### 4.1 commrate (Rust) - Heuristic Grading System

**Grading scale:** A (best) to F (worst)

**Scoring rules:**
1. **Structure check:** Good message has subject + body + blank line separator
2. **Line wrapping:** Good messages have wrapped lines
3. **Subject length:** Good subjects are 15-20+ characters (meaningful, not just "Fix")
4. **Diff size vs message length correlation:**
   - Small commits + short messages = GOOD (typo fixes, minor changes)
   - Small commits + detailed messages = GOOD (tricky bugs)
   - Medium commits + detailed messages = GOOD (features)
   - Medium commits + short messages = BAD
   - Huge commits = BAD regardless of message
5. **Exception detection:** Initial commits, vendored deps, refactoring

**Key insight:** commrate explicitly warns against CI enforcement - it's designed for self-assessment. The scoring can be gamed.

### 4.2 mit-lint / git-mit (Rust) - Rule-Based Linting

**Lint categories:**
- **Git Manual Style:** subject-not-separated-from-body, subject-longer-than-72-chars, body-wider-than-72-chars
- **Git Manual Style Extended:** subject-line-not-capitalized, subject-line-ends-with-period
- **Conventional Commits:** not-conventional-commit
- **Issue ID Checks:** pivotal-tracker-id-missing, jira-issue-key-missing, github-id-missing

**Key insight:** Uses miette for rich terminal error display with code spans, help text, and reference URLs. Each lint has a clear explanation of WHY the rule matters.

### 4.3 Chris Beams' 7 Rules (Industry Standard)

These are referenced by nearly every tool and form the basis of quality evaluation:

1. Separate subject from body with a blank line
2. Limit the subject line to 50 characters
3. Capitalize the subject line
4. Do not end the subject line with a period
5. Use the imperative mood in the subject line
6. Wrap the body at 72 characters
7. Use the body to explain what and why vs. how

### 4.4 Conventional Commits Specification Rules

Enforced by commitlint and conventional_commits_linter:
- Header max length: 100 chars
- Subject case: never sentence-case, start-case, pascal-case, upper-case
- Subject must not be empty
- Subject must not end with period
- Type must be lowercase
- Type must not be empty
- Type must be from allowed enum (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert)
- Body must have leading blank line
- Body max line length: 100 chars
- Footer must have leading blank line
- Footer max line length: 100 chars

---

## 5. UX Patterns and Lessons

### 5.1 What Works Well

| Pattern | Tool | Why It Works |
|---------|------|-------------|
| **Graceful hook fallback** | git-ai-commit | Never blocks a commit if LLM is unavailable |
| **Interactive TUI with keybindings** | ai-commit (Go) | Users can regenerate, edit, view diff, change type without leaving terminal |
| **Multi-generation with selection** | aicommits | Generates N options, user picks the best |
| **Config file + git config duality** | git-ai-commit, ai-commit | Both global and project-level config |
| **Custom prompt support** | aicommits, OpenCommit, aicommit | Users can override system prompt for project-specific needs |
| **Diff truncation with notification** | aicommits | Handles large diffs gracefully, notifies user |
| **Rich error display** | mit-lint (miette) | Code spans, help text, reference URLs |
| **Message template placeholders** | OpenCommit, ai-commit | Allows embedding issue refs, branch names |
| **Provider abstraction** | aicommits, ai-commit | Multiple providers behind unified interface |

### 5.2 What Doesn't Work Well

| Anti-Pattern | Tool | Issue |
|-------------|------|-------|
| **No graceful fallback** | OpenCommit | Fails hard if API is unavailable |
| **Overly simple prompts** | OpenCommit (original) | "You are to act as the author..." - too vague for consistent results |
| **No diff size management** | Some tools | Large diffs cause timeouts or poor quality |
| **Single provider lock-in** | geminicommit | Only supports Gemini |
| **No message quality feedback** | Most generators | They generate but don't evaluate quality |
| **Hardcoded token limits** | OpenCommit (3900) | Too restrictive for modern models |
| **No style review** | aicommits, OpenCommit | Generate but don't check quality of output |
| **Blocking on network** | Most tools | No offline mode or fallback |

---

## 6. Dependencies to Adopt

### 6.1 TypeScript/JavaScript

| Dependency | Purpose | Why |
|-----------|---------|-----|
| **simple-git** | Git operations | Most popular, Promise-based, excellent TS support, 7.9M weekly downloads |
| **commander.js** | CLI argument parsing | De facto standard, 46M weekly downloads |
| **ink** | TUI framework | React-based, 4M weekly downloads, 5.3K dependents |
| **chalk** | Terminal colors | Standard for colored output |
| **execa** | Child process execution | Used by aicommits, better than child_process |
| **@ai-sdk/openai** | LLM provider | Used by aicommits, supports OpenAI-compatible endpoints |
| **zod** | Schema validation | Type-safe config and response validation |

### 6.2 Rust

| Dependency | Purpose | Why |
|-----------|---------|-----|
| **git2** | Git operations | Native libgit2 bindings, full git feature support |
| **clap** | CLI argument parsing | Rust standard, derive macros |
| **miette** | Error display | Rich terminal error output with code spans (used by mit-lint) |
| **ratatui** | TUI framework | Modern, actively maintained, layout system |
| **dialoguer** | Interactive prompts | Simple prompts (select, input, confirm) |
| **regex** | Pattern matching | Used by nearly all linting tools |
| **serde** | Serialization | Config file parsing, JSON handling |

---

## 7. Dependencies to Avoid

| Dependency | Reason |
|-----------|--------|
| **isomorphic-git** | No SSH support, slower than native, Bun compatibility issues, overkill for CLI tools |
| **nodegit** | Complex installation (native deps), declining maintenance |
| **blessed** (original) | Abandoned, no TypeScript, full re-render on every update |
| **Heavy bundlers for CLI** | esbuild/tsup preferred for CLI tools - keep bundle small |
| **Full browser dependencies** | Keep CLI tools lightweight - no DOM, no browser APIs |
| **Multiple git libraries** | Pick one (simple-git for TS, git2 for Rust) - don't mix |

---

## 8. Key Insights for commit-critic

### 8.1 Differentiation Opportunities

1. **No tool does commit message CRITIQUE/SCORING with AI.** All existing tools either:
   - Generate messages (aicommits, OpenCommit, etc.)
   - Lint against rules (commitlint, gitlint, mit-lint)
   - Score heuristically (commrate - rule-based, not AI)

   commit-critic can fill the gap: AI-powered quality evaluation with explainable scoring.

2. **No tool provides actionable improvement suggestions.** Existing linters say "your subject is too long" but don't suggest how to fix it. An AI critic could say "Consider: 'fix(auth): handle token expiry in refresh flow' instead of 'fix token refresh issue'."

3. **No tool combines rule-based + AI scoring.** commrate uses heuristics, commitlint uses rules, but none combine both with AI semantic understanding.

### 8.2 Recommended Architecture

```
Input: git diff --staged + commit message (or just message)
         |
         v
   [Rule-based checks]    Chris Beams 7 rules + Conventional Commits spec
         |
         v
   [AI semantic scoring]  LLM evaluates clarity, specificity, intent communication
         |
         v
   [Scoring engine]       Combines rule scores + AI scores into weighted final score
         |
         v
   [TUI output]           Rich display with per-criteria breakdown, suggestions
```

### 8.3 Scoring Framework (Recommended)

Based on analysis of commrate, mit-lint, and Chris Beams' rules:

| Category | Weight | Criteria |
|----------|--------|----------|
| **Structure** | 15% | Subject/body separation, conventional commit format |
| **Subject Quality** | 25% | Length (<=50 chars), imperative mood, no period, capitalized |
| **Specificity** | 20% | Mentions specific components/functions, not vague |
| **Intent Communication** | 20% | Explains WHY, not just WHAT (AI evaluation) |
| **Body Quality** | 10% | Wrapped at 72 chars, explains context |
| **Conventions** | 10% | Follows project-specific conventions (commitlint config) |

---

## 9. Source Citations

All URLs accessed on 2025-07-13.

### AI Commit Message Generators
- aicommits: https://github.com/Nutlope/aicommits
- aicommits prompt.ts: https://github.com/Nutlope/aicommits/blob/develop/src/utils/prompt.ts
- aicommits openai.ts: https://github.com/Nutlope/aicommits/blob/develop/src/utils/openai.ts
- aicommits commands: https://github.com/Nutlope/aicommits/blob/develop/src/commands/aicommits.ts
- OpenCommit: https://github.com/di-sukharev/opencommit
- OpenCommit config: https://github.com/di-sukharev/opencommit/blob/master/src/commands/config.ts
- OpenCommit prompt strategy: https://github.com/di-sukharev/opencommit/commit/eae7618d575ee8d2e9fff5de56da79d40c4bc5fc
- ai-commit (Go TUI): https://github.com/renatogalera/ai-commit
- ai-commit (Go chat): https://github.com/nguyenvanduocit/ai-commit
- git-ai-commit: https://github.com/skkdevcraft/git-ai-commit
- geminicommit: https://github.com/tfkhdyt/geminicommit
- aicommit (coder): https://github.com/coder/aicommit
- ai-gen-commit: https://github.com/yankeexe/ai-gen-commit
- ocmt: https://github.com/R44VC0RP/ocmt
- aicommit (mingeme): https://github.com/mingeme/aicommit

### Conventional Commit Tools
- commitizen (JS): https://github.com/commitizen/cz-cli
- cz-git: https://www.npmjs.com/package/cz-git
- commitizen (Python): https://github.com/commitizen-tools/commitizen
- commitlint: https://github.com/conventional-changelog/commitlint
- commitlint config-conventional: https://github.com/conventional-changelog/commitlint/blob/master/@commitlint/config-conventional/src/index.ts
- gitlint: https://github.com/jorisroovers/gitlint

### Scoring/Analysis Tools
- commrate: https://github.com/QazerLab/commrate
- mit-lint / git-mit: https://github.com/PurpleBooth/git-mit
- mit-lint lints docs: https://github.com/PurpleBooth/git-mit/blob/main/docs/lints/index.md
- mit-commit: https://github.com/PurpleBooth/mit-commit
- conventional_commits_linter: https://crates.io/crates/conventional_commits_linter
- conventional_commits (Rust): https://crates.io/crates/conventional_commits
- commitalyzer: https://docs.rs/commitalyzer/latest/commitalyzer/

### Terminal UX Libraries
- ink: https://github.com/vadimdemedes/ink
- ink-ui: https://github.com/vadimdemedes/ink-ui
- unblessed: https://github.com/vdeantoni/unblessed

### Git Helper Libraries
- simple-git: https://github.com/simple-git-js/simple-git
- isomorphic-git: https://github.com/isomorphic-git/isomorphic-git
- Git libraries comparison: https://github.com/dexhorthy/kustomark-ralph-bash/blob/main/GIT_LIBRARIES_COMPARISON.md

### Commit Message Guidelines
- Chris Beams' 7 Rules: https://chris.beams.io/git-commit/
- Calmops Git Commit Style Guide: https://calmops.com/_posts/git-commit-message-style-guide/
- Codably Commit Messages: https://codably.dev/workflows/the-art-of-writing-good-commit-messages

---

## 10. Summary of Recommendations

1. **Use simple-git** for TypeScript or **git2** for Rust - both are well-maintained and widely used
2. **Use ink** (TS) or **ratatui** (Rust) for TUI - rich interactive output with scoring breakdowns
3. **Use miette** (Rust) or a similar rich error library for displaying lint violations with code spans
4. **Adopt a hybrid scoring approach:** rule-based checks (fast, deterministic) + AI semantic evaluation (nuanced, contextual)
5. **Support custom prompts** via config file - users want to tailor evaluation to their project
6. **Implement graceful fallbacks** - if LLM is unavailable, fall back to rule-based scoring only
7. **Diff truncation is essential** - set a reasonable limit (30-50K chars) and notify the user
8. **Multi-provider support from day one** - OpenAI, Anthropic, and at least one local option (Ollama)
9. **Provide actionable suggestions** - not just scores, but specific improvement recommendations
10. **Never block a commit** - if used as a hook, provide a --strict flag for CI but default to advisory mode
