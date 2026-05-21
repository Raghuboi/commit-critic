# Terminal Interaction Patterns Research

Evidence-backed analysis of CLI/TUI patterns from Claude Code (Anthropic) and Hermes Agent, with recommendations for the commit-critic tool.

## 1. Source Codebase Overview

### Claude Code Mirror (`/home/raghuboi/Desktop/projects/claude-code`)

- **Stack**: TypeScript + Ink (React for TUI)
- **Architecture**: Full Ink-based TUI with React components
- **Key files inspected**:
  - `src/components/design-system/ProgressBar.tsx` — progress bar with 8-level block characters
  - `src/components/Spinner/SpinnerGlyph.tsx` — animated spinner with stalled-state color interpolation
  - `src/components/Spinner/GlimmerMessage.tsx` — shimmer effect on status messages
  - `src/components/StructuredDiff/colorDiff.ts` — native color-diff via `color-diff-napi`
  - `src/utils/statusNoticeDefinitions.tsx` — status notice system with warning/info types
  - `src/utils/theme.ts` — comprehensive theme system (dark/light/daltonized/ANSI variants)
  - `src/utils/stream.ts` — async stream utility for token streaming
  - `src/utils/processUserInput/processUserInput.ts` — input processing pipeline
  - `src/utils/processUserInput/processSlashCommand.tsx` — slash command routing

### Hermes Agent (`~/.hermes/hermes-agent/`)

- **Stack**: Python CLI (prompt_toolkit + Rich) + Ink TUI (`ui-tui/`)
- **Architecture**: Dual-mode — CLI for headless, TUI for `hermes --tui`
- **Key files inspected**:
  - `agent/display.py` — KawaiiSpinner, tool completion messages, inline diff rendering
  - `hermes_cli/skin_engine.py` — data-driven skin system (6 built-in skins)
  - `ui-tui/src/app/interfaces.ts` — TUI state interfaces (UiState, OverlayState)
  - `ui-tui/src/app/turnStore.ts` — turn state management (nanostores)
  - `ui-tui/src/app/uiStore.ts` — UI state management (nanostores)
  - `ui-tui/src/app/useInputHandlers.ts` — keyboard input handling
  - `ui-tui/src/components/appChrome.tsx` — status bar, face ticker, context bar
  - `ui-tui/src/components/messageLine.tsx` — message rendering with role-based styling
  - `ui-tui/src/components/thinking.tsx` — thinking/tool trail with tree view
  - `ui-tui/src/content/charms.ts` — long-run tool charm messages
  - `ui-tui/src/content/verbs.ts` — tool verbs and thinking verbs
  - `ui-tui/src/theme.ts` — theme system with ANSI normalization

---

## 2. Patterns Worth Adapting for Commit Critic

### 2.1 Compact Status Bar (Hermes)

Hermes uses a single-line status bar at the top of the TUI that shows:
- Animated indicator (kaomoji/emoji/ascii/unicode spinner)
- Rotating verb (`pondering`, `analyzing`, etc.)
- Elapsed duration
- Model name + effort level
- Token usage with progress bar: `[██████░░░░] 65%`
- Session duration
- Background task count
- Cost (when enabled)

Source: `ui-tui/src/components/appChrome.tsx:273-356`

**Adaptation**: A single-line status bar showing review progress, elapsed time, and file count would be ideal for commit-critic.

### 2.2 Progress Bar with Block Characters (Claude Code)

Claude Code uses 8-level block characters for smooth progress:

```
[' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
```

Source: `src/components/design-system/ProgressBar.tsx:26`

**Adaptation**: Use the same block characters for file-by-file review progress.

### 2.3 Color Interpolation for Stalled/Error States (Claude Code)

When a tool stalls, Claude Code interpolates the spinner color from its normal color to `ERROR_RED` (rgb(171,43,63)):

```typescript
const interpolated = interpolateColor(baseRGB, ERROR_RED, stalledIntensity)
```

Source: `src/components/Spinner/SpinnerGlyph.tsx:50-56`

**Adaptation**: Interpolate from green to red as review time increases, signaling "this is taking a while."

### 2.4 Shimmer/Glimmer Effect on Status Messages (Claude Code)

