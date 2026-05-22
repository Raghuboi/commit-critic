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
import type { ScoringResult, Issue, IssueCategory } from '../types/scoring';
import { CONVENTIONAL_TYPES, CONVENTIONAL_TYPES_SET } from '../utils/commit-types';

const VAGUE_KEYWORDS = new Set([
  'fix', 'fixed', 'update', 'updated', 'wip', 'changes', 'stuff',
  'things', 'bugfix', 'patch', 'tweak', 'adjust', 'modify',
]);

const CONVENTIONAL_REGEX = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;

function removeTrailingPeriod(subject: string): string {
  return subject.replace(/\.$/, '');
}

function lowercaseFirstChar(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function toImperative(subject: string): string {
  const words = subject.split(/\s+/);
  const first = words[0]?.replace(/ed$/, '').replace(/ing$/, '') ?? '';
  return [first, ...words.slice(1)].join(' ');
}

function getDerivedType(subject: string): string {
  const lower = subject.toLowerCase();
  if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) return 'fix';
  if (lower.includes('doc') || lower.includes('readme')) return 'docs';
  if (lower.includes('test')) return 'test';
  return 'feat';
}

function truncateToWordBoundary(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const truncated = s.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) return truncated.slice(0, lastSpace);
  return truncated;
}

/**
 * Ensure subject has a conventional type prefix, but avoid duplication
 * if subject already follows conventional format.
 * Returns [prefix, messagePart] where prefix is '' if already conventional.
 */
function ensureConventionalPrefix(subject: string, type: string): [string, string] {
  const ccMatch = subject.match(CONVENTIONAL_REGEX);
  if (ccMatch !== null) {
    // Already has conventional prefix - extract just the message part
    return ['', ccMatch[3]];
  }
  // Not conventional - add the prefix
  return [`${type}: `, subject];
}

function findVagueKeyword(subject: string): string | undefined {
  const normalizedWords = subject
    .toLowerCase()
    .replace(CONVENTIONAL_REGEX, '$3')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return normalizedWords.find((word) => VAGUE_KEYWORDS.has(word));
}

function buildRewrite(subject: string, type = getDerivedType(subject)): string {
  const [, messagePart] = ensureConventionalPrefix(subject, type);
  const duplicatePrefix = `${type} `;
  const deduped = messagePart.toLowerCase().startsWith(duplicatePrefix)
    ? messagePart.slice(duplicatePrefix.length)
    : messagePart;
  return `${type}: ${deduped || 'describe the change'}`;
}

function buildVagueRewrite(subject: string, vagueKeyword: string): string {
  const derivedType = getDerivedType(subject);
  const normalizedKeyword = vagueKeyword.toLowerCase();

  if (['wip', 'stuff', 'things', 'changes'].includes(normalizedKeyword)) {
    return `${derivedType}: describe the completed change`;
  }

  if (['fix', 'fixed', 'bugfix', 'patch'].includes(normalizedKeyword)) {
    return 'fix: describe the bug and affected behavior';
  }

  if (['update', 'updated', 'tweak', 'adjust', 'modify'].includes(normalizedKeyword)) {
    return `${derivedType}: describe the updated component and outcome`;
  }

  return buildRewrite(toImperative(subject), derivedType);
}

function buildConventionalRewrite(subject: string): string {
  const vagueKeyword = findVagueKeyword(subject);
  if (vagueKeyword) return buildVagueRewrite(subject, vagueKeyword);

  const cleaned = removeTrailingPeriod(lowercaseFirstChar(toImperative(subject)));
  return buildRewrite(cleaned);
}

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
      rewrite: buildConventionalRewrite(subject),
    });
  }

  // Vague keyword detection
  const vagueKeyword = findVagueKeyword(subject);
  if (vagueKeyword && words.length <= 3) {
    const rewrite = buildVagueRewrite(subject, vagueKeyword);
    issues.push({
      category: 'specificity',
      severity: 'critical',
      message: `Subject is vague ("${vagueKeyword}") — lacks detail about what changed and why.`,
      suggestion: 'Be specific: what bug? what update? what component?',
      rewrite,
    });
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
      rewrite: buildConventionalRewrite(subject),
    });
  } else {
    const type = ccMatch[1];
    if (!CONVENTIONAL_TYPES_SET.has(type)) {
      issues.push({
        category: 'convention',
        severity: 'warning',
        message: `Unrecognized conventional commit type "${type}".`,
        suggestion: `Use one of: ${CONVENTIONAL_TYPES.join(', ')}`,
        rewrite: `feat: ${ccMatch[3]}`,
      });
    }
  }

  // Subject length
  if (subject.length > 72) {
    const derivedType = getDerivedType(subject);
    const [prefix, msgPart] = ensureConventionalPrefix(subject, derivedType);
    issues.push({
      category: 'subject',
      severity: 'warning',
      message: `Subject is ${subject.length} characters — exceeds 72 chars.`,
      suggestion: 'Keep subject <= 50 chars; move details to body.',
      rewrite: `${prefix}${truncateToWordBoundary(msgPart, 50)}...`,
    });
  } else if (subject.length > 50) {
    const derivedType = getDerivedType(subject);
    const [prefix, msgPart] = ensureConventionalPrefix(subject, derivedType);
    issues.push({
      category: 'subject',
      severity: 'suggestion',
      message: `Subject is ${subject.length} characters — exceeds recommended 50.`,
      suggestion: 'Try to keep subject <= 50 chars.',
      rewrite: `${prefix}${truncateToWordBoundary(msgPart, 50)}...`,
    });
  } else if (subject.length < 5) {
    issues.push({
      category: 'subject',
      severity: 'critical',
      message: `Subject is only ${subject.length} characters — too short.`,
      suggestion: 'Describe the change in at least 5 characters.',
      rewrite: buildConventionalRewrite(subject),
    });
  }

  // Capitalization
  if (subject.length > 0 && subject[0] !== subject[0].toLowerCase() && !isConventional) {
    issues.push({
      category: 'subject',
      severity: 'suggestion',
      message: 'Subject starts with uppercase — use lowercase for non-conventional commits.',
      suggestion: 'Start with lowercase unless using a conventional commit type.',
      rewrite: lowercaseFirstChar(subject),
    });
  }

  // Trailing period
  if (subject.endsWith('.')) {
    issues.push({
      category: 'subject',
      severity: 'suggestion',
      message: 'Subject ends with a period.',
      suggestion: 'Remove the trailing period from the subject line.',
      rewrite: removeTrailingPeriod(subject),
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
      rewrite: toImperative(subject),
    });
  }

  // Body presence for non-trivial changes
  if (!body && subject.length > 30) {
    issues.push({
      category: 'body',
      severity: 'warning',
      message: 'No body present — consider explaining why the change was made.',
      suggestion: 'Add a blank line after the subject, then explain context and rationale.',
      rewrite: `${subject}\n\nAdd context explaining why this change was made.`,
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
          rewrite: 'Wrap body text at 72 characters for readability',
        });
        break;
      }
    }
  }

  // Score calculation: start at 10, subtract penalties
  let score = 10;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 3;
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
