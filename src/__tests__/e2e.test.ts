/**
 * End-to-end integration tests
 *
 * Tests the full CLI binary with real git repos.
 */

import { test, expect } from 'bun:test';

test('analyze command produces JSON output', async () => {
  // TODO: Implement — spawn CLI with --json, verify output
});

test('analyze command with --no-llm works offline', async () => {
  // TODO: Implement — verify deterministic scoring without LLM
});

test('analyze command handles remote repo', async () => {
  // TODO: Implement — verify clone + analyze + cleanup
});

test('write command exits 1 with no staged changes', async () => {
  // TODO: Implement — verify error on empty staged diff
});

test('doctor command checks git availability', async () => {
  // TODO: Implement — verify doctor output
});

test('auto-JSON on pipe', async () => {
  // TODO: Implement — pipe stdout, verify JSON output
});

test('temp dir cleanup on error', async () => {
  // TODO: Implement — verify no orphaned temp directories
});
