/**
 * JSON output formatting
 *
 * Produces structured JSON output for --json flag and auto-JSON on pipe.
 * Follows the schema defined in types/analysis.ts JsonOutput.
 */

import type { JsonOutput, AnalysisResult, AnalysisSummary, ScoreDistribution } from '../types/analysis';
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
  const distribution: ScoreDistribution = {
    excellent: results.filter(r => r.score >= 9).length,
    good: results.filter(r => r.score >= 7 && r.score <= 8).length,
    average: results.filter(r => r.score >= 5 && r.score <= 6).length,
    poor: results.filter(r => r.score >= 3 && r.score <= 4).length,
    terrible: results.filter(r => r.score <= 2).length,
  };

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
      vagueCommits: results.filter(r => r.score < 5).length,
      vagueCommitsPercent: Math.round((results.filter(r => r.score < 5).length / results.length) * 100) || 0,
      oneWordCommits: results.filter(r => r.subject.trim().split(/\s+/).filter(Boolean).length === 1).length,
      oneWordCommitsPercent: Math.round((results.filter(r => r.subject.trim().split(/\s+/).filter(Boolean).length === 1).length / results.length) * 100) || 0,
      conventionalCommits: results.filter(r => r.isConventionalCommit).length,
      conventionalCommitsPercent: Math.round((results.filter(r => r.isConventionalCommit).length / results.length) * 100) || 0,
      commitsWithBody: results.filter(r => r.hasBody).length,
      commitsWithBodyPercent: Math.round((results.filter(r => r.hasBody).length / results.length) * 100) || 0,
      scoreDistribution: distribution,
    },
    topIssues: summary.topIssues,
    durationMs: summary.durationMs,
  };
}
