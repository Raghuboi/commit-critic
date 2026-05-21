/**
 * JSON output formatting
 *
 * Produces structured JSON output for --json flag and auto-JSON on pipe.
 * Follows the schema defined in types/analysis.ts JsonOutput.
 */

import type { JsonOutput } from '../types/analysis';

/**
 * Format analysis results as JSON.
 */
export function formatJson(_output: JsonOutput): string {
  // TODO: Implement
  return JSON.stringify(_output, null, 2);
}

/**
 * Check if stdout is piped (auto-JSON detection).
 */
export function isPiped(): boolean {
  // TODO: Implement — check process.stdout.isTTY
  return false;
}
