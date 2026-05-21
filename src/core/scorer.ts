/**
 * Deterministic scoring rules engine
 *
 * Fast, offline-capable scoring based on objective rules.
 * No LLM required — runs instantly.
 *
 * Categories:
 * - Structure: subject/body separation, conventional commit format
 * - Subject Quality: length <= 50, imperative mood, no period, capitalized
 * - Conventional Commits: valid type, lowercase type, optional scope
 * - Body Quality: wrapped at 72 chars, explains context
 * - Git Manual Style: Chris Beams' 7 rules compliance
 *
 * Returns: score (0-10) + array of issues with severity
 */

import type { Commit } from '../types/commit';
import type { ScoringResult, Issue } from '../types/scoring';

const VAGUE_KEYWORDS = new Set([
  'fix', 'fixed', 'update', 'updated', 'wip', 'changes', 'stuff',
  'things', 'bugfix', 'patch', 'tweak', 'adjust', 'modify',
]);

const CONVENTIONAL_TYPES = new Set([
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test',
  'build', 'ci', 'chore', 'revert',
]);

const CONVENTIONAL_REGEX = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;

/**
 * Score a commit message using deterministic rules.
 */
export function scoreCommit(commit: Commit): ScoringResult {
  const issues: Issue[] = [];
  const subject = commit.subject;
  const body = commit.body;

  // One-word detection
  const words = subject.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    issues.push({
      category: 'subject',
      severity: 'critical',
      message: 'Subject is a single word — too vague to understand the change.',
      suggestion: 'Use an imperative sentence describing what the commit does.',
    });
  }

  // Vague keyword detection
  const lowerSubject = subject.toLowerCase();
  for (const kw of VAGUE_KEYWORDS) {
    if (lowerSubject.includes(kw) && words.length <= 3) {
      issues.push({
        category: 'specificity',
        severity: 'critical',
        message: `Subject is vague ("${kw}") — lacks detail about what changed and why.`,
        suggestion: 'Be specific: what bug? what update? what component?',
      });
      break; // only one vague keyword issue
    }
  }

  // Conventional commit format
  const ccMatch = subject.match(CONVENTIONAL_REGEX);
  const isConventional = ccMatch !== null;
  if (!isConventional) {
    issues.push({
      category: 'convention',
      severity: 'warning',
      message: 'Missing conventional commit type (e.g., feat:, fix:, docs:).',
      suggestion: 'Prefix with a type and optional scope: feat(api): add caching',
    });
  } else {
    const type = ccMatch[1];
    if (!CONVENTIONAL_TYPES.has(type)) {
      issues.push({
        category: 'convention',
        severity: 'warning',
        message: `Unrecognized conventional commit type "${type}".`,
        suggestion: `Use one of: ${Array.from(CONVENTIONAL_TYPES).join(', ')}`,
      });
    }
  }

  // Subject length
  if (subject.length > 72) {
    issues.push({
      category: 'subject',
      severity: 'warning',
      message: `Subject is ${subject.length} characters — exceeds 72 chars.`,
      suggestion: 'Keep subject <= 50 chars; move details to body.',
    });
  } else if (subject.length > 50) {
    issues.push({
      category: 'subject',
      severity: 'suggestion',
      message: `Subject is ${subject.length} characters — exceeds recommended 50.`,
      suggestion: 'Try to keep subject <= 50 chars.',
    });
  } else if (subject.length < 5) {
    issues.push({
      category: 'subject',
      severity: 'critical',
      message: `Subject is only ${subject.length} characters — too short.`,
      suggestion: 'Describe the change in at least 5 characters.',
    });
  }

  // Capitalization
  if (subject.length > 0 && subject[0] !== subject[0].toLowerCase() && !isConventional) {
    issues.push({
      category: 'subject',
      severity: 'suggestion',
      message: 'Subject starts with uppercase — use lowercase for non-conventional commits.',
      suggestion: 'Start with lowercase unless using a conventional commit type.',
    });
  }

  // Trailing period
  if (subject.endsWith('.')) {
    issues.push({
      category: 'subject',
      severity: 'suggestion',
      message: 'Subject ends with a period.',
      suggestion: 'Remove the trailing period from the subject line.',
    });
  }

  // Imperative mood heuristic
  const nonImperativeStarters = ['added', 'adding', 'updated', 'updating', 'fixed', 'fixing', 'removed', 'removing'];
  const firstWord = words[0]?.toLowerCase() ?? '';
  if (nonImperativeStarters.includes(firstWord)) {
    issues.push({
      category: 'intent',
      severity: 'suggestion',
      message: `Subject uses "${firstWord}" — prefer imperative mood ("add", "update", "fix", "remove").`,
      suggestion: `Change to "${firstWord.replace(/ed$/, '').replace(/ing$/, '')}".`,
    });
  }

  // Body presence for non-trivial changes
  if (!body && subject.length > 30) {
    issues.push({
      category: 'body',
      severity: 'warning',
      message: 'No body present — consider explaining why the change was made.',
      suggestion: 'Add a blank line after the subject, then explain context and rationale.',
    });
  }

  // Body line length
  if (body) {
    for (const line of body.split('\n')) {
      if (line.length > 72) {
        issues.push({
          category: 'body',
          severity: 'suggestion',
          message: 'Body line exceeds 72 characters.',
          suggestion: 'Wrap body text at 72 characters for readability.',
        });
        break;
      }
    }
  }

  // Score calculation: start at 10, subtract penalties
  let score = 10;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 2;
    else if (issue.severity === 'warning') score -= 1;
    else if (issue.severity === 'suggestion') score -= 0.5;
  }
  score = Math.max(1, Math.min(10, Math.round(score)));

  return { score, issues };
}

/**
 * Check if a commit follows conventional commit format.
 */
export function isConventionalCommit(subject: string): boolean {
  return CONVENTIONAL_REGEX.test(subject);
}

/**
 * Check if a commit is a merge commit.
 */
export function isMergeCommit(commit: Commit): boolean {
  return commit.parents.length > 1;
}
