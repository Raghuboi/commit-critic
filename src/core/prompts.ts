/**
 * Prompt builders for LLM analysis and commit writing.
 *
 * Extracted from llm.ts for testability and iteration.
 */

import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';
import { truncateDiff } from '../utils/diff';

export const MAX_BULLET_DIFF_CHARS = 8_000;

export const ANALYSIS_SYSTEM_IDENTITY = `You are a senior engineer reviewing commit message quality.`;

export const SCORING_CRITERIA = `Evaluate the commit message below on a scale of 1-10.

Scoring criteria:
- 1-2: Terrible — one word, no information, or completely misleading
- 3-4: Poor — vague ("fix bug", "update"), missing type/scope
- 5-6: Average — readable but lacks specificity or conventional format
- 7-8: Good — clear, specific, follows conventions
- 9-10: Excellent — precise, includes scope, body explains why, measurable impact

Output fields:
- score: number (1-10)
- issues: array of { category, severity, message }
- suggestions: array of improvement strings
- suggestion: string (optional) — a concrete rewritten commit message in conventional commit format, shown as "Better:"
- whyGood: string (optional) — one-line explanation of why the commit is good, shown when score >= 7`;

export const ANALYSIS_OUTPUT_CONTRACT = `Output contract:
- Respond with exactly one valid JSON object.
- Do not include markdown fences, headings, comments, or prose outside the JSON object.
- Use this shape: { "score": number, "issues": [{ "category": string, "severity": string, "message": string }], "suggestions": string[], "suggestion": string, "whyGood": string }.
- Use issue categories from: type, scope, subject, body, convention, specificity, intent, clarity.
- Use issue severities from: critical, warning, suggestion.
- Treat deterministic checks as a baseline signal, not a ceiling; adjust the score if the commit context deserves it.`;

export const FEW_SHOT_EXAMPLES = `
Few-shot examples:
- 1: "wip" — one word, no information. Better: "feat: implement user authentication flow"
- 2: "fixed bug" — vague, no scope or impact. Better: "fix(api): resolve null pointer in user validation"
- 4: "Added new feature" — no type, no scope, no specifics. Better: "feat(dashboard): add real-time analytics widget"
- 6: "fix: handle auth errors" — CC format but no specifics. Better: "fix(auth): handle expired JWT tokens in middleware"
- 8: "feat(api): add Redis caching layer" — Good CC, clear scope. Why it's good: specific scope, imperative mood, clear purpose.
- 10: "feat(api): add Redis caching layer

- Implement cache for read endpoints
- Add TTL configuration
- Improves response time by 200ms" — Perfect CC, body with specifics, measurable impact. Why it's good: follows all conventions, body explains rationale with measurable impact.`;

export const WRITE_EXAMPLES = `
Examples:
- Simple docs change: docs(readme): clarify setup instructions
- Bug fix: fix(auth): handle expired session tokens
- Multi-file refactor with body:
  refactor(config): simplify provider resolution

  - Prefer provider-specific environment variables
  - Keep AI_BASE_URL as the generic fallback
  - Add tests for local provider precedence`;

/**
 * Build the analysis prompt for a single commit.
 */
export function buildAnalysisPrompt(commit: Commit, deterministic: ScoringResult): string {
  return `${ANALYSIS_SYSTEM_IDENTITY}

${SCORING_CRITERIA}

${ANALYSIS_OUTPUT_CONTRACT}

${FEW_SHOT_EXAMPLES}

--- CONTEXT ---
Commit subject: "${commit.subject}"
Commit body: ${commit.body || '(none)'}
Author: ${commit.author}
Date: ${commit.date}

--- DETERMINISTIC CHECKS ---
Score: ${deterministic.score}/10
Issues:
${deterministic.issues.map(i => `- [${i.severity}] ${i.message}`).join('\n') || 'None'}

Provide your score, issues, suggestions, optional suggestion (best tip), and optional whyGood as JSON.`;
}

/**
 * Build the write prompt for generating a commit message from staged diff.
 */
export function buildWritePrompt(diff: string, type: string, scope?: string, description?: string): string {
  const truncated = truncateDiff(diff);

  return `Write a concise, conventional commit message for the following staged changes.

Commit type: ${type}
${scope ? `Scope: ${scope}` : ''}
${description ? `Description: ${description}` : ''}

${WRITE_EXAMPLES}

Staged diff:
${truncated}

Rules:
- Subject line <= 50 characters
- Use imperative mood ("add", not "added")
- No trailing period
- If the change is complex, add a body after a blank line
- If the diff is tiny, still name the exact user-visible or code-level change
- If the diff is truncated, write only from visible evidence and avoid inventing hidden details
- Return ONLY the commit message, no markdown, no quotes.`;
}

/**
 * Build the prompt for generating change bullets from a diff.
 */
export function buildBulletsPrompt(diff: string): string {
  return `Given the following git diff, generate 3-5 concise semantic bullets summarizing the changes. Each bullet should be one short sentence. Return only bullet lines.

${diff}`;
}