Claude Code applies a shimmer effect where text characters near a moving index get a different (lighter) color, creating a scanning animation. Supports both RGB interpolation (truecolor) and binary toggle (ANSI fallback).

Source: `src/components/Spinner/GlimmerMessage.tsx:1-327`
Source: `src/components/Spinner/ShimmerChar.tsx:1-35`

**Adaptation**: A subtle shimmer on the "Reviewing file..." status line adds polish without being distracting.

### 2.5 Tool Completion Messages (Hermes)

Hermes generates formatted one-liners for each tool call completion:

```
┊ 📖 read      src/utils/theme.ts  0.3s
┊ ✍️  write     src/components/App.tsx  1.2s
┊ 🔧 patch     src/utils/theme.ts  0.5s
┊ 💻 $         git diff --stat  0.1s
```

Format: `┊ {emoji} {verb:9} {detail}  {duration:.1f}s`

Source: `agent/display.py:829-980`

**Adaptation**: Show each file reviewed with emoji prefix, verb, filename, and duration.

### 2.6 Inline Diff Rendering (Hermes)

Hermes renders unified diffs inline with color coding:
- File headers: purple (`#B4A0FF`)
- Hunk headers: gray-blue (`#78788C`)
- Removed lines: white on dark red background
- Added lines: white on dark green background
- Context lines: dim gray (`#969696`)

Source: `agent/display.py:33-86`
Source: `agent/display.py:434-464`

**Adaptation**: Render diff hunks with the same color scheme for added/removed/context lines.

### 2.7 Context Usage Bar (Hermes)

A compact progress bar showing context/token usage with color escalation:
- Green (< 50%): `statusGood`
- Yellow (50-80%): `statusWarn`
- Orange (80-95%): `statusBad`
- Red (>= 95%): `statusCritical`

```
██████░░░░ 65%
```

Source: `ui-tui/src/components/appChrome.tsx:126-151`

**Adaptation**: Show review progress as a colored bar that escalates as more files are processed.

### 2.8 Indicator Style Options (Hermes)

Hermes offers 4 indicator styles, configurable via `/indicator`:

