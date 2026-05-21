/**
 * Git operations via Bun.spawn
 *
 * All git access uses the git binary via subprocess (Bun.spawn).
 * No JS Git libraries — simpler, more reliable, no SSH auth issues.
 *
 * Functions:
 * - getCommits(repoPath, count): Fetch last N commits
 * - getStagedDiff(repoPath): Get staged diff
 * - isGitRepo(repoPath): Check if directory is a git repo
 * - cloneRepo(url, dest, depth): Shallow clone remote repo
 */

/**
 * Fetch last N commits from a git repository.
 *
 * Uses: git log --format=%H%n%s%n%b%n---COMMIT_SEPARATOR--- -n <count> --no-merges
 */
export async function getCommits(_repoPath: string, _count: number): Promise<Commit[]> {
  // TODO: Implement
  return [];
}

/**
 * Get staged diff from a git repository.
 *
 * Uses: git diff --staged
 * Truncates at 50K chars with notification.
 */
export async function getStagedDiff(_repoPath: string): Promise<string> {
  // TODO: Implement
  return '';
}

/**
 * Check if a directory is a git repository.
 *
 * Uses: git rev-parse --is-inside-work-tree
 */
export async function isGitRepo(_repoPath: string): Promise<boolean> {
  // TODO: Implement
  return false;
}

/**
 * Shallow clone a remote repository.
 *
 * Uses: git clone --depth <depth> <url> <dest>
 */
export async function cloneRepo(_url: string, _dest: string, _depth: number): Promise<void> {
  // TODO: Implement
}

/**
 * Commit data structure from git log.
 */
export interface Commit {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  author: string;
  date: string;
}
