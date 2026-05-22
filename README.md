# commit-critic

Stop shipping `fix stuff` commits.

`commit-critic` is an LLM-powered terminal tool for Git commit messages. It reviews recent commit history, explains weak and strong messages, and helps write a clean commit message from staged changes.

What it does:

- Analyze recent commits in the current Git repo
- Analyze a remote repo URL
- Summarize staged changes and suggest a Conventional Commit
- Run with OpenAI, any OpenAI-compatible `/v1` endpoint, or a local model

## Requirements

- Bun 1.3.9+
- Git in `PATH`
- An LLM provider key or a reachable local OpenAI-compatible server

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quickstart

```bash
git clone <repo-url> commit-critic
cd commit-critic
bun install --frozen-lockfile

export AI_PROVIDER=openai
export AI_MODEL=<model-name>
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<api-key>

bun ./src/cli.ts doctor
bun ./src/cli.ts analyze --count 5
```

For OpenAI directly, omit `AI_BASE_URL` and use `OPENAI_API_KEY`:

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4.1
export OPENAI_API_KEY=sk-...

bun ./src/cli.ts doctor
```

For a local model server at `localhost:8081`:

```bash
export AI_PROVIDER=local
export AI_MODEL=local-model
export AI_BASE_URL=http://localhost:8081/v1

bun ./src/cli.ts doctor
bun ./src/cli.ts analyze --count 5
```

## Commands

From a source checkout:

```bash
bun ./src/cli.ts <command>
```

After installing or compiling:

```bash
commit-critic <command>
```

### Analyze commit history

```bash
# Analyze the last 50 commits in the current repo
commit-critic analyze

# Analyze fewer commits
commit-critic analyze --count 10

# Analyze a remote repository
commit-critic analyze --url https://github.com/steel-dev/steel-browser

# Machine-readable output
commit-critic analyze --count 10 --json

# Offline deterministic smoke test
commit-critic analyze --count 1 --no-llm
```

Example output:

```text
Analyzing 50 commits...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMITS THAT NEED WORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit: "fixed bug"
Score: 2/10
Issue: Too vague - which bug? What was the impact?
Better: "fix(auth): resolve token expiration handling"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WELL-WRITTEN COMMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit: "feat(api): add Redis caching layer"
Score: 9/10
Why it's good: Clear scope, specific change, and useful context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average score: 7.4/10
Vague commits: 3 (6%)
One-word commits: 0 (0%)
```

When stdout is piped, JSON output is enabled automatically. Top-level JSON fields include `version`, `command`, `repo`, `commitCount`, `overallScore`, `summary`, `commits`, `stats`, `topIssues`, and `durationMs`.

Useful flags:

| Flag | Description |
| --- | --- |
| `--count <n>` | Number of commits to analyze. Default: 50 |
| `--url <url>` | Analyze `https://`, `git@`, `file://`, or an absolute path |
| `--provider <name>` | Override `AI_PROVIDER` for one run |
| `--model <name>` | Override `AI_MODEL` for one run |
| `--no-llm` | Use deterministic scoring only |
| `--no-merges` | Exclude merge commits |
| `--json` | Force JSON output |

Aliases: `commit-critic a`, `commit-critic --analyze`

### Write a commit message

`write` reads `git diff --staged`. It prints a suggested commit message, then lets you accept it, type your own message, edit, regenerate, or cancel. It only runs `git commit` when you pass `--commit`, and still asks for confirmation first.

```bash
git add <files>
commit-critic write

commit-critic write --type refactor --scope auth
commit-critic write --type docs --scope readme --description "clarify setup"
commit-critic write --commit
```

Example flow:

```text
Analyzing staged changes... (3 files changed, +82 -19 lines)

Changes detected:
  • Tightened provider config resolution
  • Added tests for base URL precedence
  • Updated setup copy for compatible endpoints

Suggested commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
refactor(config): align provider URL precedence

- Prefer provider-specific base URL vars over AI_BASE_URL
- Keep AI_BASE_URL as the generic compatible endpoint
- Add regression coverage for fallback behavior
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Press Enter to accept, type a custom message, or /e=edit /r=regenerate /c=cancel:
```