1. **kaomoji**: `(｡◕‿◕｡)`, `(◕‿◕✿)`, `٩(◕‿◕｡)۶` etc.
2. **emoji**: `⚕ `, `🌀`, `🤔`, `✨`, `🍵`, `🔮`
3. **ascii**: `|`, `/`, `-`, `\`
4. **unicode**: Braille spinner from `unicode-animations`

Source: `ui-tui/src/app/interfaces.ts:37-39`
Source: `ui-tui/src/components/appChrome.tsx:47-76`

**Adaptation**: Offer at least ascii and unicode spinner options for the review status.

### 2.9 Status Notice System (Claude Code)

Claude Code has a pluggable status notice system with:
- `isActive(context)` — condition check
- `render(context)` — React rendering
- Types: `warning` (yellow) and `info` (blue)
- Uses `figures.warning` for warning icons

Source: `src/utils/statusNoticeDefinitions.tsx:17-197`

**Adaptation**: Show warnings for large commits, missing descriptions, or skipped files.

### 2.10 Streaming Token Handling (Claude Code)

Claude Code uses a `Stream<T>` class with async iteration for token streaming:

```typescript
class Stream<T> implements AsyncIterator<T> {
  enqueue(value: T): void
  done(): void
  error(error: unknown): void
  next(): Promise<IteratorResult<T>>
}
```

Source: `src/utils/stream.ts:1-76`

**Adaptation**: For streaming review output (if using an LLM), use a similar pattern.

### 2.11 Theme System with ANSI Fallback (Both)

Both codebases provide:
- Truecolor (RGB) themes as primary
- ANSI 256-color fallback for terminals without truecolor
- Automatic detection via `COLORTERM` / `TERM` env vars

Hermes normalizes RGB to ANSI 256 with a scoring algorithm:
Source: `ui-tui/src/theme.ts:104-235`

Claude Code provides separate ANSI theme definitions:
Source: `src/utils/theme.ts:197-353`

**Adaptation**: Use chalk for CLI colors with ANSI fallback.

---

## 3. Patterns Too Complex for This Assessment

### 3.1 Full Ink React TUI (Claude Code)

Claude Code's entire UI is built on Ink (React for terminals), with:
- Custom reconciler, layout engine (Yoga), event system
- Virtual scrolling, selection/copy, mouse tracking
- ~280 source files in `src/ink/` alone

Source: `src/ink/` directory

**Verdict**: Overkill for a review tool. A CLI with chalk/cfonts is sufficient.

### 3.2 Ink React TUI (Hermes)

Hermes TUI uses Ink + nanostores + React with:
- Virtual history, viewport tracking, scrollbars
- Overlay system (approval, clarify, confirm, pager, model picker)
- Subagent tree visualization with heat mapping

Source: `ui-tui/src/` directory

**Verdict**: Too complex. The Hermes CLI patterns (KawaiiSpinner, tool messages) are more appropriate.

### 3.3 Color Diff via Native NAPI (Claude Code)

Claude Code uses `color-diff-napi` for syntax-highlighted diffs:

Source: `src/components/StructuredDiff/colorDiff.ts:1-37`

**Verdict**: A native dependency adds build complexity. Standard ANSI-colored diffs are sufficient.

### 3.4 Skin Engine with YAML Config (Hermes)

Hermes has a full skin engine with 6 built-in skins, YAML user skins, Rich markup logos, and banner art:

Source: `hermes_cli/skin_engine.py:1-926`

**Verdict**: Overkill. A simple dark/light theme with a few accent colors is enough.

### 3.5 Streaming Markdown Rendering (Hermes)

Hermes TUI streams markdown incrementally, splitting at block boundaries:

Source: `ui-tui/src/components/streamingMarkdown.tsx`
Source: `ui-tui/src/components/messageLine.tsx:144-151`

**Verdict**: Complex for a CLI tool. Plain text with ANSI formatting is sufficient.

### 3.6 Slash Command System (Claude Code)

Claude Code has 900+ lines of slash command processing with:
- Forked sub-agents, background execution
- MCP server settling, plugin commands
- Bridge-safe commands for remote clients

Source: `src/utils/processUserInput/processSlashCommand.tsx:1-921`

**Verdict**: Overkill. Simple argument parsing is enough for commit-critic.

---

## 4. CLI vs TUI Recommendation

### Recommendation: CLI (not TUI)

**Reasoning**:

1. **Scope match**: Commit-critic is a single-purpose review tool, not a conversation platform. It runs, produces output, and exits. This is a classic CLI pattern.

2. **Pipeability**: A CLI tool can be piped to `less`, redirected to files, or integrated into CI/CD. A TUI cannot.

3. **Complexity**: Ink TUI adds React dependency tree, build step (Bun/esbuild), and ~100+ files of infrastructure. Chalk + a few utilities is ~10 files.

4. **Precedent**: Both Claude Code and Hermes use CLI as their primary mode. TUI is an enhancement for interactive sessions. Commit-critic has no interactive session.

5. **Streaming output**: CLI streaming (progress bars, incremental lines) is well-supported by libraries like `cli-progress` and `chalk`.

6. **Hermes CLI patterns are directly applicable**: The KawaiiSpinner, tool completion messages, and inline diff rendering are all CLI patterns that work perfectly for a review tool.

### When TUI would make sense:
- If commit-critic becomes an interactive review tool (approve/reject changes, ask follow-up questions)
- If it needs to display a scrollable transcript of multiple reviews
- If it needs overlay dialogs (confirmation, approval)

---

## 5. Specific Terminal UX Patterns to Implement

### 5.1 Progress Indicators

**File-by-file progress bar** (from Claude Code ProgressBar):
```
Reviewing files: ████████░░░░ 8/12 files
```

Use 8-level block characters: `[' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']`

Source: `claude-code/src/components/design-system/ProgressBar.tsx:26`

**Overall review progress**:
```
[████████░░] 80% — 8/10 files reviewed
```

### 5.2 Color Coding

**Semantic colors** (from Hermes skin_engine.py + Claude Code theme.ts):

| Element | Dark Theme | Light Theme |
|---------|-----------|-------------|
| Success/OK | `#4caf50` (green) | `#2E7D32` (dark green) |
| Error | `#ef5350` (red) | `#C62828` (dark red) |
| Warning | `#ffa726` (amber) | `#E65100` (dark amber) |
| Info/Label | `#DAA520` (gold) | `#7A5A0F` (dark gold) |
| Muted/Dim | `#B8860B` (dim gold) | `#8B7355` (dim brown) |
| Diff added bg | `rgb(20,90,20)` | `rgb(200,240,200)` |
| Diff removed bg | `rgb(120,20,20)` | `rgb(240,200,200)` |

