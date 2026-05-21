/**
 * Deterministic scoring rules engine
 *
 * Fast, offline-capable scoring based on objective rules.
 * No LLM required — runs instantly.
 *
 * Categories (from research):
 * - Structure (20%): subject/body separation, conventional commit format
 * - Subject Quality (25%): length <= 50, imperative mood, no period, capitalized
 * - Conventional Commits (20%): valid type, lowercase type, optional scope
 * - Body Quality (15%): wrapped at 72 chars, explains context
 * - Diff Correlation (10%): message length proportional to diff size
 * - Git Manual Style (10%): Chris Beams' 7 rules compliance
 *
 * Returns: score (0-10) + array of issues with severity
 */

import type { Commit } from '../types/commit';
import type { ScoringResult, Issue } from '../types/scoring';

/**
 * Score a commit message using deterministic rules.
 */
export function scoreCommit(_commit: Commit, _diffLength?: number): ScoringResult {
  // TODO: Implement deterministic scoring rules
  return {
    score: 0,
    issues: [],
  };
}

/**
 * Check conventional commit format.
 */
function checkConventionalCommit(_subject: string): Issue[] {
  // TODO: Validate type(scope): subject format
  return [];
}

/**
 * Check subject line quality.
 */
function checkSubjectQuality(_subject: string): Issue[] {
  // TODO: Check length, imperative mood, capitalization, period
  return [];
}

/**
 * Check body quality.
 */
function checkBodyQuality(_body: string): Issue[] {
  // TODO: Check wrapping, context, not empty for large diffs
  return [];
}

/**
 * Check diff correlation (message length vs diff size).
 */
function checkDiffCorrelation(_subject: string, _body: string, _diffLength: number): Issue[] {
  // TODO: Check if message length is proportional to diff size
  return [];
}
