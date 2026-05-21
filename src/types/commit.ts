/**
 * Commit types
 */

/**
 * Commit data from git log.
 */
export interface Commit {
  /** Full commit hash */
  hash: string;
  /** Short commit hash (7 chars) */
  shortHash: string;
  /** Subject line (first line of commit message) */
  subject: string;
  /** Body (everything after subject and blank line) */
  body: string;
  /** Author name */
  author: string;
  /** Commit date (ISO string) */
  date: string;
}