Source: `hermes-agent/hermes_cli/skin_engine.py:164-422`
Source: `claude-code/src/utils/theme.ts:115-500`

**Status color escalation** (from Hermes appChrome):
- Normal progress: green
- Slow/stalled: amber
- Error/failure: red

Source: `hermes-agent/ui-tui/src/components/appChrome.tsx:126-144`

### 5.3 Streaming/Incremental Output

**Tool completion lines** (from Hermes display.py):
```
┊ 📖 read      src/utils/theme.ts  0.3s
┊ ✍️  write     src/components/App.tsx  1.2s
```

Pattern: `┊ {emoji} {verb:9} {detail}  {duration:.1f}s`

Source: `hermes-agent/agent/display.py:829-980`

**Spinner during processing** (from Hermes KawaiiSpinner):
- Animated frames: `['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']`
- Format: `  ⠋ Analyzing commit... (2.3s)`
- Wings decoration: `⟪⚔ ⠋ Analyzing commit... ⚔⟫ (2.3s)`

Source: `hermes-agent/agent/display.py:559-783`

**Streaming token output** (from Claude Code Stream):
- Use async iteration for token-by-token output
- Flush after each token for real-time visibility

Source: `claude-code/src/utils/stream.ts:1-76`

### 5.4 Diff Display

**Inline diff rendering** (from Hermes display.py):
- File headers: colored with arrow notation `a/file → b/file`
- Hunk headers: dim color `@@ -1,5 +1,6 @@`
- Removed lines: white text on dark red background
- Added lines: white text on dark green background
- Context lines: dimmed

Source: `hermes-agent/agent/display.py:434-464`

**Diff color codes** (ANSI escape sequences):
```
dim:   \033[38;2;150;150;150m
file:  \033[38;2;180;160;255m
hunk:  \033[38;2;120;120;140m
minus: \033[38;2;255;255;255;48;2;120;20;20m
plus:  \033[38;2;255;255;255;48;2;20;90;20m
```

Source: `hermes-agent/agent/display.py:40-78`

### 5.5 Status Notices

**Warning notices** (from Claude Code statusNoticeDefinitions):
```
⚠ Large commit: 15 files changed (>10 recommended)
⚠ Missing commit description — review may be less accurate
```

Pattern: `{warning_icon} {message}`

Source: `claude-code/src/utils/statusNoticeDefinitions.tsx:31-52`

### 5.6 Summary Output

**Final review summary** (inspired by Hermes tool messages):
```
┊ ✍️  review     12 files reviewed  45.2s
  ✓ 8 files passed
  ⚠ 3 files with warnings
  ✗ 1 file with errors
```

### 5.7 Spinner Styles

**ASCII spinner** (from Hermes):
```
| / - \
```

Source: `hermes-agent/ui-tui/src/components/appChrome.tsx:31`

**Unicode spinner** (from unicode-animations):
```
⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
```

Source: `hermes-agent/agent/display.py:563-564`

### 5.8 Emoji Tool Prefixes (from Hermes)

| Action | Emoji |
|--------|-------|
| Read file | 📖 |
| Write file | ✍️ |
| Patch file | 🔧 |
| Search | 🔍 |
| Run command | 💻 |
| Review | ✍️ |
| Success | ✓ |
| Warning | ⚠ |
| Error | ✗ |

Source: `hermes-agent/agent/display.py:865-980`

---

## 6. Recommended Implementation Stack

Based on the research, commit-critic should use:

1. **chalk** — ANSI color support with truecolor + ANSI fallback (used by both Claude Code and Hermes TUI themes)
2. **cli-progress** or custom progress bar — for file-by-file progress with block characters
3. **ora** or custom spinner — for animated spinner during review (KawaiiSpinner pattern)
4. **diff** — for generating unified diffs
5. **terminal-link** — for clickable file links (OSC 8 hyperlinks, used by Hermes)

