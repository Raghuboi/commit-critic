/**
 * Commit message analysis engine
 *
 * Combines deterministic scoring with LLM semantic scoring.
 *
 * Flow:
 * 1. Run deterministic scorer (always)
 * 2. If LLM available and --no-llm not set: run LLM scorer
 * 3. LLM makes the final score (1-10) with deterministic context
 * 4. Fallback to deterministic-only score if LLM unavailable
 * 5. Return analysis result with score, issues, suggestions
 */

import type { Commit } from '../types/commit';
import type { AnalysisResult } from '../types/analysis';
import { scoreCommit, isConventionalCommit, isMergeCommit } from './scorer';
import { analyzeCommitWithLLM } from './llm';
import type { AIConfig, ProviderSpecificConfig } from '../types/config';
import { createProgressBar } from '../ui/progress';
import { warn } from '../ui/output';

export interface AnalysisOptions {
  noLlm?: boolean;
  strict?: boolean;
  provider?: string;
  model?: string;
  aiConfig?: AIConfig;
  providerConfig?: ProviderSpecificConfig;
  showProgress?: boolean;
}

let fallbackCount = 0;

export function getFallbackCount(): number {
  return fallbackCount;
}

export function resetFallbackCount(): void {
  fallbackCount = 0;
}

/**
 * Analyze a single commit message.
 */
export async function analyzeCommit(
  commit: Commit,
  options: AnalysisOptions
): Promise<AnalysisResult> {
  const deterministic = scoreCommit(commit);

  let score = deterministic.score;
  let issues = deterministic.issues;
  let suggestions: string[] = [];
  let suggestion: string | undefined;
  let whyGood: string | undefined;

  if (!options.noLlm && options.aiConfig && options.providerConfig) {
    try {
      const llmResult = await analyzeCommitWithLLM(
        commit,
        deterministic,
        options.aiConfig,
        options.providerConfig
      );
      score = llmResult.score;
      issues = llmResult.issues.map(i => ({
        category: i.category as any,
        severity: i.severity,
        message: i.message,
      }));
      suggestions = llmResult.suggestions;
      suggestion = llmResult.suggestion;
      whyGood = llmResult.whyGood;
    } catch {
      // Fallback to deterministic score on LLM failure
      fallbackCount++;
      warn('LLM unavailable — using deterministic scoring. Check your API key and network connection.');
      if (options.strict) {
        throw new Error('LLM analysis failed and strict mode is enabled');
      }
    }
  }

  return {
    hash: commit.hash,
    shortHash: commit.shortHash,
    subject: commit.subject,
    score,
    issues,
    suggestions,
    suggestion,
    whyGood,
    isConventionalCommit: isConventionalCommit(commit.subject),
    isMergeCommit: isMergeCommit(commit),
    hasBody: commit.body.trim().length > 0,
  };
}

/**
 * Analyze multiple commits.
 */
export async function analyzeCommits(
  commits: Commit[],
  options: AnalysisOptions
): Promise<AnalysisResult[]> {
  resetFallbackCount();
  const progress = options.showProgress && commits.length > 1 ? createProgressBar('Analyzing') : null;
  const results: AnalysisResult[] = [];
  for (let i = 0; i < commits.length; i++) {
    results.push(await analyzeCommit(commits[i], options));
    progress?.update(i + 1, commits.length);
  }
  progress?.stop();
  return results;
}
