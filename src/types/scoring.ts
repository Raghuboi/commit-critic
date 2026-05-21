/**
 * Scoring rubric types
 */

/**
 * Issue category.
 */
export type IssueCategory =
  | 'type'
  | 'scope'
  | 'subject'
  | 'body'
  | 'convention'
  | 'specificity'
  | 'intent'
  | 'clarity';

/**
 * Issue severity.
 */
export type IssueSeverity = 'critical' | 'warning' | 'suggestion';

/**
 * A single issue found in a commit message.
 */
export interface Issue {
  /** Category of the issue */
  category: IssueCategory;
  /** Severity level */
  severity: IssueSeverity;
  /** Human-readable description */
  message: string;
  /** Suggested fix (optional) */
  suggestion?: string;
}

/**
 * Scoring result from deterministic or LLM scoring.
 */
export interface ScoringResult {
  /** Score from 0-10 */
  score: number;
  /** Issues found */
  issues: Issue[];
}

/**
 * Score breakdown by category.
 */
export interface ScoreBreakdown {
  structure: number;
  subjectQuality: number;
  conventionalCommits: number;
  bodyQuality: number;
  diffCorrelation: number;
  gitManualStyle: number;
}
