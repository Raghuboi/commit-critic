/**
 * Progress bar for commit analysis
 *
 * Uses 8-level block characters for smooth progress:
 * [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
 * Inspired by Claude Code progress bar patterns.
 */

/**
 * Create a progress bar.
 */
export function createProgressBar(_total: number): ProgressBar {
  // TODO: Implement
  return {
    update: (_current: number) => {},
    stop: () => {},
  };
}

/**
 * Progress bar interface.
 */
export interface ProgressBar {
  /** Update progress */
  update(current: number): void;
  /** Stop and clear the progress bar */
  stop(): void;
}
