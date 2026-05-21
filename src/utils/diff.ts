/**
 * Diff parsing and truncation
 *
 * Handles:
 * - Parsing staged diff output
 * - Truncating large diffs (max 50K chars)
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
