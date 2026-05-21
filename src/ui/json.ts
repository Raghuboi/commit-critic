/**
 * JSON output formatting
 *
 * Produces structured JSON output for --json flag and auto-JSON on pipe.
 * Follows the schema defined in types/analysis.ts JsonOutput.
 */

import type { JsonOutput, AnalysisResult, AnalysisSummary } from '../types/analysis';
import { isTTY } from '../utils/env';

/**
 * Format analysis results as JSON.
 */
export function formatJson(output: JsonOutput): string {
  return JSON.stringify(output, null, 2);
}

/**
 * Check if stdout is piped (auto-JSON detection).
 */
export function isPiped(): boolean {
  return !isTTY();
}

/**
 * Build JsonOutput from analysis results.
 */
export function buildJsonOutput(
  command: string,
  repo: string,
  results: AnalysisResult[],
  summary: AnalysisSummary,
  version: string
): JsonOutput {
  const total = results.length || 1;

  return {
    version,
    command,
    repo,
    commitCount: summary.commitCount,
    overallScore: summary.overallScore,
    summary: {
      passed: summary.passed,
      warnings: summary.warnings,
      errors: summary.errors,
    },
    commits: results,
    stats: {
      averageScore: summary.overallScore,
      vagueCommits: summary.vagueCommits,
      vagueCommitsPercent: Math.round((summary.vagueCommits / total) * 100),
      oneWordCommits: summary.oneWordCommits,
      oneWordCommitsPercent: Math.round((summary.oneWordCommits / total) * 100),
      conventionalCommits: summary.conventionalCommits,
      conventionalCommitsPercent: Math.round((summary.conventionalCommits / total) * 100),
      commitsWithBody: summary.commitsWithBody,
      commitsWithBodyPercent: Math.round((summary.commitsWithBody / total) * 100),
      scoreDistribution: summary.scoreDistribution,
    },
    topIssues: summary.topIssues,
    durationMs: summary.durationMs,
  };
}
