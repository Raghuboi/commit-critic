/**
 * Remote repository handling
 *
 * Flow:
 * 1. Create temp directory
 * 2. Shallow clone (git clone --depth 50)
 * 3. Run analysis in temp directory
 * 4. Cleanup temp directory in finally block
 */

import { cloneRepo } from './git';
import { withTempDir } from '../utils/temp-dir';

/**
 * Detect the default branch of a remote repository.
 * Uses git ls-remote to query the remote HEAD symbolic ref.
 * Falls back to listing refs/heads/ for bare repos.
 */
export async function detectDefaultBranch(url: string): Promise<string | undefined> {
  try {
    // Try symref first (works for normal remotes)
    const proc = Bun.spawn(['git', 'ls-remote', '--symref', url, 'HEAD'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const text = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const match = text.match(/ref:\s+refs\/heads\/(\S+)/);
      if (match?.[1]) return match[1];
    }

    // Fallback: list all refs/heads and pick the first one (for bare repos)
    const proc2 = Bun.spawn(['git', 'ls-remote', url], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const text2 = await new Response(proc2.stdout).text();
    const exitCode2 = await proc2.exited;
    if (exitCode2 === 0) {
      const match2 = text2.match(/refs\/heads\/(\S+)/);
      if (match2?.[1]) return match2[1];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Analyze a remote repository.
 *
 * Clones to temp dir, analyzes, then cleans up.
 * Cleanup happens in finally block to ensure it runs even on error.
 */
export async function analyzeRemoteRepo<T>(
  url: string,
  analyzeFn: (repoPath: string) => Promise<T>
): Promise<T> {
  return withTempDir(async (tempDir) => {
    const defaultBranch = await detectDefaultBranch(url);
    await cloneRepo(url, tempDir, 50, defaultBranch);
    return analyzeFn(tempDir);
  });
}

/**
 * Validate a repository URL.
 */
export function isValidRepoUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false;
  if (url.startsWith('https://') || url.startsWith('git@')) return true;
  if (url.startsWith('file://')) return true;
  // Reject plain text that doesn't look like a path
  if (url.includes(' ') || url.includes('\n')) return false;
  // Only accept absolute paths for local paths
  if (url.startsWith('/')) return true;
  return false;
}
