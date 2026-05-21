/**
 * Analysis result types
 */

import type { Issue } from './scoring';

/**
 * Analysis result for a single commit.
 */
export interface AnalysisResult {
  /** Commit hash */
  hash: string;
  /** Combined score (0-10) */
  score: number;
  /** Issues found */
  issues: Issue[];
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Analysis summary for a batch of commits.
 */
export interface AnalysisSummary {
  /** Total commits analyzed */
  commitCount: number;
  /** Overall average score */
  overallScore: number;
  /** Number of commits that passed (score >= 7) */
  passed: number;
  /** Number of commits with warnings (score 5-6) */
  warnings: number;
  /** Number of commits with errors (score < 5) */
  errors: number;
  /** Top issue categories by frequency */
  topIssues: { category: string; count: number }[];
  /** Analysis duration in milliseconds */
  durationMs: number;
}

/**
 * JSON output format for --json flag.
 */
export interface JsonOutput {
  /** Tool version */
  version: string;
  /** Command that was run */
  command: string;
  /** Repository path or URL */
  repo: string;
  /** Number of commits analyzed */
  commitCount: number;
  /** Overall score */
  overallScore: number;
  /** Summary statistics */
  summary: {
    passed: number;
    warnings: number;
    errors: number;
  };
  /** Individual commit results */
  commits: AnalysisResult[];
  /** Top issues */
  topIssues: { category: string; count: number }[];
  /** Duration in milliseconds */
  durationMs: number;
}
