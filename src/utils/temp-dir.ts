/**
 * Temporary directory management
 *
 * Creates secure temp directories using os.tmpdir.
 * Ensures cleanup even on error via finally blocks.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Create a temporary directory.
 *
 * Returns the path to the created directory.
 * Caller is responsible for cleanup.
 */
export async function createTempDir(prefix = 'commit-critic-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Remove a directory recursively.
 */
export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

/**
 * Create a temp directory and ensure cleanup.
 *
 * Usage:
 *   await withTempDir(async (tempDir) => {
 *     // Use tempDir
 *   });
 *   // tempDir is automatically cleaned up
 */
export async function withTempDir<T>(fn: (tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = await createTempDir();
  try {
    return await fn(tempDir);
  } finally {
    await removeDir(tempDir);
  }
}
