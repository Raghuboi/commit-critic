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
 */
export async function detectDefaultBranch(url: string): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(['git', 'ls-remote', '--symref', url, 'HEAD'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const text = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return undefined;
    const match = text.match(/ref:\s+refs\/heads\/(\S+)/);
    return match?.[1];
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
