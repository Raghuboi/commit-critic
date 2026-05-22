/**
 * Diff parsing and truncation
 */

export const WRITE_MAX_CHARS = 12000;

export const WRITE_DIFF_TRUNCATED = '\n\n[...diff truncated to ' + WRITE_MAX_CHARS + ' chars...]';

/**
 * Truncate a diff to a maximum character count.
 */
export function truncateDiff(diff: string, maxChars: number = WRITE_MAX_CHARS): string {
  if (diff.length <= maxChars) return diff;
  const truncated = diff.slice(0, maxChars);
  return truncated + WRITE_DIFF_TRUNCATED;
}
