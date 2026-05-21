/**
 * Prompt builders for LLM analysis and commit writing.
 *
 * Extracted from llm.ts for testability and iteration.
 */

import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';

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
- suggestion: string (optional) — the single best improvement tip, shown as "Better:"
- whyGood: string (optional) — one-line explanation of why the commit is good, shown when score >= 7`;

export const FEW_SHOT_EXAMPLES = `
Few-shot examples:
- 1: "wip" — one word, no information
- 2: "fixed bug" — vague, no scope or impact
- 4: "Added new feature" — no type, no scope, no specifics
- 6: "fix: handle auth errors" — CC format but no specifics
- 8: "feat(api): add Redis caching for read endpoints" — Good CC, clear scope
- 10: "feat(api): add Redis caching layer\n\n- Implement cache for read endpoints\n- Add TTL configuration\n- Improves response time by 200ms" — Perfect CC, body with specifics, measurable impact`;

/**
 * Build the analysis prompt for a single commit.
 */
export function buildAnalysisPrompt(commit: Commit, deterministic: ScoringResult): string {
  return `${ANALYSIS_SYSTEM_IDENTITY}

${SCORING_CRITERIA}

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
  return `Write a concise, conventional commit message for the following staged changes.

Commit type: ${type}
${scope ? `Scope: ${scope}` : ''}
${description ? `Description: ${description}` : ''}

Staged diff:
${diff.slice(0, 12000)}

Rules:
- Subject line <= 50 characters
- Use imperative mood ("add", not "added")
- No trailing period
- If the change is complex, add a body after a blank line
- Return ONLY the commit message, no markdown, no quotes.`;
}
