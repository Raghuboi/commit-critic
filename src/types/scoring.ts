/**
 * Commit quality scoring types
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
  /** Concrete rewritten commit message replacing the original (optional) */
  rewrite?: string;
}

/**
 * Scoring result from deterministic or LLM scoring.
 */
export interface ScoringResult {
  /** Score from 0-10 */
  score: number;
  /** Issues found */
  issues: Issue[];
  /** Whether the commit follows conventional commit format */
  isConventionalCommit?: boolean;
  /** Whether the commit is a merge commit */
  isMergeCommit?: boolean;
  /** Whether the commit has a body */
  hasBody?: boolean;
}


