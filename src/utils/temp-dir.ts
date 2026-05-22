/**
 * Temporary directory management
 *
 * Creates secure temp directories under the platform temp root.
 * Ensures cleanup even on error via finally blocks.
 */

import { mkdtemp, rm } from 'node:fs/promises';
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
  const tempDir = await mkdtemp(join(process.env.TMPDIR ?? '/tmp', 'commit-critic-'));
  try {
    return await fn(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
