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
 * Create a temp directory and ensure cleanup.
 *
 * Usage:
 *   await withTempDir(async (tempDir) => {
 *     // Use tempDir
 *   });
 *   // tempDir is automatically cleaned up
 */
export async function withTempDir<T>(fn: (tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), 'commit-critic-'));
  try {
    return await fn(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
