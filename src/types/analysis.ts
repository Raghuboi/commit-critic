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
  /** Short hash */
  shortHash: string;
  /** Subject line */
  subject: string;
  /** Combined score (0-10) */
  score: number;
  /** Issues found */
  issues: Issue[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Whether the commit follows conventional commit format */
  isConventionalCommit: boolean;
  /** Whether the commit is a merge commit */
  isMergeCommit: boolean;
  /** Whether the commit has a body */
  hasBody: boolean;
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
  /** Number of commits where LLM fallback was used */
  llmFallbackCount: number;
  /** Number of vague commits (score < 5) */
  vagueCommits: number;
  /** Number of one-word commits */
  oneWordCommits: number;
  /** Number of conventional commits */
  conventionalCommits: number;
  /** Number of commits with body */
  commitsWithBody: number;
  /** Score distribution */
  scoreDistribution: ScoreDistribution;
  /** Top issue categories by frequency */
  topIssues: { category: string; count: number }[];
  /** Analysis duration in milliseconds */
  durationMs: number;
}

/**
 * Score distribution buckets.
 */
export interface ScoreDistribution {
  excellent: number; // 9-10
  good: number;      // 7-8
  average: number;   // 5-6
  poor: number;      // 3-4
  terrible: number;  // 1-2
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
  /** Stats */
  stats: {
    averageScore: number;
    vagueCommits: number;
    vagueCommitsPercent: number;
    oneWordCommits: number;
    oneWordCommitsPercent: number;
    conventionalCommits: number;
    conventionalCommitsPercent: number;
    commitsWithBody: number;
    commitsWithBodyPercent: number;
    scoreDistribution: ScoreDistribution;
  };
  /** Top issues */
  topIssues: { category: string; count: number }[];
  /** Duration in milliseconds */
  durationMs: number;
}
