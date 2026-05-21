/**
 * Commit message analysis engine
 *
 * Combines deterministic scoring with LLM semantic scoring.
 *
 * Flow:
 * 1. Run deterministic scorer (always)
 * 2. If LLM available and --no-llm not set: run LLM scorer
 * 3. Combine scores: final = deterministic * 0.6 + llm * 0.4
 * 4. Return analysis result with score, issues, suggestions
 */

import type { Commit } from '../types/commit';
import type { AnalysisResult } from '../types/analysis';

/**
 * Analyze a single commit message.
 */
export async function analyzeCommit(
  _commit: Commit,
  _options: AnalysisOptions
): Promise<AnalysisResult> {
  // TODO: Implement
  return {
    hash: _commit.hash,
    score: 0,
    issues: [],
    suggestions: [],
  };
}

/**
 * Analyze multiple commits.
 */
export async function analyzeCommits(
  _commits: Commit[],
  _options: AnalysisOptions
): Promise<AnalysisResult[]> {
  // TODO: Implement
  return [];
}

/**
 * Analysis options.
 */
export interface AnalysisOptions {
  noLlm?: boolean;
  strict?: boolean;
  provider?: string;
  model?: string;
}