**Avoid**:
- Ink/React TUI (overkill)
- Native NAPI modules (build complexity)
- Full skin/theme engine (simple dark/light is enough)

---

## 7. Source Citations

| Pattern | Source File | Lines |
|---------|-----------|-------|
| Progress bar blocks | `claude-code/src/components/design-system/ProgressBar.tsx` | 26 |
| Spinner with stalled color | `claude-code/src/components/Spinner/SpinnerGlyph.tsx` | 10-78 |
| Shimmer/glimmer effect | `claude-code/src/components/Spinner/GlimmerMessage.tsx` | 1-327 |
| Shimmer character | `claude-code/src/components/Spinner/ShimmerChar.tsx` | 1-35 |
| Color interpolation utils | `claude-code/src/components/Spinner/utils.ts` | 1-84 |
| Color diff (NAPI) | `claude-code/src/components/StructuredDiff/colorDiff.ts` | 1-37 |
| Status notice system | `claude-code/src/utils/statusNoticeDefinitions.tsx` | 17-197 |
| Theme system | `claude-code/src/utils/theme.ts` | 1-639 |
| Stream utility | `claude-code/src/utils/stream.ts` | 1-76 |
| Input processing | `claude-code/src/utils/processUserInput/processUserInput.ts` | 1-605 |
| Slash commands | `claude-code/src/utils/processUserInput/processSlashCommand.tsx` | 1-921 |
| KawaiiSpinner | `hermes-agent/agent/display.py` | 559-783 |
| Tool completion messages | `hermes-agent/agent/display.py` | 829-980 |
| Inline diff rendering | `hermes-agent/agent/display.py` | 434-464 |
| Diff ANSI colors | `hermes-agent/agent/display.py` | 40-78 |
| Skin engine | `hermes-agent/hermes_cli/skin_engine.py` | 1-926 |
| TUI interfaces | `hermes-agent/ui-tui/src/app/interfaces.ts` | 1-377 |
| Turn state | `hermes-agent/ui-tui/src/app/turnStore.ts` | 1-85 |
| UI state | `hermes-agent/ui-tui/src/app/uiStore.ts` | 1-41 |
| Input handlers | `hermes-agent/ui-tui/src/app/useInputHandlers.ts` | 1-572 |
| Status bar / face ticker | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 1-484 |
| Context bar color | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 126-144 |
| Context bar rendering | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 146-151 |
| Message line rendering | `hermes-agent/ui-tui/src/components/messageLine.tsx` | 1-220 |
| Thinking/tool trail | `hermes-agent/ui-tui/src/components/thinking.tsx` | 1-1206 |
| Long-run charms | `hermes-agent/ui-tui/src/content/charms.ts` | 1 |
| Tool verbs | `hermes-agent/ui-tui/src/content/verbs.ts` | 1-38 |
| TUI theme | `hermes-agent/ui-tui/src/theme.ts` | 1-589 |
| Indicator styles | `hermes-agent/ui-tui/src/app/interfaces.ts` | 37-39 |
| Indicator rendering | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 47-76 |
| Emoji frames | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 30 |
| ASCII frames | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 31 |
| Spinner types | `hermes-agent/agent/display.py` | 562-572 |
| Kaomoji faces | `hermes-agent/agent/display.py` | 574-583 |
| Thinking verbs | `hermes-agent/agent/display.py` | 585-589 |
| Long-run tool charms | `hermes-agent/ui-tui/src/app/useLongRunToolCharms.ts` | 1-69 |
| Sparkline/heat map | `hermes-agent/ui-tui/src/components/thinking.tsx` | 268-279 |
| Tree view rendering | `hermes-agent/ui-tui/src/components/thinking.tsx` | 50-152 |
| Stream cursor | `hermes-agent/ui-tui/src/components/thinking.tsx` | 194-230 |
| Chevron/accordion | `hermes-agent/ui-tui/src/components/thinking.tsx` | 232-266 |
| Subagent accordion | `hermes-agent/ui-tui/src/components/thinking.tsx` | 281-500 |
| Good vibes heart | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 248-271 |
| Scrollbar | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 383-454 |
| Spawn HUD | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 153-212 |
| Session duration | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 214-225 |
| Model label | `hermes-agent/ui-tui/src/components/appChrome.tsx` | 235-246 |
