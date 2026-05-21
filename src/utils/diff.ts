/**
 * Diff parsing and truncation
 *
 * Handles:
 * - Parsing staged diff output
 * - Truncating large diffs (max 50K chars)
 * - Counting files changed and lines added/removed
 */

/**
 * Truncate a diff to a maximum character count.
 *
 * Appends a notification if truncated.
 */
export function truncateDiff(diff: string, maxChars: number = 50000): string {
  if (diff.length <= maxChars) return diff;
  const truncated = diff.slice(0, maxChars);
  return truncated + '\n\n[diff truncated — exceeded ' + maxChars + ' chars]';
}

/**
 * Parse diff stats from git diff --stat output.
 */
export function parseDiffStats(statOutput: string): DiffStats {
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;

  for (const line of statOutput.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('|') === false) continue;
    filesChanged++;
    const plusMatch = trimmed.match(/(\d+)\s*\+\+/);
    const minusMatch = trimmed.match(/(\d+)\s*--/);
    if (plusMatch) insertions += parseInt(plusMatch[1], 10);
    if (minusMatch) deletions += parseInt(minusMatch[1], 10);
  }

  return { filesChanged, insertions, deletions };
}

/**
 * Diff statistics.
 */
export interface DiffStats {
  /** Number of files changed */
  filesChanged: number;
  /** Number of lines added */
  insertions: number;
  /** Number of lines removed */
  deletions: number;
}