Useful flags:

| Flag | Description |
| --- | --- |
| `--type <type>` | Preselect commit type |
| `--scope <scope>` | Pre-fill optional scope |
| `--description <text>` | Pre-fill the short description prompt |
| `--provider <name>` | Override `AI_PROVIDER` for one run |
| `--model <name>` | Override `AI_MODEL` for one run |
| `--no-llm` | Use a deterministic template |
| `--commit` | Ask to run `git commit` after accepting the message |

Aliases: `commit-critic w`, `commit-critic --write`

### Check setup

```bash
commit-critic doctor
```

`doctor` checks Git, repository detection, provider configuration, and provider connectivity. API keys are masked in diagnostic output.

### Configure interactively

```bash
commit-critic setup
commit-critic setup --quick
commit-critic setup --non-interactive
```

`setup` prints the environment values commit-critic needs. It writes `.env` only after explicit confirmation.

## Provider setup

LLM mode is the default. Use `--no-llm` only for deterministic fallback checks.

### OpenAI-compatible endpoint

Use this for hosted providers that implement the OpenAI `/v1` API:

```bash
export AI_PROVIDER=openai
export AI_MODEL=<provider-model-id>
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<provider-api-key>

commit-critic doctor
commit-critic analyze --count 5
```

`OPENAI_BASE_URL` and `OPENAI_API_KEY` also work. Provider-specific values take precedence over `AI_BASE_URL` and `AI_API_KEY`.

### Local endpoint

```bash
export AI_PROVIDER=local
export AI_MODEL=local-model
export AI_BASE_URL=http://localhost:8081/v1

commit-critic doctor
```

Local provider presets are available when you want their defaults:

| Provider | Default base URL | Notes |
| --- | --- | --- |
| `llamacpp` | `http://localhost:8081/v1` | Uses `/v1/completions` for local reasoning models |
| `lmstudio` | `http://localhost:1234/v1` | LM Studio OpenAI-compatible server |
| `vllm` | `http://localhost:8000/v1` | Local or hosted vLLM server |
| `ollama` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint |
| `openrouter` | `https://openrouter.ai/api/v1` | Hosted multi-provider gateway |

For local servers that require auth, set `LOCAL_API_KEY`, `VLLM_API_KEY`, or `AI_API_KEY`.

## Run methods

### Source checkout

```bash
bun ./src/cli.ts --help
bun ./src/cli.ts doctor
```

### Local bunx install

From another project:

```bash
bun add file:/path/to/commit-critic
bunx --bun commit-critic --help
bunx --bun commit-critic doctor --help
```

The package is Bun-native, so use `bunx --bun`.

### Bundled JavaScript and binary

```bash
bun run build
bun ./dist/cli.js --help

bun run compile:linux
./dist/commit-critic-linux-x64 --help
```

Compiled binaries use the same commands and environment variables as the Bun entry point.

## Development checks

```bash
bun run typecheck
bun test
bun run build
bun run compile:linux
bun pm pack --dry-run
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. Analysis exits 0 even when commits need work |
| `1` | Operational error such as Git, I/O, or unexpected failure |
| `3` | Provider auth or config error |
| `10` | Invalid input such as bad `--count`, invalid `--type`, or no staged changes |

## Troubleshooting

### `doctor` reports a missing key

Set a provider-specific key or the generic alias:

```bash
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-...

export AI_PROVIDER=openai
export AI_BASE_URL=https://provider.example/v1
export AI_API_KEY=<provider-api-key>
```

### Connectivity fails

Check that the base URL includes `/v1`, the model name exists on that provider, and the server is reachable:

```bash
commit-critic doctor
commit-critic analyze --count 1 --json
```

### `write` says there are no staged changes

Stage files first:

```bash
git add <files>
commit-critic write
```

### Not in a Git repository

Run inside a repo or pass a remote URL:

```bash
commit-critic analyze --url https://github.com/user/repo
```

## License

MIT
