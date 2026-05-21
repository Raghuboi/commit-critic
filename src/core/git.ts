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

import type { Commit } from '../types/commit';

const COMMIT_SEPARATOR = '--COMMIT_END--';
const BODY_MARKER = '--BODY--';

/**
 * Run a git command and return stdout text.
 */
async function gitText(args: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const text = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errMsg = err.trim() || `git ${args[0]} failed with exit code ${exitCode}`;
    throw new Error(errMsg);
  }
  return text;
}

/**
 * Fetch last N commits from a git repository.
 */
export async function getCommits(repoPath: string, count: number, noMerges = false): Promise<Commit[]> {
  const format = `%H%n%h%n%an%n%ae%n%aD%n%ct%n%P%n%s%n${BODY_MARKER}%n%b%n${COMMIT_SEPARATOR}`;
  const args = ['log', `--format=${format}`, '-n', String(count)];
  if (noMerges) args.push('--no-merges');

  let output: string;
  try {
    output = await gitText(args, repoPath);
  } catch (err: any) {
    if (err.message?.includes('does not have any commits yet') || err.message?.includes('bad default revision')) {
      return [];
    }
    throw err;
  }

  const commits: Commit[] = [];
  const blocks = output.split(COMMIT_SEPARATOR);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');
    const hash = lines[0] ?? '';
    const shortHash = lines[1] ?? '';
    const author = lines[2] ?? '';
    const email = lines[3] ?? '';
    const date = lines[4] ?? '';
    const timestamp = Number(lines[5] ?? '0');
    const parents = (lines[6] ?? '').split(' ').filter(Boolean);
    const bodyIdx = lines.indexOf(BODY_MARKER);
    const subject = bodyIdx > 7 ? lines.slice(7, bodyIdx).join('\n') : (lines[7] ?? '');
    const body = bodyIdx >= 0 ? lines.slice(bodyIdx + 1).join('\n').trim() : '';

    commits.push({ hash, shortHash, author, email, date, timestamp, parents, subject, body });
  }

  return commits;
}

/**
 * Get staged diff from a git repository.
 */
export async function getStagedDiff(repoPath: string): Promise<string> {
  return gitText(['diff', '--staged'], repoPath);
}

/**
 * Check if there are staged changes.
 */
export async function hasStagedChanges(repoPath: string): Promise<boolean> {
  const proc = Bun.spawn(['git', 'diff', '--staged', '--quiet'], {
    cwd: repoPath,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  return exitCode !== 0;
}

/**
 * Check if a directory is a git repository.
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  const proc = Bun.spawn(['git', 'rev-parse', '--git-dir'], {
    cwd: repoPath,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

/**
 * Shallow clone a remote repository.
 */
export async function cloneRepo(url: string, dest: string, depth = 50): Promise<void> {
  const args = ['git', 'clone', '--depth', String(depth), '--single-branch'];
  // For local file:// URLs, git may clone empty repo unless branch is specified.
  // Detect and add --branch main if it looks like a local bare repo.
  if (url.startsWith('file://')) {
    args.push('--branch', 'main');
  }
  args.push(url, dest);
  const proc = Bun.spawn(args, {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`git clone failed with exit code ${exitCode}`);
  }
}
