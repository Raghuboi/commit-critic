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
    await cloneRepo(url, tempDir, 50);
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
  // Local file path
  try {
    const stat = Bun.file(url).size;
    return true; // exists as file or dir
  } catch {
    // ignore
  }
  return false;
}
